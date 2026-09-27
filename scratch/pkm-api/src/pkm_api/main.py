from __future__ import annotations

import datetime as dt
import os
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Response, status

from pkm_api.application.job_leads import JobLeadService
from pkm_api.application.job_postings import (
    JobPostingCatalogUnavailableError,
    JobPostingQueryService,
    JobPostingSummary,
)
from pkm_api.application.job_worker import BackgroundJobLeadWorker
from pkm_api.http.problems import install_problem_handlers
from pkm_api.http.routes import router
from pkm_api.infrastructure.codex_auth import CodexAuthenticationError
from pkm_api.infrastructure.job_worker_runtime import (
    build_default_in_process_worker,
)
from pkm_api.infrastructure.markdown_job_catalog import MarkdownJobPostingCatalog
from pkm_api.infrastructure.sqlite_job_leads import SqliteJobLeadRepository

WorkerFactory = Callable[
    [SqliteJobLeadRepository, Path | None],
    BackgroundJobLeadWorker,
]


def default_worker_factory(
    repository: SqliteJobLeadRepository,
    vault_root: Path | None,
) -> BackgroundJobLeadWorker:
    try:
        return build_default_in_process_worker(repository, vault_root)
    except CodexAuthenticationError:
        raise RuntimeError(
            "The in-process worker could not verify ChatGPT authentication."
        ) from None
    except (OSError, RuntimeError, ValueError):
        raise RuntimeError("The in-process worker preflight failed.") from None


class _UnavailableJobPostingCatalog:
    def list_summaries(self) -> list[JobPostingSummary]:
        raise JobPostingCatalogUnavailableError(
            "Configure PKM_API_VAULT_ROOT to enable JobPosting reads."
        )


def create_app(
    *,
    database_path: Path | None = None,
    vault_root: Path | None = None,
    worker_factory: WorkerFactory | None = None,
    worker_enabled: bool | None = None,
) -> FastAPI:
    control_database = database_path or Path(
        os.environ.get("PKM_API_CONTROL_DB", ".local/pkm-api.sqlite3")
    )
    configured_vault = vault_root
    if configured_vault is None and os.environ.get("PKM_API_VAULT_ROOT"):
        configured_vault = Path(os.environ["PKM_API_VAULT_ROOT"])
    repository = SqliteJobLeadRepository(control_database)
    should_start_worker = (
        worker_enabled
        if worker_enabled is not None
        else worker_factory is not None or configured_vault is not None
    )
    selected_worker_factory = worker_factory or default_worker_factory
    worker_holder: dict[str, BackgroundJobLeadWorker | None] = {"worker": None}

    def wake_worker() -> None:
        worker = worker_holder["worker"]
        if worker is not None:
            worker.wake()

    service = JobLeadService(repository, on_work_available=wake_worker)
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
        worker = (
            selected_worker_factory(repository, configured_vault)
            if should_start_worker
            else None
        )
        worker_holder["worker"] = worker
        app.state.job_lead_worker = worker
        if worker is not None:
            worker.start()
        try:
            yield
        finally:
            if worker is not None:
                worker.stop()
            worker_holder["worker"] = None

    app = FastAPI(
        title="PKM API",
        summary="Controlled and composable API for PKM workflows",
        description=(
            "Local-only API for controlled JobLead intake and read-only JobPosting "
            "views. Raw descriptions are rejected, an in-process worker immediately "
            "starts tool-denied isolated assessment, and validated unique postings "
            "are materialized through confined create-only vault writes. "
            "Inbound authentication is not implemented, so non-loopback binding is "
            "prohibited by the packaged server command."
        ),
        version="0.5.0",
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
    def readiness(response: Response) -> dict[str, str]:
        worker = worker_holder["worker"]
        worker_status = worker.status if worker is not None else "notConfigured"
        worker_ready = not should_start_worker or worker_status == "running"
        if not worker_ready:
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "ready" if worker_ready else "notReady",
            "controlStore": "ready",
            "jobCatalog": "ready" if configured_vault else "notConfigured",
            "worker": worker_status,
            "assessment": (
                "toolDeniedIsolation" if worker is not None else "notConfigured"
            ),
            "materialization": (
                "confinedMarkdown" if worker is not None else "notConfigured"
            ),
            "inboundAuthentication": "disabled",
        }

    return app


app = create_app()
