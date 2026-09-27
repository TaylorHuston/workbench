from __future__ import annotations

import datetime as dt
import threading
import time
from collections.abc import Mapping
from dataclasses import dataclass

import pytest

from pkm_api.application.job_processing import JobProcessingError
from pkm_api.infrastructure import safe_http_job_sources
from pkm_api.infrastructure.safe_http_job_sources import (
    BoundedHttpResponse,
    ResolvedHttpsTarget,
    SafeHttpJobSourceRetriever,
    _read_bounded,
)

PUBLIC_IP = "93.184.216.34"
NOW = dt.datetime(2026, 9, 23, 12, 0, tzinfo=dt.UTC)


@dataclass
class FakeBodyResponse:
    body: bytes
    offset: int = 0

    def read(self, amount: int) -> bytes:
        result = self.body[self.offset : self.offset + amount]
        self.offset += len(result)
        return result


def test_retrieval_is_dns_pinned_bounded_and_content_typed() -> None:
    observed: dict[str, object] = {}

    def requester(
        target: ResolvedHttpsTarget, headers: Mapping[str, str]
    ) -> BoundedHttpResponse:
        observed["target"] = target
        observed["headers"] = headers
        return BoundedHttpResponse(
            status=200,
            headers={"content-type": "text/html; charset=utf-8"},
            body=b"<html>job</html>",
        )

    retriever = SafeHttpJobSourceRetriever(
        resolver=lambda host, port: [PUBLIC_IP],
        requester=requester,
        clock=lambda: NOW,
    )

    result = retriever.retrieve("https://jobs.example.com/posting/123?source=direct")

    target = observed["target"]
    headers = observed["headers"]
    assert isinstance(target, ResolvedHttpsTarget)
    assert target.hostname == "jobs.example.com"
    assert target.addresses == (PUBLIC_IP,)
    assert target.request_target == "/posting/123?source=direct"
    assert isinstance(headers, Mapping)
    assert headers["Host"] == "jobs.example.com"
    assert "Authorization" not in headers
    assert "Cookie" not in headers
    assert result.media_type == "text/html"
    assert result.body == b"<html>job</html>"
    assert len(result.sha256) == 64


@pytest.mark.parametrize(
    "url,addresses",
    [
        ("https://localhost/jobs/1", [PUBLIC_IP]),
        ("https://jobs.internal.local/jobs/1", [PUBLIC_IP]),
        ("https://127.0.0.1/jobs/1", ["127.0.0.1"]),
        ("https://[::1]/jobs/1", ["::1"]),
        ("https://jobs.example.com/jobs/1", [PUBLIC_IP, "10.0.0.1"]),
        ("https://user:password@jobs.example.com/jobs/1", [PUBLIC_IP]),
        ("https://jobs.example.com:8443/jobs/1", [PUBLIC_IP]),
    ],
)
def test_private_credentialed_and_nonstandard_destinations_are_blocked(
    url: str, addresses: list[str]
) -> None:
    called = False

    def requester(
        target: ResolvedHttpsTarget, headers: Mapping[str, str]
    ) -> BoundedHttpResponse:
        nonlocal called
        called = True
        raise AssertionError("blocked requests must not reach the network")

    retriever = SafeHttpJobSourceRetriever(
        resolver=lambda host, port: addresses,
        requester=requester,
    )

    with pytest.raises(JobProcessingError) as raised:
        retriever.retrieve(url)

    assert raised.value.code == "blockedSourceAddress"
    assert raised.value.retryable is False
    assert called is False


def test_every_redirect_is_revalidated() -> None:
    def resolver(host: str, port: int) -> list[str]:
        return ["10.0.0.1"] if host == "private.example" else [PUBLIC_IP]

    retriever = SafeHttpJobSourceRetriever(
        resolver=resolver,
        requester=lambda target, headers: BoundedHttpResponse(
            status=302,
            headers={"location": "https://private.example/secret"},
            body=b"",
        ),
    )

    with pytest.raises(JobProcessingError) as raised:
        retriever.retrieve("https://jobs.example.com/posting/123")

    assert raised.value.code == "blockedSourceAddress"


def test_redirect_limit_and_content_type_fail_safely() -> None:
    redirecting = SafeHttpJobSourceRetriever(
        resolver=lambda host, port: [PUBLIC_IP],
        requester=lambda target, headers: BoundedHttpResponse(
            status=302,
            headers={"location": "/again"},
            body=b"",
        ),
        max_redirects=1,
    )
    unsupported = SafeHttpJobSourceRetriever(
        resolver=lambda host, port: [PUBLIC_IP],
        requester=lambda target, headers: BoundedHttpResponse(
            status=200,
            headers={"content-type": "application/octet-stream"},
            body=b"binary",
        ),
    )

    with pytest.raises(JobProcessingError) as redirect_error:
        redirecting.retrieve("https://jobs.example.com/start")
    with pytest.raises(JobProcessingError) as content_error:
        unsupported.retrieve("https://jobs.example.com/start")

    assert redirect_error.value.code == "tooManySourceRedirects"
    assert content_error.value.code == "unsupportedSourceContent"


def test_retrieval_deadline_includes_dns_resolution() -> None:
    def slow_resolver(host: str, port: int) -> list[str]:
        time.sleep(1)
        return [PUBLIC_IP]

    retriever = SafeHttpJobSourceRetriever(
        resolver=slow_resolver,
        timeout_seconds=0.05,
    )
    started = time.monotonic()

    with pytest.raises(JobProcessingError) as raised:
        retriever.retrieve("https://jobs.example.com/posting/123")

    assert time.monotonic() - started < 0.5
    assert raised.value.code == "sourceDnsFailure"
    assert raised.value.retryable is True


def test_retrieval_deadline_is_shared_across_redirects() -> None:
    request_count = 0

    def slow_redirect(
        target: ResolvedHttpsTarget, headers: Mapping[str, str]
    ) -> BoundedHttpResponse:
        nonlocal request_count
        request_count += 1
        time.sleep(0.04)
        return BoundedHttpResponse(
            status=302,
            headers={"location": "/again"},
            body=b"",
        )

    retriever = SafeHttpJobSourceRetriever(
        resolver=lambda host, port: [PUBLIC_IP],
        requester=slow_redirect,
        timeout_seconds=0.07,
        max_redirects=3,
    )
    started = time.monotonic()

    with pytest.raises(JobProcessingError) as raised:
        retriever.retrieve("https://jobs.example.com/start")

    assert time.monotonic() - started < 0.5
    assert request_count <= 2
    assert raised.value.code == "sourceUnavailable"
    assert raised.value.retryable is True


def test_retrieval_can_be_cancelled_during_dns_resolution() -> None:
    resolver_started = threading.Event()
    release_resolver = threading.Event()

    def blocking_resolver(host: str, port: int) -> list[str]:
        resolver_started.set()
        release_resolver.wait(timeout=5)
        return [PUBLIC_IP]

    retriever = SafeHttpJobSourceRetriever(
        resolver=blocking_resolver,
        timeout_seconds=5,
    )
    errors: list[Exception] = []

    def retrieve() -> None:
        try:
            retriever.retrieve("https://jobs.example.com/posting/123")
        except Exception as error:
            errors.append(error)

    thread = threading.Thread(target=retrieve)
    thread.start()
    assert resolver_started.wait(timeout=1)

    retriever.cancel()
    thread.join(timeout=1)
    release_resolver.set()

    assert not thread.is_alive()
    assert len(errors) == 1
    assert isinstance(errors[0], JobProcessingError)
    assert errors[0].code == "workerStopping"


def test_retrieval_deadline_closes_a_slow_response_header_connection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connections: list[object] = []

    class SlowHeaderConnection:
        sock = None

        def __init__(self, **kwargs: object) -> None:
            self.timeout = kwargs["timeout"]
            self.closed = threading.Event()
            connections.append(self)

        def request(self, *args: object, **kwargs: object) -> None:
            return None

        def getresponse(self) -> object:
            self.closed.wait(timeout=5)
            raise OSError("deadline closed connection")

        def close(self) -> None:
            self.closed.set()

    monkeypatch.setattr(
        safe_http_job_sources,
        "_PinnedHttpsConnection",
        SlowHeaderConnection,
    )
    retriever = SafeHttpJobSourceRetriever(
        resolver=lambda host, port: [PUBLIC_IP],
        timeout_seconds=0.05,
    )
    started = time.monotonic()

    with pytest.raises(JobProcessingError) as raised:
        retriever.retrieve("https://jobs.example.com/posting/123")

    assert time.monotonic() - started < 0.5
    assert connections
    connection = connections[0]
    assert isinstance(connection, SlowHeaderConnection)
    assert connection.closed.is_set()
    assert raised.value.code == "sourceUnavailable"
    assert raised.value.retryable is True


def test_retrieval_cancellation_closes_the_active_network_connection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    connections: list[object] = []

    class BlockingConnection:
        sock = None

        def __init__(self, **kwargs: object) -> None:
            self.timeout = kwargs["timeout"]
            self.request_started = threading.Event()
            self.closed = threading.Event()
            connections.append(self)

        def request(self, *args: object, **kwargs: object) -> None:
            self.request_started.set()
            self.closed.wait(timeout=5)
            raise OSError("connection closed")

        def getresponse(self) -> object:
            raise AssertionError("cancelled request must not return a response")

        def close(self) -> None:
            self.closed.set()

    monkeypatch.setattr(
        safe_http_job_sources,
        "_PinnedHttpsConnection",
        BlockingConnection,
    )
    retriever = SafeHttpJobSourceRetriever(
        resolver=lambda host, port: [PUBLIC_IP],
        timeout_seconds=5,
    )
    errors: list[Exception] = []

    def retrieve() -> None:
        try:
            retriever.retrieve("https://jobs.example.com/posting/123")
        except Exception as error:
            errors.append(error)

    thread = threading.Thread(target=retrieve)
    thread.start()
    deadline = time.monotonic() + 1
    while not connections and time.monotonic() < deadline:
        time.sleep(0.001)
    assert connections
    connection = connections[0]
    assert isinstance(connection, BlockingConnection)
    assert connection.request_started.wait(timeout=1)

    retriever.cancel()
    thread.join(timeout=1)

    assert not thread.is_alive()
    assert connection.closed.is_set()
    assert len(errors) == 1
    assert isinstance(errors[0], JobProcessingError)
    assert errors[0].code == "workerStopping"


def test_stream_reader_rejects_oversized_body() -> None:
    response = FakeBodyResponse(b"123456")

    with pytest.raises(JobProcessingError) as raised:
        _read_bounded(response, 5)  # type: ignore[arg-type]

    assert raised.value.code == "sourceTooLarge"
