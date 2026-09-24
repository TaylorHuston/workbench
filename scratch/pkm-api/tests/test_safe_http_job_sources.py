from __future__ import annotations

import datetime as dt
from collections.abc import Mapping
from dataclasses import dataclass

import pytest

from pkm_api.application.job_processing import JobProcessingError
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


def test_stream_reader_rejects_oversized_body() -> None:
    response = FakeBodyResponse(b"123456")

    with pytest.raises(JobProcessingError) as raised:
        _read_bounded(response, 5)  # type: ignore[arg-type]

    assert raised.value.code == "sourceTooLarge"
