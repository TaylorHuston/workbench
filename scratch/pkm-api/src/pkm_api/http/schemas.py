from __future__ import annotations

import datetime as dt
from typing import Annotated, Any, Literal

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, field_validator

from pkm_api.application.job_postings import JobPostingStats, JobPostingSummary
from pkm_api.domain.job_leads import JobLead, JobLeadError, JobLeadOutcome

OpaqueReference = Annotated[
    str,
    Field(
        min_length=1,
        max_length=200,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:/-]*$",
    ),
]


class ApiModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        use_enum_values=True,
    )


class CreateJobLeadRequest(ApiModel):
    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        json_schema_extra={
            "examples": [
                {
                    "sourceUrl": "https://www.linkedin.com/jobs/view/4470613618/",
                    "discoveredBy": "n8n",
                    "sourceReference": "apify:run-123:4470613618",
                }
            ]
        },
    )

    source_url: AnyHttpUrl = Field(alias="sourceUrl")
    discovered_by: Literal["n8n", "email", "manual", "agent", "other"] = Field(
        alias="discoveredBy"
    )
    source_reference: OpaqueReference | None = Field(
        default=None,
        alias="sourceReference",
        description="Opaque discovery identifier; never source prose or an email body.",
    )

    @field_validator("source_url")
    @classmethod
    def require_https(cls, value: AnyHttpUrl) -> AnyHttpUrl:
        if value.scheme != "https":
            raise ValueError("sourceUrl must use HTTPS")
        if value.username is not None or value.password is not None:
            raise ValueError("sourceUrl must not contain credentials")
        return value

    @field_validator("source_reference")
    @classmethod
    def strip_source_reference(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        if not stripped:
            raise ValueError("sourceReference must not be blank")
        return stripped


class JobLeadErrorResponse(ApiModel):
    code: str
    message: str
    retryable: bool

    @classmethod
    def from_domain(cls, value: JobLeadError) -> JobLeadErrorResponse:
        return cls(code=value.code, message=value.message, retryable=value.retryable)


class JobLeadOutcomeResponse(ApiModel):
    kind: str
    posting_key: str | None = Field(alias="postingKey")
    company: str | None
    role: str | None
    warnings: list[str]
    materialization_status: str = Field(alias="materializationStatus")

    @classmethod
    def from_domain(cls, value: JobLeadOutcome) -> JobLeadOutcomeResponse:
        return cls(
            kind=value.kind,
            posting_key=value.posting_key,
            company=value.company,
            role=value.role,
            warnings=list(value.warnings),
            materialization_status=value.materialization_status.value,
        )


class JobLeadResponse(ApiModel):
    id: str
    version: int
    source_url: str = Field(alias="sourceUrl")
    source: str
    posting_key: str | None = Field(alias="postingKey")
    discovered_by: str = Field(alias="discoveredBy")
    source_reference: str | None = Field(alias="sourceReference")
    status: str
    stage: str
    attempt_count: int = Field(alias="attemptCount")
    retry_count: int = Field(alias="retryCount")
    max_attempts: int = Field(alias="maxAttempts")
    next_attempt_at: dt.datetime | None = Field(alias="nextAttemptAt")
    last_error: JobLeadErrorResponse | None = Field(alias="lastError")
    outcome: JobLeadOutcomeResponse | None
    created_at: dt.datetime = Field(alias="createdAt")
    updated_at: dt.datetime = Field(alias="updatedAt")
    expires_at: dt.datetime = Field(alias="expiresAt")
    links: dict[str, str]

    @classmethod
    def from_domain(cls, lead: JobLead) -> JobLeadResponse:
        path = f"/v1/job-leads/{lead.id}"
        links = {"self": path}
        if lead.status.value == "failed":
            links["retry"] = f"{path}/retry"
        return cls(
            id=lead.id,
            version=lead.version,
            source_url=lead.source_url,
            source=lead.source.value,
            posting_key=lead.posting_key,
            discovered_by=lead.discovered_by,
            source_reference=lead.source_reference,
            status=lead.status.value,
            stage=lead.stage.value,
            attempt_count=lead.attempt_count,
            retry_count=lead.retry_count,
            max_attempts=lead.max_attempts,
            next_attempt_at=lead.next_attempt_at,
            last_error=(
                JobLeadErrorResponse.from_domain(lead.last_error)
                if lead.last_error
                else None
            ),
            outcome=(
                JobLeadOutcomeResponse.from_domain(lead.outcome)
                if lead.outcome
                else None
            ),
            created_at=lead.created_at,
            updated_at=lead.updated_at,
            expires_at=lead.expires_at,
            links=links,
        )


class JobLeadCollectionResponse(ApiModel):
    items: list[JobLeadResponse]
    next_cursor: str | None = Field(alias="nextCursor")
    links: dict[str, str]


class JobPostingSummaryResponse(ApiModel):
    posting_key: str = Field(alias="postingKey")
    company: str
    role: str
    status: str
    interest_level: int | None = Field(alias="interestLevel")
    source_url: str | None = Field(alias="sourceUrl")
    captured_date: str | None = Field(alias="capturedDate")
    role_archetype: str | None = Field(alias="roleArchetype")
    work_type: str = Field(alias="workType")
    seniority: str
    path: str

    @classmethod
    def from_domain(cls, value: JobPostingSummary) -> JobPostingSummaryResponse:
        return cls(
            posting_key=value.posting_key,
            company=value.company,
            role=value.role,
            status=value.status,
            interest_level=value.interest_level,
            source_url=value.source_url,
            captured_date=value.captured_date,
            role_archetype=value.role_archetype,
            work_type=value.work_type,
            seniority=value.seniority,
            path=value.path,
        )


class JobPostingCollectionResponse(ApiModel):
    items: list[JobPostingSummaryResponse]
    next_cursor: str | None = Field(alias="nextCursor")
    links: dict[str, str]


class JobPostingStatsResponse(ApiModel):
    total: int
    by_status: dict[str, int] = Field(alias="byStatus")
    by_role_archetype: dict[str, int] = Field(alias="byRoleArchetype")
    by_work_type: dict[str, int] = Field(alias="byWorkType")
    by_seniority: dict[str, int] = Field(alias="bySeniority")

    @classmethod
    def from_domain(cls, value: JobPostingStats) -> JobPostingStatsResponse:
        return cls(
            total=value.total,
            by_status=value.by_status,
            by_role_archetype=value.by_role_archetype,
            by_work_type=value.by_work_type,
            by_seniority=value.by_seniority,
        )


class ProblemDetails(ApiModel):
    type: str
    title: str
    status: int
    detail: str
    instance: str
    code: str
    errors: list[dict[str, Any]] | None = None
