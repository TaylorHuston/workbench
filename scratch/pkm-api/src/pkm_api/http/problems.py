from __future__ import annotations

import logging
import sqlite3
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from pkm_api.application.job_leads import (
    IdempotencyKeyConflictError,
    InvalidCursorError,
    InvalidJobLeadMetadataError,
    InvalidJobUrlError,
    JobLeadNotFoundError,
    JobLeadNotRetryableError,
    PreconditionFailedError,
    PreconditionRequiredError,
)
from pkm_api.application.job_postings import JobPostingCatalogUnavailableError

_LOGGER = logging.getLogger(__name__)


def install_problem_handlers(app: FastAPI) -> None:
    @app.exception_handler(JobLeadNotFoundError)
    async def handle_job_lead_not_found(
        request: Request, error: JobLeadNotFoundError
    ) -> JSONResponse:
        return _response(
            request,
            status=404,
            code="jobLeadNotFound",
            title="JobLead not found",
            detail=f"No JobLead exists with id {error.args[0]}.",
        )

    @app.exception_handler(IdempotencyKeyConflictError)
    async def handle_idempotency_conflict(
        request: Request, _error: IdempotencyKeyConflictError
    ) -> JSONResponse:
        return _response(
            request,
            status=409,
            code="idempotencyKeyConflict",
            title="Idempotency key conflict",
            detail="The Idempotency-Key was already used with different input.",
        )

    @app.exception_handler(JobLeadNotRetryableError)
    async def handle_not_retryable(
        request: Request, _error: JobLeadNotRetryableError
    ) -> JSONResponse:
        return _response(
            request,
            status=409,
            code="jobLeadNotRetryable",
            title="JobLead cannot be retried",
            detail="Only a failed JobLead can be manually retried.",
        )

    @app.exception_handler(PreconditionRequiredError)
    async def handle_precondition_required(
        request: Request, error: PreconditionRequiredError
    ) -> JSONResponse:
        return _response(
            request,
            status=428,
            code="preconditionRequired",
            title="Precondition required",
            detail=f"The {error.args[0]} header is required for this operation.",
        )

    @app.exception_handler(PreconditionFailedError)
    async def handle_precondition_failed(
        request: Request, _error: PreconditionFailedError
    ) -> JSONResponse:
        return _response(
            request,
            status=412,
            code="preconditionFailed",
            title="Precondition failed",
            detail="The supplied ETag is stale or does not identify this resource.",
        )

    @app.exception_handler(InvalidJobLeadMetadataError)
    async def handle_invalid_job_lead_metadata(
        request: Request, error: InvalidJobLeadMetadataError
    ) -> JSONResponse:
        return _response(
            request,
            status=422,
            code="invalidJobLeadMetadata",
            title="Invalid JobLead metadata",
            detail=str(error),
        )

    @app.exception_handler(InvalidCursorError)
    async def handle_invalid_cursor(
        request: Request, error: InvalidCursorError
    ) -> JSONResponse:
        return _response(
            request,
            status=422,
            code="invalidCursor",
            title="Cursor is invalid",
            detail=str(error),
        )

    @app.exception_handler(InvalidJobUrlError)
    async def handle_invalid_job_url(
        request: Request, error: InvalidJobUrlError
    ) -> JSONResponse:
        return _response(
            request,
            status=422,
            code="invalidSourceUrl",
            title="Source URL is invalid",
            detail=str(error),
        )

    @app.exception_handler(JobPostingCatalogUnavailableError)
    async def handle_job_catalog_unavailable(
        request: Request, error: JobPostingCatalogUnavailableError
    ) -> JSONResponse:
        return _response(
            request,
            status=503,
            code="jobCatalogUnavailable",
            title="JobPosting catalog is unavailable",
            detail=str(error),
            headers={"Retry-After": "5"},
        )

    @app.exception_handler(sqlite3.OperationalError)
    async def handle_sqlite_operational_error(
        request: Request, error: sqlite3.OperationalError
    ) -> JSONResponse:
        message = str(error).lower()
        if "locked" in message or "busy" in message:
            return _response(
                request,
                status=503,
                code="controlStoreBusy",
                title="Control store is busy",
                detail="The local control store is temporarily unavailable.",
                headers={"Retry-After": "1"},
            )
        _LOGGER.error(
            "Unhandled SQLite operational failure",
            extra={"exception_type": type(error).__name__},
        )
        return _response(
            request,
            status=500,
            code="internalError",
            title="Internal server error",
            detail="The request could not be completed.",
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(
        request: Request, error: Exception
    ) -> JSONResponse:
        _LOGGER.error(
            "Unhandled API failure",
            extra={"exception_type": type(error).__name__},
        )
        return _response(
            request,
            status=500,
            code="internalError",
            title="Internal server error",
            detail="The request could not be completed.",
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, error: RequestValidationError
    ) -> JSONResponse:
        errors = [
            {
                "pointer": "/" + "/".join(str(part) for part in item["loc"]),
                "message": item["msg"],
                "type": item["type"],
            }
            for item in error.errors()
        ]
        return _response(
            request,
            status=422,
            code="validationFailed",
            title="Request validation failed",
            detail="One or more request fields are invalid.",
            errors=errors,
        )


def _response(
    request: Request,
    *,
    status: int,
    code: str,
    title: str,
    detail: str,
    errors: list[dict[str, Any]] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    content: dict[str, Any] = {
        "type": f"urn:pkm-api:problem:{code}",
        "title": title,
        "status": status,
        "detail": detail,
        "instance": request.url.path,
        "code": code,
    }
    if errors is not None:
        content["errors"] = errors
    return JSONResponse(
        status_code=status,
        content=content,
        headers=headers,
        media_type="application/problem+json",
    )
