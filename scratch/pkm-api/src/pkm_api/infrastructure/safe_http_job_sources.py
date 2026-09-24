from __future__ import annotations

import datetime as dt
import hashlib
import http.client
import ipaddress
import socket
import ssl
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
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
        self._resolver = resolver or _resolve_addresses
        self._clock = clock or (lambda: dt.datetime.now(dt.UTC))
        self._timeout_seconds = timeout_seconds
        self._max_bytes = max_bytes
        self._max_redirects = max_redirects
        self._user_agent = user_agent
        self._requester = requester or self._request

    def retrieve(self, source_url: str) -> RetrievedJobSource:
        current_url = source_url
        for redirect_count in range(self._max_redirects + 1):
            target = self._resolve_target(current_url)
            try:
                response = self._requester(
                    target,
                    {
                        "Accept": (
                            "text/html,application/xhtml+xml,application/json;q=0.9,"
                            "text/plain;q=0.8"
                        ),
                        "Accept-Encoding": "identity",
                        "Host": _host_header(target.hostname, target.port),
                        "User-Agent": self._user_agent,
                    },
                )
            except (OSError, TimeoutError, http.client.HTTPException) as error:
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

    def _resolve_target(self, value: str) -> ResolvedHttpsTarget:
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
            addresses = tuple(sorted(set(self._resolver(hostname, port))))
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
    ) -> BoundedHttpResponse:
        connection = _PinnedHttpsConnection(
            ip_address=target.addresses[0],
            server_hostname=target.hostname,
            port=target.port,
            timeout=self._timeout_seconds,
            context=ssl.create_default_context(),
        )
        try:
            connection.request("GET", target.request_target, headers=dict(headers))
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
            body = _read_bounded(response, self._max_bytes)
            response_headers = {
                key.lower(): value for key, value in response.getheaders()
            }
            return BoundedHttpResponse(
                status=response.status,
                headers=response_headers,
                body=body,
            )
        finally:
            connection.close()

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


def _read_bounded(response: http.client.HTTPResponse, maximum: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    while True:
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


def _host_header(hostname: str, port: int) -> str:
    if ":" in hostname:
        hostname = f"[{hostname}]"
    return hostname if port == 443 else f"{hostname}:{port}"
