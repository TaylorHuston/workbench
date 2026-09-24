from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from enum import StrEnum


class JobLeadSource(StrEnum):
    LINKEDIN = "linkedin"
    COMPANY_SITE = "company-site"
    JOB_BOARD = "job-board"
    OTHER = "other"


class JobLeadStatus(StrEnum):
    QUEUED = "queued"
    PROCESSING = "processing"
    READY_FOR_MATERIALIZATION = "readyForMaterialization"
    ALREADY_TRACKED = "alreadyTracked"
    POSSIBLE_REPOST = "possibleRepost"
    SKIPPED = "skipped"
    MATERIALIZED = "materialized"
    FAILED = "failed"


class JobLeadStage(StrEnum):
    PENDING = "pending"
    RETRIEVING = "retrieving"
    EXTRACTING = "extracting"
    DEDUPLICATING = "deduplicating"
    ASSESSING = "assessing"
    VALIDATING = "validating"
    MATERIALIZING = "materializing"
    COMPLETED = "completed"


class MaterializationStatus(StrEnum):
    NOT_READY = "notReady"
    DISABLED = "disabled"
    SUCCEEDED = "succeeded"


TERMINAL_JOB_LEAD_STATUSES = frozenset(
    {
        JobLeadStatus.READY_FOR_MATERIALIZATION,
        JobLeadStatus.ALREADY_TRACKED,
        JobLeadStatus.POSSIBLE_REPOST,
        JobLeadStatus.SKIPPED,
        JobLeadStatus.MATERIALIZED,
        JobLeadStatus.FAILED,
    }
)


@dataclass(frozen=True, slots=True)
class JobLeadError:
    code: str
    message: str
    retryable: bool


@dataclass(frozen=True, slots=True)
class JobLeadOutcome:
    kind: str
    posting_key: str | None = None
    company: str | None = None
    role: str | None = None
    warnings: tuple[str, ...] = ()
    materialization_status: MaterializationStatus = MaterializationStatus.NOT_READY


@dataclass(frozen=True, slots=True)
class JobLead:
    id: str
    version: int
    source_url: str
    source_key: str
    source: JobLeadSource
    posting_key: str | None
    discovered_by: str
    source_reference: str | None
    status: JobLeadStatus
    stage: JobLeadStage
    attempt_count: int
    retry_count: int
    max_attempts: int
    next_attempt_at: dt.datetime | None
    last_error: JobLeadError | None
    outcome: JobLeadOutcome | None
    created_at: dt.datetime
    updated_at: dt.datetime
    expires_at: dt.datetime

    @property
    def is_terminal(self) -> bool:
        return self.status in TERMINAL_JOB_LEAD_STATUSES


@dataclass(frozen=True, slots=True)
class JobLeadClaim:
    job_lead: JobLead
    worker_id: str
    lease_token: str
    lease_expires_at: dt.datetime
