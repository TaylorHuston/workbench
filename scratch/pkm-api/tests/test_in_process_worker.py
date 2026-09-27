from __future__ import annotations

import datetime as dt
import threading
import time
from pathlib import Path

from fastapi.testclient import TestClient

from pkm_api import main as main_module
from pkm_api.application.job_leads import CreateJobLead, JobLeadService
from pkm_api.application.job_worker import InProcessJobLeadWorker
from pkm_api.domain.job_leads import JobLeadError, JobLeadOutcome, JobLeadStatus
from pkm_api.infrastructure.sqlite_job_leads import SqliteJobLeadRepository
from pkm_api.main import create_app


class CompletingProcessor:
    def __init__(self, repository: SqliteJobLeadRepository) -> None:
        self._repository = repository

    def process_next(self, *, worker_id: str) -> object | None:
        now = dt.datetime.now(dt.UTC)
        claim = self._repository.claim_next(
            worker_id=worker_id,
            now=now,
            lease_duration=dt.timedelta(minutes=1),
        )
        if claim is None:
            return None
        return self._repository.complete_claim(
            claim,
            status=JobLeadStatus.SKIPPED,
            outcome=JobLeadOutcome(
                kind="testCompleted",
                warnings=("Processed by the in-process worker.",),
            ),
            now=dt.datetime.now(dt.UTC),
        )


class FailThenCompleteProcessor:
    def __init__(self, repository: SqliteJobLeadRepository) -> None:
        self._repository = repository
        self._failed_once = False

    def process_next(self, *, worker_id: str) -> object | None:
        now = dt.datetime.now(dt.UTC)
        claim = self._repository.claim_next(
            worker_id=worker_id,
            now=now,
            lease_duration=dt.timedelta(minutes=1),
        )
        if claim is None:
            return None
        if not self._failed_once:
            self._failed_once = True
            return self._repository.fail_claim(
                claim,
                error=JobLeadError(
                    code="testFailure",
                    message="The test processor failed safely.",
                    retryable=False,
                ),
                now=dt.datetime.now(dt.UTC),
            )
        return self._repository.complete_claim(
            claim,
            status=JobLeadStatus.SKIPPED,
            outcome=JobLeadOutcome(kind="retryCompleted"),
            now=dt.datetime.now(dt.UTC),
        )


def wait_for_status(client: TestClient, job_lead_id: str, expected: str) -> dict:
    deadline = time.monotonic() + 2
    while time.monotonic() < deadline:
        response = client.get(f"/v1/job-leads/{job_lead_id}")
        assert response.status_code == 200
        payload = response.json()
        if payload["status"] == expected:
            return payload
        time.sleep(0.01)
    raise AssertionError(f"JobLead did not reach {expected}")


class FlakyProcessor:
    def __init__(self) -> None:
        self.calls = 0
        self.recovered = threading.Event()

    def process_next(self, *, worker_id: str) -> object | None:
        self.calls += 1
        if self.calls == 1:
            raise RuntimeError("transient infrastructure failure")
        self.recovered.set()
        return None


class CancellableBlockingProcessor:
    def __init__(self) -> None:
        self.started = threading.Event()
        self.cancelled = threading.Event()

    def process_next(self, *, worker_id: str) -> object | None:
        self.started.set()
        self.cancelled.wait(timeout=10)
        return None

    def cancel(self) -> None:
        self.cancelled.set()


def test_submitting_a_job_lead_immediately_wakes_the_in_process_worker(
    tmp_path: Path,
) -> None:
    database = tmp_path / "control.sqlite3"

    def worker_factory(
        repository: SqliteJobLeadRepository,
        vault_root: Path | None,
    ) -> InProcessJobLeadWorker:
        assert vault_root is None
        return InProcessJobLeadWorker(
            CompletingProcessor(repository),
            worker_id="test-worker",
            idle_poll_seconds=60,
        )

    app = create_app(
        database_path=database,
        worker_factory=worker_factory,
    )
    with TestClient(app) as client:
        created = client.post(
            "/v1/job-leads",
            headers={"Idempotency-Key": "auto-process-1"},
            json={
                "sourceUrl": "https://example.com/jobs/123",
                "discoveredBy": "manual",
            },
        )

        assert created.status_code == 201
        completed = wait_for_status(client, created.json()["id"], "skipped")

    assert completed["outcome"]["kind"] == "testCompleted"


def test_worker_drains_durable_queued_work_when_the_api_starts(
    tmp_path: Path,
) -> None:
    database = tmp_path / "control.sqlite3"
    repository = SqliteJobLeadRepository(database)
    service = JobLeadService(repository)
    service.initialize()
    queued = service.create(
        CreateJobLead(
            source_url="https://example.com/jobs/recovered",
            discovered_by="manual",
            idempotency_key="startup-recovery",
        )
    ).job_lead

    app = create_app(
        database_path=database,
        worker_factory=lambda repository, vault: InProcessJobLeadWorker(
            CompletingProcessor(repository),
            worker_id="startup-worker",
            idle_poll_seconds=60,
        ),
    )
    with TestClient(app) as client:
        completed = wait_for_status(client, queued.id, "skipped")

    assert completed["outcome"]["kind"] == "testCompleted"


def test_retrying_a_failed_lead_immediately_wakes_the_worker(
    tmp_path: Path,
) -> None:
    database = tmp_path / "control.sqlite3"
    app = create_app(
        database_path=database,
        worker_factory=lambda repository, vault: InProcessJobLeadWorker(
            FailThenCompleteProcessor(repository),
            worker_id="retry-worker",
            idle_poll_seconds=60,
        ),
    )
    with TestClient(app) as client:
        created = client.post(
            "/v1/job-leads",
            headers={"Idempotency-Key": "retry-wake-create"},
            json={
                "sourceUrl": "https://example.com/jobs/retry",
                "discoveredBy": "manual",
            },
        )
        failed = wait_for_status(client, created.json()["id"], "failed")
        retry = client.post(
            f"/v1/job-leads/{failed['id']}/retry",
            headers={
                "Idempotency-Key": "retry-wake-manual",
                "If-Match": f'"job-lead:{failed["id"]}:v{failed["version"]}"',
            },
        )

        assert retry.status_code == 200
        completed = wait_for_status(client, failed["id"], "skipped")

    assert completed["outcome"]["kind"] == "retryCompleted"


def test_worker_recovers_after_a_transient_processor_failure() -> None:
    processor = FlakyProcessor()
    worker = InProcessJobLeadWorker(
        processor,
        worker_id="flaky-worker",
        idle_poll_seconds=60,
        error_backoff_seconds=0.01,
    )

    worker.start()
    assert processor.recovered.wait(timeout=1)
    worker.stop()

    assert processor.calls >= 2
    assert worker.status == "stopped"


def test_worker_cancels_in_flight_processing_during_shutdown() -> None:
    processor = CancellableBlockingProcessor()
    worker = InProcessJobLeadWorker(
        processor,
        worker_id="blocking-worker",
        idle_poll_seconds=60,
    )
    worker.start()
    assert processor.started.wait(timeout=1)

    started = time.monotonic()
    worker.stop()

    assert time.monotonic() - started < 1
    assert processor.cancelled.is_set()
    assert worker.status == "stopped"


def test_configured_vault_uses_the_default_in_process_worker(
    tmp_path: Path,
    monkeypatch: object,
) -> None:
    database = tmp_path / "control.sqlite3"
    vault = tmp_path / "vault"
    (vault / "02-personal/career/job-market/companies").mkdir(parents=True)

    def worker_factory(
        repository: SqliteJobLeadRepository,
        vault_root: Path | None,
    ) -> InProcessJobLeadWorker:
        assert vault_root == vault
        return InProcessJobLeadWorker(
            CompletingProcessor(repository),
            worker_id="default-test-worker",
            idle_poll_seconds=60,
        )

    monkeypatch.setattr(
        main_module,
        "default_worker_factory",
        worker_factory,
        raising=False,
    )
    app = create_app(database_path=database, vault_root=vault)

    with TestClient(app) as client:
        created = client.post(
            "/v1/job-leads",
            headers={"Idempotency-Key": "auto-process-default"},
            json={
                "sourceUrl": "https://example.com/jobs/default",
                "discoveredBy": "n8n",
            },
        )
        completed = wait_for_status(client, created.json()["id"], "skipped")
        readiness = client.get("/readyz")

    assert completed["outcome"]["kind"] == "testCompleted"
    assert readiness.json()["worker"] == "running"
    assert readiness.json()["materialization"] == "confinedMarkdown"


def test_readiness_is_unavailable_when_the_configured_worker_has_failed(
    tmp_path: Path,
) -> None:
    class FailedWorker:
        status = "failed"

        def start(self) -> None:
            return None

        def wake(self) -> None:
            return None

        def stop(self) -> None:
            return None

    app = create_app(
        database_path=tmp_path / "control.sqlite3",
        worker_factory=lambda repository, vault: FailedWorker(),
    )

    with TestClient(app) as client:
        readiness = client.get("/readyz")

    assert readiness.status_code == 503
    assert readiness.json()["status"] == "notReady"
    assert readiness.json()["worker"] == "failed"
