from __future__ import annotations

import datetime as dt
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from pkm_api.application.job_leads import JobLeadService
from pkm_api.application.job_postings import (
    JobPostingCatalogUnavailableError,
    JobPostingQueryService,
    JobPostingSummary,
)
from pkm_api.http.problems import install_problem_handlers
from pkm_api.http.routes import router
from pkm_api.infrastructure.markdown_job_catalog import MarkdownJobPostingCatalog
from pkm_api.infrastructure.sqlite_job_leads import SqliteJobLeadRepository


class _UnavailableJobPostingCatalog:
    def list_summaries(self) -> list[JobPostingSummary]:
        raise JobPostingCatalogUnavailableError(
            "Configure PKM_API_VAULT_ROOT to enable JobPosting reads."
        )


def create_app(
    *,
    database_path: Path | None = None,
    vault_root: Path | None = None,
) -> FastAPI:
    control_database = database_path or Path(
        os.environ.get("PKM_API_CONTROL_DB", ".local/pkm-api.sqlite3")
    )
    configured_vault = vault_root
    if configured_vault is None and os.environ.get("PKM_API_VAULT_ROOT"):
        configured_vault = Path(os.environ["PKM_API_VAULT_ROOT"])
    repository = SqliteJobLeadRepository(control_database)
    service = JobLeadService(repository)
    posting_catalog = (
        MarkdownJobPostingCatalog(configured_vault)
        if configured_vault is not None
        else _UnavailableJobPostingCatalog()
    )
    posting_query_service = JobPostingQueryService(posting_catalog)

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        service.initialize()
        repository.purge_expired(now=dt.datetime.now(dt.UTC))
        app.state.job_lead_service = service
        app.state.job_lead_repository = repository
        app.state.job_posting_query_service = posting_query_service
        yield

    app = FastAPI(
        title="PKM API",
        summary="Controlled and composable API for PKM workflows",
        description=(
            "Local-only API for controlled JobLead intake and read-only JobPosting "
            "views. Raw descriptions are rejected, processing is held pending an "
            "isolated assessor, and vault materialization remains disabled. "
            "Inbound authentication is not implemented, so non-loopback binding is "
            "prohibited by the packaged server command."
        ),
        version="0.2.0",
        openapi_tags=[
            {"name": "Operations", "description": "Liveness and readiness probes."},
            {
                "name": "JobPostings",
                "description": (
                    "Read-only controlled views of authoritative vault records."
                ),
            },
            {
                "name": "JobLeads",
                "description": (
                    "Transient, idempotent resources for asynchronous processing of "
                    "one HTTPS job URL."
                ),
            },
        ],
        servers=[{"url": "http://127.0.0.1:8000", "description": "Local only"}],
        lifespan=lifespan,
    )
    install_problem_handlers(app)
    app.include_router(router)

    @app.get(
        "/healthz",
        tags=["Operations"],
        operation_id="getLiveness",
        summary="Process liveness",
    )
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get(
        "/readyz",
        tags=["Operations"],
        operation_id="getReadiness",
        summary="Local control-plane readiness",
    )
    def readiness() -> dict[str, str]:
        return {
            "status": "ready",
            "controlStore": "ready",
            "jobCatalog": "ready" if configured_vault else "notConfigured",
            "worker": "notConfigured",
            "assessment": "disabledForIsolation",
            "materialization": "disabled",
            "inboundAuthentication": "disabled",
        }

    return app


app = create_app()
