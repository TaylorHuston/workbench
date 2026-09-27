from __future__ import annotations

import datetime as dt
import hashlib
import http.client
import ipaddress
import socket
import ssl
import threading
import time
from collections.abc import Callable, Mapping, Sequence
from contextlib import suppress
from dataclasses import dataclass
from functools import partial
from queue import Empty, Queue
from typing import TypeVar, cast
from urllib.parse import urljoin, urlsplit

from pkm_api.application.job_processing import (
    JobProcessingError,
    RetrievedJobSource,
)

_ALLOWED_MEDIA_TYPES = frozenset(
    {"text/html", "application/xhtml+xml", "text/plain", "application/json"}
)
_REDIRECT_STATUSES = frozenset({301, 302, 303, 307, 308})


@dataclass(frozen=True, slots=True)
class ResolvedHttpsTarget:
    url: str
    hostname: str
    port: int
    request_target: str
    addresses: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class BoundedHttpResponse:
    status: int
    headers: Mapping[str, str]
    body: bytes


Resolver = Callable[[str, int], Sequence[str]]
Requester = Callable[[ResolvedHttpsTarget, Mapping[str, str]], BoundedHttpResponse]
Clock = Callable[[], dt.datetime]
T = TypeVar("T")


class SafeHttpJobSourceRetriever:
    def __init__(
        self,
        *,
        resolver: Resolver | None = None,
        requester: Requester | None = None,
        clock: Clock | None = None,
        timeout_seconds: float = 15.0,
        max_bytes: int = 2 * 1024 * 1024,
        max_redirects: int = 3,
        user_agent: str = "pkm-api-job-source/0.1",
    ) -> None:
        if timeout_seconds <= 0:
            raise ValueError("timeout_seconds must be positive")
        self._resolver = resolver or _resolve_addresses
        self._clock = clock or (lambda: dt.datetime.now(dt.UTC))
        self._timeout_seconds = timeout_seconds
        self._max_bytes = max_bytes
        self._max_redirects = max_redirects
        self._user_agent = user_agent
        self._requester = requester
        self._cancelled = threading.Event()
        self._connection_lock = threading.Lock()
        self._active_connection: _PinnedHttpsConnection | None = None

    def cancel(self) -> None:
        self._cancelled.set()
        self._close_active_connection()

    def retrieve(self, source_url: str) -> RetrievedJobSource:
        deadline = time.monotonic() + self._timeout_seconds
        current_url = source_url
        for redirect_count in range(self._max_redirects + 1):
            target = self._resolve_target(current_url, deadline=deadline)
            headers = {
                "Accept": (
                    "text/html,application/xhtml+xml,"
                    "application/json;q=0.9,text/plain;q=0.8"
                ),
                "Accept-Encoding": "identity",
                "Host": _host_header(target.hostname, target.port),
                "User-Agent": self._user_agent,
            }
            try:
                if self._requester is None:
                    response = self._request(target, headers, deadline=deadline)
                else:
                    response = self._run_bounded(
                        partial(self._requester, target, headers),
                        deadline=deadline,
                        timeout_code="sourceUnavailable",
                        timeout_message="The job source could not be retrieved.",
                    )
            except (OSError, TimeoutError, http.client.HTTPException) as error:
                if self._cancelled.is_set():
                    self._raise_cancelled()
                raise JobProcessingError(
                    "sourceUnavailable",
                    "The job source could not be retrieved.",
                    retryable=True,
                ) from error

            if response.status in _REDIRECT_STATUSES:
                location = response.headers.get("location")
                if not location:
                    raise JobProcessingError(
                        "invalidSourceRedirect",
                        "The job source returned an invalid redirect.",
                        retryable=False,
                    )
                if redirect_count >= self._max_redirects:
                    raise JobProcessingError(
                        "tooManySourceRedirects",
                        "The job source exceeded the redirect limit.",
                        retryable=False,
                    )
                current_url = urljoin(current_url, location)
                continue

            if response.status != 200:
                retryable = response.status in {408, 425, 429} or response.status >= 500
                raise JobProcessingError(
                    "sourceHttpError",
                    f"The job source returned HTTP {response.status}.",
                    retryable=retryable,
                )

            media_type = (
                response.headers.get("content-type", "")
                .split(";", 1)[0]
                .strip()
                .lower()
            )
            if media_type not in _ALLOWED_MEDIA_TYPES:
                raise JobProcessingError(
                    "unsupportedSourceContent",
                    "The job source returned an unsupported content type.",
                    retryable=False,
                )
            if not response.body:
                raise JobProcessingError(
                    "emptySource",
                    "The job source returned an empty response.",
                    retryable=False,
                )
            return RetrievedJobSource(
                requested_url=source_url,
                final_url=current_url,
                media_type=media_type,
                body=response.body,
                sha256=hashlib.sha256(response.body).hexdigest(),
                retrieved_at=self._clock(),
            )

        raise AssertionError("redirect loop must return or raise")

    def _resolve_target(
        self,
        value: str,
        *,
        deadline: float,
    ) -> ResolvedHttpsTarget:
        parsed = urlsplit(value)
        if parsed.scheme.lower() != "https":
            self._blocked("Job source URLs must use HTTPS.")
        if parsed.username is not None or parsed.password is not None:
            self._blocked("Job source URLs must not contain credentials.")
        if not parsed.hostname:
            self._blocked("The job source URL has no hostname.")
        try:
            hostname = parsed.hostname.encode("idna").decode("ascii").lower()
            port = parsed.port or 443
        except (UnicodeError, ValueError) as error:
            raise JobProcessingError(
                "blockedSourceAddress",
                "The job source hostname or port is invalid.",
                retryable=False,
            ) from error
        if port != 443:
            self._blocked("Only the standard HTTPS port is allowed.")
        if (
            hostname == "localhost"
            or hostname.endswith(".localhost")
            or hostname.endswith(".local")
        ):
            self._blocked("The job source hostname is not publicly routable.")

        try:
            resolved = self._run_bounded(
                lambda: self._resolver(hostname, port),
                deadline=deadline,
                timeout_code="sourceDnsFailure",
                timeout_message="The job source hostname could not be resolved.",
            )
            addresses = tuple(sorted(set(resolved)))
        except OSError as error:
            raise JobProcessingError(
                "sourceDnsFailure",
                "The job source hostname could not be resolved.",
                retryable=True,
            ) from error
        if not addresses:
            raise JobProcessingError(
                "sourceDnsFailure",
                "The job source hostname did not resolve to an address.",
                retryable=True,
            )
        for address in addresses:
            try:
                parsed_address = ipaddress.ip_address(address)
            except ValueError as error:
                raise JobProcessingError(
                    "sourceDnsFailure",
                    "The job source resolved to an invalid address.",
                    retryable=True,
                ) from error
            if not parsed_address.is_global:
                self._blocked("The job source resolved to a non-public address.")

        request_target = parsed.path or "/"
        if parsed.query:
            request_target = f"{request_target}?{parsed.query}"
        return ResolvedHttpsTarget(
            url=value,
            hostname=hostname,
            port=port,
            request_target=request_target,
            addresses=addresses,
        )

    def _request(
        self,
        target: ResolvedHttpsTarget,
        headers: Mapping[str, str],
        *,
        deadline: float,
    ) -> BoundedHttpResponse:
        timeout = self._remaining_seconds(deadline)
        connection = _PinnedHttpsConnection(
            ip_address=target.addresses[0],
            server_hostname=target.hostname,
            port=target.port,
            timeout=timeout,
            context=ssl.create_default_context(),
        )
        with self._connection_lock:
            if self._cancelled.is_set():
                connection.close()
                self._raise_cancelled()
            self._active_connection = connection
        deadline_timer = threading.Timer(
            self._remaining_seconds(deadline),
            self._abort_connection,
            args=(connection,),
        )
        deadline_timer.daemon = True
        deadline_timer.start()
        try:
            self._apply_connection_timeout(connection, deadline)
            connection.request("GET", target.request_target, headers=dict(headers))
            self._apply_connection_timeout(connection, deadline)
            response = connection.getresponse()
            content_length = response.getheader("Content-Length")
            if content_length is not None:
                try:
                    declared_length = int(content_length)
                except ValueError as error:
                    raise JobProcessingError(
                        "invalidSourceResponse",
                        "The job source returned an invalid response length.",
                        retryable=False,
                    ) from error
                if declared_length < 0:
                    raise JobProcessingError(
                        "invalidSourceResponse",
                        "The job source returned an invalid response length.",
                        retryable=False,
                    )
                if declared_length > self._max_bytes:
                    raise JobProcessingError(
                        "sourceTooLarge",
                        "The job source exceeded the response-size limit.",
                        retryable=False,
                    )
            body = _read_bounded(
                response,
                self._max_bytes,
                deadline=deadline,
                cancelled=self._cancelled,
            )
            response_headers = {
                key.lower(): value for key, value in response.getheaders()
            }
            return BoundedHttpResponse(
                status=response.status,
                headers=response_headers,
                body=body,
            )
        finally:
            deadline_timer.cancel()
            deadline_timer.join(timeout=0.1)
            with self._connection_lock:
                if self._active_connection is connection:
                    self._active_connection = None
            connection.close()

    def _run_bounded(
        self,
        operation: Callable[[], T],
        *,
        deadline: float,
        timeout_code: str,
        timeout_message: str,
    ) -> T:
        if self._cancelled.is_set():
            self._raise_cancelled()
        results: Queue[tuple[bool, object]] = Queue(maxsize=1)

        def run() -> None:
            try:
                if self._cancelled.is_set():
                    self._raise_cancelled()
                if time.monotonic() >= deadline:
                    raise JobProcessingError(
                        timeout_code,
                        timeout_message,
                        retryable=True,
                    )
                results.put((True, operation()))
            except Exception as error:
                results.put((False, error))

        threading.Thread(
            target=run,
            name="pkm-api-source-operation",
            daemon=True,
        ).start()
        while True:
            if self._cancelled.is_set():
                self._close_active_connection()
                self._raise_cancelled()
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                self._close_active_connection()
                raise JobProcessingError(
                    timeout_code,
                    timeout_message,
                    retryable=True,
                )
            try:
                succeeded, value = results.get(timeout=min(0.01, remaining))
            except Empty:
                continue
            if succeeded:
                return cast(T, value)
            raise cast(Exception, value)

    def _apply_connection_timeout(
        self,
        connection: _PinnedHttpsConnection,
        deadline: float,
    ) -> None:
        timeout = self._remaining_seconds(deadline)
        connection.timeout = timeout
        if connection.sock is not None:
            connection.sock.settimeout(timeout)

    def _remaining_seconds(self, deadline: float) -> float:
        if self._cancelled.is_set():
            self._raise_cancelled()
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError("The source retrieval deadline expired.")
        return remaining

    def _close_active_connection(self) -> None:
        with self._connection_lock:
            connection = self._active_connection
        if connection is not None:
            self._abort_connection(connection)

    @staticmethod
    def _abort_connection(connection: _PinnedHttpsConnection) -> None:
        if connection.sock is not None:
            with suppress(OSError):
                connection.sock.shutdown(socket.SHUT_RDWR)
        connection.close()

    @staticmethod
    def _raise_cancelled() -> None:
        raise JobProcessingError(
            "workerStopping",
            "Job source retrieval stopped for worker shutdown.",
            retryable=True,
        )

    @staticmethod
    def _blocked(message: str) -> None:
        raise JobProcessingError(
            "blockedSourceAddress",
            message,
            retryable=False,
        )


class _PinnedHttpsConnection(http.client.HTTPSConnection):
    def __init__(
        self,
        *,
        ip_address: str,
        server_hostname: str,
        port: int,
        timeout: float,
        context: ssl.SSLContext,
    ) -> None:
        super().__init__(
            host=ip_address,
            port=port,
            timeout=timeout,
            context=context,
        )
        self._tls_server_hostname = server_hostname

    def connect(self) -> None:
        self.sock = socket.create_connection(
            (self.host, self.port),
            self.timeout,
            self.source_address,
        )
        if self._tunnel_host:
            self._tunnel()
        self.sock = self._context.wrap_socket(
            self.sock,
            server_hostname=self._tls_server_hostname,
        )


def _resolve_addresses(hostname: str, port: int) -> Sequence[str]:
    return [
        item[4][0]
        for item in socket.getaddrinfo(
            hostname,
            port,
            type=socket.SOCK_STREAM,
            proto=socket.IPPROTO_TCP,
        )
    ]


def _read_bounded(
    response: http.client.HTTPResponse,
    maximum: int,
    *,
    deadline: float | None = None,
    cancelled: threading.Event | None = None,
) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
        if cancelled is not None and cancelled.is_set():
            raise JobProcessingError(
                "workerStopping",
                "Job source retrieval stopped for worker shutdown.",
                retryable=True,
            )
        if deadline is not None:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError("The source retrieval deadline expired.")
            _set_response_timeout(response, remaining)
        chunk = response.read(min(64 * 1024, maximum + 1 - total))
        if not chunk:
            return b"".join(chunks)
        total += len(chunk)
        if total > maximum:
            raise JobProcessingError(
                "sourceTooLarge",
                "The job source exceeded the response-size limit.",
                retryable=False,
            )
        chunks.append(chunk)


def _set_response_timeout(response: http.client.HTTPResponse, timeout: float) -> None:
    buffered = getattr(response, "fp", None)
    raw = getattr(buffered, "raw", None)
    sock = getattr(raw, "_sock", None)
    if sock is not None:
        sock.settimeout(timeout)


def _host_header(hostname: str, port: int) -> str:
    if ":" in hostname:
        hostname = f"[{hostname}]"
    return hostname if port == 443 else f"{hostname}:{port}"
