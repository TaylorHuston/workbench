from __future__ import annotations

import re
from typing import Annotated, Literal
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request, Response, status

from pkm_api.application.job_leads import (
    CreateJobLead,
    JobLeadService,
    PreconditionFailedError,
    PreconditionRequiredError,
)
from pkm_api.application.job_postings import JobPostingQueryService
from pkm_api.domain.job_leads import JobLead, JobLeadStatus
from pkm_api.http.schemas import (
    CreateJobLeadRequest,
    JobLeadCollectionResponse,
    JobLeadResponse,
    JobPostingCollectionResponse,
    JobPostingStatsResponse,
    JobPostingSummaryResponse,
    ProblemDetails,
)

router = APIRouter(prefix="/v1")
_ETAG_PATTERN = re.compile(
    r'^"job-lead:(?P<id>[0-9a-f-]{36}):v(?P<version>[1-9][0-9]*)"$'
)


def get_job_lead_service(request: Request) -> JobLeadService:
    return request.app.state.job_lead_service


def get_job_posting_query_service(request: Request) -> JobPostingQueryService:
    return request.app.state.job_posting_query_service


JobLeadServiceDependency = Annotated[JobLeadService, Depends(get_job_lead_service)]
JobPostingQueryServiceDependency = Annotated[
    JobPostingQueryService, Depends(get_job_posting_query_service)
]
JobPostingLifecycle = Literal[
    "captured",
    "tracking",
    "interested",
    "applied",
    "interviewing",
    "offer",
    "closed",
]
IdempotencyKey = Annotated[
    str,
    Header(
        alias="Idempotency-Key",
        min_length=1,
        max_length=200,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:-]*$",
        description=(
            "Caller-generated key for safe retries. Reuse with different semantic "
            "input returns 409. Records expire after seven days."
        ),
    ),
]


def _problem_response(description: str) -> dict[str, object]:
    return {
        "description": description,
        "content": {
            "application/problem+json": {
                "schema": ProblemDetails.model_json_schema(by_alias=True)
            }
        },
    }


_PROBLEM_RESPONSES = {
    404: _problem_response("The requested JobLead does not exist."),
    409: _problem_response(
        "The request conflicts with idempotency or lifecycle state."
    ),
    412: _problem_response(
        "The supplied ETag is stale or does not identify this JobLead."
    ),
    422: _problem_response("The request is syntactically valid but fails validation."),
    428: _problem_response("A required conditional request header is missing."),
    500: _problem_response("An unexpected internal error occurred."),
    503: _problem_response("The local control store is temporarily unavailable."),
}


@router.get(
    "/job-postings",
    response_model=JobPostingCollectionResponse,
    tags=["JobPostings"],
    operation_id="listJobPostings",
    summary="List controlled JobPosting summaries",
    responses={
        422: _PROBLEM_RESPONSES[422],
        500: _PROBLEM_RESPONSES[500],
        503: _PROBLEM_RESPONSES[503],
    },
)
def list_job_postings(
    request: Request,
    service: JobPostingQueryServiceDependency,
    statuses: Annotated[
        list[JobPostingLifecycle] | None,
        Query(alias="status", description="Repeat to select lifecycle statuses."),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    cursor: Annotated[str | None, Query(min_length=1, max_length=1000)] = None,
) -> JobPostingCollectionResponse:
    page = service.list(statuses=statuses or (), limit=limit, cursor=cursor)
    links = {"self": str(request.url)}
    if page.next_cursor:
        links["next"] = str(request.url.include_query_params(cursor=page.next_cursor))
    return JobPostingCollectionResponse(
        items=[JobPostingSummaryResponse.from_domain(item) for item in page.items],
        next_cursor=page.next_cursor,
        links=links,
    )


@router.get(
    "/job-stats",
    response_model=JobPostingStatsResponse,
    tags=["JobPostings"],
    operation_id="getJobPostingStats",
    summary="Summarize the current controlled JobPosting catalog",
    responses={
        500: _PROBLEM_RESPONSES[500],
        503: _PROBLEM_RESPONSES[503],
    },
)
def get_job_posting_stats(
    service: JobPostingQueryServiceDependency,
) -> JobPostingStatsResponse:
    return JobPostingStatsResponse.from_domain(service.stats())


@router.post(
    "/job-leads",
    response_model=JobLeadResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["JobLeads"],
    operation_id="createJobLead",
    summary="Submit one job URL",
    description=(
        "Creates or reuses one asynchronous JobLead. The request accepts exactly "
        "one HTTPS source URL and never stores a caller-supplied description."
    ),
    responses={
        200: {
            "model": JobLeadResponse,
            "description": "An existing source or idempotent request was reused.",
            "headers": {
                "ETag": {"schema": {"type": "string"}},
                "Location": {"schema": {"type": "string"}},
                "Idempotency-Replayed": {"schema": {"type": "boolean"}},
            },
        },
        201: {
            "description": "A new JobLead was queued.",
            "headers": {
                "ETag": {"schema": {"type": "string"}},
                "Location": {"schema": {"type": "string"}},
                "Idempotency-Replayed": {"schema": {"type": "boolean"}},
            },
        },
        409: _PROBLEM_RESPONSES[409],
        422: _PROBLEM_RESPONSES[422],
        500: _PROBLEM_RESPONSES[500],
        503: _PROBLEM_RESPONSES[503],
    },
)
def create_job_lead(
    body: CreateJobLeadRequest,
    response: Response,
    service: JobLeadServiceDependency,
    idempotency_key: IdempotencyKey,
) -> JobLeadResponse:
    result = service.create(
        CreateJobLead(
            source_url=str(body.source_url),
            discovered_by=body.discovered_by,
            source_reference=body.source_reference,
            idempotency_key=idempotency_key,
        )
    )
    lead = result.job_lead
    response.status_code = (
        status.HTTP_201_CREATED if result.created else status.HTTP_200_OK
    )
    response.headers["Location"] = f"/v1/job-leads/{lead.id}"
    response.headers["ETag"] = job_lead_etag(lead)
    response.headers["Idempotency-Replayed"] = str(result.idempotency_replayed).lower()
    return JobLeadResponse.from_domain(lead)


@router.get(
    "/job-leads",
    response_model=JobLeadCollectionResponse,
    tags=["JobLeads"],
    operation_id="listJobLeads",
    summary="List JobLeads",
    description=(
        "Returns a deterministic newest-first page. Repeat the status query "
        "parameter to select several lifecycle states."
    ),
    responses={
        422: _PROBLEM_RESPONSES[422],
        500: _PROBLEM_RESPONSES[500],
        503: _PROBLEM_RESPONSES[503],
    },
)
def list_job_leads(
    service: JobLeadServiceDependency,
    statuses: Annotated[
        list[JobLeadStatus] | None,
        Query(alias="status", description="Optional repeatable lifecycle filter."),
    ] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    cursor: Annotated[str | None, Query(max_length=1000)] = None,
) -> JobLeadCollectionResponse:
    selected_statuses = statuses or []
    page = service.list(
        statuses=selected_statuses,
        limit=limit,
        cursor=cursor,
    )
    query: list[tuple[str, str | int]] = [
        ("status", item.value) for item in selected_statuses
    ]
    query.append(("limit", limit))
    self_link = f"/v1/job-leads?{urlencode(query)}"
    links = {"self": self_link}
    if page.next_cursor is not None:
        next_query = [*query, ("cursor", page.next_cursor)]
        links["next"] = f"/v1/job-leads?{urlencode(next_query)}"
    return JobLeadCollectionResponse(
        items=[JobLeadResponse.from_domain(item) for item in page.items],
        next_cursor=page.next_cursor,
        links=links,
    )


@router.get(
    "/job-leads/{job_lead_id}",
    response_model=JobLeadResponse,
    tags=["JobLeads"],
    operation_id="getJobLead",
    summary="Read one JobLead",
    responses={
        200: {
            "description": "The current JobLead representation.",
            "headers": {"ETag": {"schema": {"type": "string"}}},
        },
        304: {"description": "The supplied If-None-Match value is current."},
        404: _PROBLEM_RESPONSES[404],
        422: _PROBLEM_RESPONSES[422],
        500: _PROBLEM_RESPONSES[500],
        503: _PROBLEM_RESPONSES[503],
    },
)
def get_job_lead(
    job_lead_id: UUID,
    response: Response,
    service: JobLeadServiceDependency,
    if_none_match: Annotated[str | None, Header(alias="If-None-Match")] = None,
) -> JobLeadResponse | Response:
    lead = service.get(str(job_lead_id))
    etag = job_lead_etag(lead)
    if if_none_match == etag:
        return Response(
            status_code=status.HTTP_304_NOT_MODIFIED, headers={"ETag": etag}
        )
    response.headers["ETag"] = etag
    return JobLeadResponse.from_domain(lead)


@router.post(
    "/job-leads/{job_lead_id}/retry",
    response_model=JobLeadResponse,
    tags=["JobLeads"],
    operation_id="retryJobLead",
    summary="Retry a failed JobLead",
    description=(
        "Requeues a failed lead. If-Match prevents a retry from overwriting a "
        "newer lifecycle decision; Idempotency-Key makes caller retries safe."
    ),
    responses={
        200: {
            "description": "The failed JobLead was requeued or replayed.",
            "headers": {
                "ETag": {"schema": {"type": "string"}},
                "Idempotency-Replayed": {"schema": {"type": "boolean"}},
            },
        },
        **_PROBLEM_RESPONSES,
    },
)
def retry_job_lead(
    job_lead_id: UUID,
    response: Response,
    service: JobLeadServiceDependency,
    idempotency_key: IdempotencyKey,
    if_match: Annotated[str | None, Header(alias="If-Match")] = None,
) -> JobLeadResponse:
    identifier = str(job_lead_id)
    if if_match is None:
        raise PreconditionRequiredError("If-Match")
    expected_version = parse_job_lead_etag(if_match, identifier)
    result = service.retry(
        identifier,
        expected_version=expected_version,
        idempotency_key=idempotency_key,
    )
    response.headers["ETag"] = job_lead_etag(result.job_lead)
    response.headers["Idempotency-Replayed"] = str(result.idempotency_replayed).lower()
    return JobLeadResponse.from_domain(result.job_lead)


def job_lead_etag(lead: JobLead) -> str:
    return f'"job-lead:{lead.id}:v{lead.version}"'


def parse_job_lead_etag(value: str, expected_id: str) -> int:
    match = _ETAG_PATTERN.fullmatch(value)
    if match is None or match.group("id") != expected_id:
        raise PreconditionFailedError(expected_id)
    return int(match.group("version"))
