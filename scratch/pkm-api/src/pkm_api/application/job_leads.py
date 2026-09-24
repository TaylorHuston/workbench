from __future__ import annotations

import base64
import datetime as dt
import hashlib
import json
import re
import uuid
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Protocol
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from pkm_api.domain.job_leads import (
    JobLead,
    JobLeadSource,
    JobLeadStage,
    JobLeadStatus,
)

_LINKEDIN_JOB_PATH = re.compile(r"^/jobs/view/(?:.*-)?(\d+)/?$")
_TRACKING_QUERY_KEYS = frozenset(
    {"fbclid", "gclid", "mc_cid", "mc_eid", "ref", "trk", "trackingid"}
)
_OPAQUE_IDENTIFIER = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:/-]*$")
_IDEMPOTENCY_KEY = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]*$")
_DISCOVERY_CHANNELS = frozenset({"n8n", "email", "manual", "agent", "other"})


class JobLeadNotFoundError(LookupError):
    pass


class InvalidJobUrlError(ValueError):
    pass


class InvalidCursorError(ValueError):
    pass


class InvalidJobLeadMetadataError(ValueError):
    pass


class IdempotencyKeyConflictError(RuntimeError):
    pass


class PreconditionRequiredError(RuntimeError):
    pass


class PreconditionFailedError(RuntimeError):
    pass


class JobLeadNotRetryableError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class CreateJobLead:
    source_url: str
    discovered_by: str
    idempotency_key: str
    source_reference: str | None = None


@dataclass(frozen=True, slots=True)
class CreateJobLeadResult:
    job_lead: JobLead
    created: bool
    idempotency_replayed: bool = False


@dataclass(frozen=True, slots=True)
class RetryJobLeadResult:
    job_lead: JobLead
    idempotency_replayed: bool = False


@dataclass(frozen=True, slots=True)
class JobLeadPage:
    items: tuple[JobLead, ...]
    next_cursor: str | None


@dataclass(frozen=True, slots=True)
class CanonicalJobUrl:
    url: str
    source_key: str
    source: JobLeadSource
    posting_key: str | None


@dataclass(frozen=True, slots=True)
class JobLeadCursor:
    created_at: dt.datetime
    id: str


class JobLeadRepository(Protocol):
    def initialize(self) -> None: ...

    def create_or_get(
        self,
        lead: JobLead,
        *,
        operation: str,
        idempotency_key: str,
        request_digest: str,
        idempotency_expires_at: dt.datetime,
    ) -> CreateJobLeadResult: ...

    def get(self, job_lead_id: str) -> JobLead: ...

    def list(
        self,
        *,
        statuses: Sequence[JobLeadStatus],
        limit: int,
        cursor: JobLeadCursor | None,
    ) -> tuple[list[JobLead], bool]: ...

    def retry(
        self,
        job_lead_id: str,
        *,
        expected_version: int,
        operation: str,
        idempotency_key: str,
        request_digest: str,
        idempotency_expires_at: dt.datetime,
        now: dt.datetime,
    ) -> RetryJobLeadResult: ...


class JobLeadService:
    def __init__(
        self,
        repository: JobLeadRepository,
        *,
        clock: Callable[[], dt.datetime] | None = None,
        ttl: dt.timedelta = dt.timedelta(days=30),
        idempotency_ttl: dt.timedelta = dt.timedelta(days=7),
        max_attempts: int = 3,
    ) -> None:
        self._repository = repository
        self._clock = clock or (lambda: dt.datetime.now(dt.UTC))
        self._ttl = ttl
        self._idempotency_ttl = idempotency_ttl
        self._max_attempts = max_attempts

    def initialize(self) -> None:
        self._repository.initialize()

    def create(self, command: CreateJobLead) -> CreateJobLeadResult:
        canonical = canonicalize_job_url(command.source_url)
        discovered_by = command.discovered_by.strip()
        source_reference = (
            command.source_reference.strip()
            if command.source_reference is not None
            else None
        )
        if discovered_by not in _DISCOVERY_CHANNELS:
            raise InvalidJobLeadMetadataError("discoveredBy is unsupported")
        if not (
            1 <= len(command.idempotency_key) <= 200
            and _IDEMPOTENCY_KEY.fullmatch(command.idempotency_key)
        ):
            raise InvalidJobLeadMetadataError("Idempotency-Key is invalid")
        if source_reference is not None and not (
            1 <= len(source_reference) <= 200
            and _OPAQUE_IDENTIFIER.fullmatch(source_reference)
        ):
            raise InvalidJobLeadMetadataError("sourceReference is invalid")
        now = self._clock()
        lead = JobLead(
            id=str(uuid.uuid4()),
            version=1,
            source_url=canonical.url,
            source_key=canonical.source_key,
            source=canonical.source,
            posting_key=canonical.posting_key,
            discovered_by=discovered_by,
            source_reference=source_reference,
            status=JobLeadStatus.QUEUED,
            stage=JobLeadStage.PENDING,
            attempt_count=0,
            retry_count=0,
            max_attempts=self._max_attempts,
            next_attempt_at=now,
            last_error=None,
            outcome=None,
            created_at=now,
            updated_at=now,
            expires_at=now + self._ttl,
        )
        digest = semantic_request_digest(
            {
                "sourceUrl": canonical.url,
                "discoveredBy": discovered_by,
                "sourceReference": source_reference,
            }
        )
        return self._repository.create_or_get(
            lead,
            operation="createJobLead",
            idempotency_key=command.idempotency_key,
            request_digest=digest,
            idempotency_expires_at=now + self._idempotency_ttl,
        )

    def get(self, job_lead_id: str) -> JobLead:
        return self._repository.get(job_lead_id)

    def list(
        self,
        *,
        statuses: Sequence[JobLeadStatus] = (),
        limit: int = 25,
        cursor: str | None = None,
    ) -> JobLeadPage:
        decoded_cursor = decode_cursor(cursor) if cursor is not None else None
        items, has_more = self._repository.list(
            statuses=statuses,
            limit=limit,
            cursor=decoded_cursor,
        )
        next_cursor = None
        if has_more and items:
            last = items[-1]
            next_cursor = encode_cursor(
                JobLeadCursor(created_at=last.created_at, id=last.id)
            )
        return JobLeadPage(items=tuple(items), next_cursor=next_cursor)

    def retry(
        self,
        job_lead_id: str,
        *,
        expected_version: int,
        idempotency_key: str,
    ) -> RetryJobLeadResult:
        now = self._clock()
        digest = semantic_request_digest(
            {"jobLeadId": job_lead_id, "expectedVersion": expected_version}
        )
        return self._repository.retry(
            job_lead_id,
            expected_version=expected_version,
            operation="retryJobLead",
            idempotency_key=idempotency_key,
            request_digest=digest,
            idempotency_expires_at=now + self._idempotency_ttl,
            now=now,
        )


def canonicalize_job_url(value: str) -> CanonicalJobUrl:
    parsed = urlsplit(value)
    if parsed.scheme.lower() != "https":
        raise InvalidJobUrlError("sourceUrl must use HTTPS")
    if parsed.username is not None or parsed.password is not None:
        raise InvalidJobUrlError("sourceUrl must not contain credentials")
    if not parsed.hostname:
        raise InvalidJobUrlError("sourceUrl must include a hostname")

    try:
        hostname = parsed.hostname.encode("idna").decode("ascii").lower()
        port = parsed.port
    except (UnicodeError, ValueError) as error:
        raise InvalidJobUrlError(
            "sourceUrl contains an invalid hostname or port"
        ) from error

    normalized_hostname = hostname.removeprefix("www.")
    if normalized_hostname == "linkedin.com":
        match = _LINKEDIN_JOB_PATH.fullmatch(parsed.path)
        if match is not None:
            job_id = match.group(1)
            return CanonicalJobUrl(
                url=f"https://www.linkedin.com/jobs/view/{job_id}/",
                source_key=f"linkedin:{job_id}",
                source=JobLeadSource.LINKEDIN,
                posting_key=f"linkedin:{job_id}",
            )

    netloc = hostname if port in (None, 443) else f"{hostname}:{port}"
    query = _canonical_query(parsed.query)
    canonical_url = urlunsplit(("https", netloc, parsed.path or "/", query, ""))
    digest = hashlib.sha256(canonical_url.encode()).hexdigest()
    return CanonicalJobUrl(
        url=canonical_url,
        source_key=f"url-sha256:{digest}",
        source=_source_for_hostname(normalized_hostname),
        posting_key=None,
    )


def semantic_request_digest(value: object) -> str:
    encoded = json.dumps(
        value,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
    ).encode()
    return hashlib.sha256(encoded).hexdigest()


def encode_cursor(cursor: JobLeadCursor) -> str:
    payload = json.dumps(
        {"createdAt": cursor.created_at.isoformat(), "id": cursor.id},
        separators=(",", ":"),
    ).encode()
    return base64.urlsafe_b64encode(payload).decode().rstrip("=")


def decode_cursor(value: str) -> JobLeadCursor:
    try:
        padding = "=" * (-len(value) % 4)
        payload = json.loads(base64.urlsafe_b64decode(value + padding))
        created_at = dt.datetime.fromisoformat(payload["createdAt"])
        identifier = str(uuid.UUID(payload["id"]))
        if created_at.tzinfo is None:
            raise ValueError
    except (ValueError, TypeError, KeyError, json.JSONDecodeError) as error:
        raise InvalidCursorError("cursor is invalid or malformed") from error
    return JobLeadCursor(created_at=created_at, id=identifier)


def _canonical_query(query: str) -> str:
    retained = []
    for key, value in parse_qsl(query, keep_blank_values=True):
        normalized_key = key.lower()
        if normalized_key.startswith("utm_") or normalized_key in _TRACKING_QUERY_KEYS:
            continue
        retained.append((key, value))
    return urlencode(sorted(retained))


def _source_for_hostname(hostname: str) -> JobLeadSource:
    if hostname.endswith("greenhouse.io") or hostname.endswith("lever.co"):
        return JobLeadSource.COMPANY_SITE
    if hostname.endswith("indeed.com") or hostname.endswith("trueup.io"):
        return JobLeadSource.JOB_BOARD
    return JobLeadSource.OTHER
