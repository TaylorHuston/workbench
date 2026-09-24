from __future__ import annotations

import datetime as dt
import sqlite3
from collections.abc import Iterator
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient

from pkm_api.application.job_leads import (
    CreateJobLead,
    InvalidJobLeadMetadataError,
)
from pkm_api.domain.job_leads import JobLeadError
from pkm_api.infrastructure.sqlite_job_leads import (
    SqliteJobLeadRepository,
    UnsupportedControlStoreVersionError,
)
from pkm_api.main import create_app


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    app = create_app(database_path=tmp_path / "control.sqlite3")
    with TestClient(app) as test_client:
        yield test_client


def create_job_lead(
    client: TestClient,
    *,
    idempotency_key: str = "job-lead:linkedin:4470613618",
    source_url: str = (
        "https://www.linkedin.com/jobs/view/"
        "platform-engineer-at-example-corp-4470613618"
    ),
) -> tuple[dict[str, object], str]:
    response = client.post(
        "/v1/job-leads",
        headers={"Idempotency-Key": idempotency_key},
        json={
            "sourceUrl": source_url,
            "discoveredBy": "n8n",
            "sourceReference": "apify:run-123:4470613618",
        },
    )
    assert response.status_code == 201
    return response.json(), response.headers["etag"]


def test_health_and_openapi_document_the_job_api(client: TestClient) -> None:
    assert client.get("/healthz").json() == {"status": "ok"}

    openapi = client.get("/openapi.json")

    assert openapi.status_code == 200
    document = openapi.json()
    assert document["openapi"].startswith("3.1")
    assert document["info"]["title"] == "PKM API"
    assert document["paths"]["/v1/job-leads"]["post"]["operationId"] == (
        "createJobLead"
    )
    create_operation = document["paths"]["/v1/job-leads"]["post"]
    parameters = create_operation["parameters"]
    assert any(item["name"] == "Idempotency-Key" for item in parameters)
    assert set(create_operation["responses"]["409"]["content"]) == {
        "application/problem+json"
    }
    assert "/v1/job-leads/{job_lead_id}/retry" in document["paths"]


def test_create_and_conditionally_read_single_link_job_lead(
    client: TestClient,
) -> None:
    lead, etag = create_job_lead(client)

    assert lead["version"] == 1
    assert lead["source"] == "linkedin"
    assert lead["sourceUrl"] == "https://www.linkedin.com/jobs/view/4470613618/"
    assert lead["postingKey"] == "linkedin:4470613618"
    assert lead["status"] == "queued"
    assert lead["stage"] == "pending"
    assert lead["attemptCount"] == 0
    assert lead["links"]["self"] == f"/v1/job-leads/{lead['id']}"

    fetched = client.get(f"/v1/job-leads/{lead['id']}")
    unchanged = client.get(
        f"/v1/job-leads/{lead['id']}", headers={"If-None-Match": etag}
    )

    assert fetched.status_code == 200
    assert fetched.headers["etag"] == etag
    assert fetched.json() == lead
    assert unchanged.status_code == 304
    assert unchanged.content == b""


def test_same_idempotency_key_replays_and_changed_input_conflicts(
    client: TestClient,
) -> None:
    lead, etag = create_job_lead(client)

    replay = client.post(
        "/v1/job-leads",
        headers={"Idempotency-Key": "job-lead:linkedin:4470613618"},
        json={
            "sourceUrl": "https://linkedin.com/jobs/view/4470613618/?trk=alert",
            "discoveredBy": "n8n",
            "sourceReference": "apify:run-123:4470613618",
        },
    )
    conflict = client.post(
        "/v1/job-leads",
        headers={"Idempotency-Key": "job-lead:linkedin:4470613618"},
        json={
            "sourceUrl": "https://www.linkedin.com/jobs/view/9999999999/",
            "discoveredBy": "manual",
        },
    )

    assert replay.status_code == 200
    assert replay.headers["idempotency-replayed"] == "true"
    assert replay.headers["etag"] == etag
    assert replay.json() == lead
    assert conflict.status_code == 409
    assert conflict.headers["content-type"].startswith("application/problem+json")
    assert conflict.json()["code"] == "idempotencyKeyConflict"


def test_other_discovery_channel_matches_published_schema(client: TestClient) -> None:
    response = client.post(
        "/v1/job-leads",
        headers={"Idempotency-Key": "other-channel"},
        json={
            "sourceUrl": "https://example.com/job/other",
            "discoveredBy": "other",
        },
    )

    assert response.status_code == 201
    assert response.json()["discoveredBy"] == "other"


def test_same_source_with_a_new_key_reuses_existing_job_lead(
    client: TestClient,
) -> None:
    lead, etag = create_job_lead(client)

    duplicate = client.post(
        "/v1/job-leads",
        headers={"Idempotency-Key": "gmail:message-456:4470613618"},
        json={
            "sourceUrl": "https://linkedin.com/jobs/view/4470613618/?trk=alert",
            "discoveredBy": "email",
            "sourceReference": "gmail:message-456",
        },
    )

    assert duplicate.status_code == 200
    assert duplicate.headers["location"] == f"/v1/job-leads/{lead['id']}"
    assert duplicate.headers["etag"] == etag
    assert duplicate.headers["idempotency-replayed"] == "false"
    assert duplicate.json() == lead


def test_idempotency_key_is_required_and_bounded(client: TestClient) -> None:
    body = {
        "sourceUrl": "https://www.linkedin.com/jobs/view/4470613618/",
        "discoveredBy": "manual",
    }

    missing = client.post("/v1/job-leads", json=body)
    invalid = client.post(
        "/v1/job-leads",
        headers={"Idempotency-Key": "contains whitespace"},
        json=body,
    )

    assert missing.status_code == 422
    assert invalid.status_code == 422
    assert missing.json()["code"] == "validationFailed"


def test_collection_payload_raw_description_and_non_https_are_rejected(
    client: TestClient,
) -> None:
    collection = client.post(
        "/v1/job-leads",
        headers={"Idempotency-Key": "bad-collection"},
        json={
            "sourceUrls": ["https://www.linkedin.com/jobs/view/4470613618/"],
            "discoveredBy": "n8n",
            "rawDescription": "do not retain this",
        },
    )
    insecure = client.post(
        "/v1/job-leads",
        headers={"Idempotency-Key": "bad-http"},
        json={
            "sourceUrl": "http://www.linkedin.com/jobs/view/4470613618/",
            "discoveredBy": "manual",
        },
    )

    assert collection.status_code == 422
    assert collection.headers["content-type"].startswith("application/problem+json")
    assert collection.json()["code"] == "validationFailed"
    assert insecure.status_code == 422
    assert insecure.json()["code"] == "validationFailed"


def test_list_filters_and_uses_a_stable_cursor(client: TestClient) -> None:
    first, _ = create_job_lead(client)
    second, _ = create_job_lead(
        client,
        idempotency_key="job-lead:linkedin:4470613619",
        source_url="https://www.linkedin.com/jobs/view/4470613619/",
    )

    page_one = client.get("/v1/job-leads", params={"status": "queued", "limit": 1})

    assert page_one.status_code == 200
    assert [item["id"] for item in page_one.json()["items"]] == [second["id"]]
    next_link = page_one.json()["links"]["next"]
    query = parse_qs(urlsplit(next_link).query)
    page_two = client.get(
        "/v1/job-leads",
        params={"status": "queued", "limit": 1, "cursor": query["cursor"][0]},
    )
    assert [item["id"] for item in page_two.json()["items"]] == [first["id"]]
    assert page_two.json()["nextCursor"] is None

    invalid = client.get("/v1/job-leads", params={"cursor": "not-a-cursor"})
    assert invalid.status_code == 422
    assert invalid.json()["code"] == "invalidCursor"


def test_retry_requires_current_etag_and_is_idempotent(client: TestClient) -> None:
    lead, queued_etag = create_job_lead(client)
    repository = client.app.state.job_lead_repository
    now = dt.datetime.now(dt.UTC)
    claim = repository.claim_next(
        worker_id="test-worker",
        now=now,
        lease_duration=dt.timedelta(minutes=1),
    )
    assert claim is not None
    failed = repository.fail_claim(
        claim,
        error=JobLeadError(
            code="unsupportedSource", message="Unsupported", retryable=False
        ),
        now=now + dt.timedelta(seconds=1),
    )
    failed_etag = f'"job-lead:{lead["id"]}:v{failed.version}"'

    missing = client.post(
        f"/v1/job-leads/{lead['id']}/retry",
        headers={"Idempotency-Key": "retry-1"},
    )
    stale = client.post(
        f"/v1/job-leads/{lead['id']}/retry",
        headers={"Idempotency-Key": "retry-1", "If-Match": queued_etag},
    )
    retried = client.post(
        f"/v1/job-leads/{lead['id']}/retry",
        headers={"Idempotency-Key": "retry-1", "If-Match": failed_etag},
    )
    replay = client.post(
        f"/v1/job-leads/{lead['id']}/retry",
        headers={"Idempotency-Key": "retry-1", "If-Match": failed_etag},
    )

    assert missing.status_code == 428
    assert stale.status_code == 412
    assert retried.status_code == 200
    assert retried.json()["status"] == "queued"
    assert retried.json()["retryCount"] == 1
    assert replay.status_code == 200
    assert replay.headers["idempotency-replayed"] == "true"


def test_sqlite_control_state_survives_app_restart(tmp_path: Path) -> None:
    database_path = tmp_path / "control.sqlite3"
    with TestClient(create_app(database_path=database_path)) as first_client:
        lead, _ = create_job_lead(first_client)

    with TestClient(create_app(database_path=database_path)) as second_client:
        fetched = second_client.get(f"/v1/job-leads/{lead['id']}")

    assert fetched.status_code == 200
    assert fetched.json()["id"] == lead["id"]


def test_v1_database_is_migrated_without_losing_leads(tmp_path: Path) -> None:
    database_path = tmp_path / "control.sqlite3"
    lead_id = "8fa85f64-5717-4562-b3fc-2c963f66afa6"
    timestamp = "2026-09-22T12:00:00+00:00"
    with sqlite3.connect(database_path) as connection:
        connection.executescript(
            """
            CREATE TABLE job_leads (
                id TEXT PRIMARY KEY,
                version INTEGER NOT NULL,
                source_url TEXT NOT NULL,
                source_key TEXT NOT NULL UNIQUE,
                source TEXT NOT NULL,
                posting_key TEXT,
                discovered_by TEXT NOT NULL,
                source_reference TEXT,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                expires_at TEXT NOT NULL
            );
            """
        )
        connection.execute("PRAGMA user_version = 1")
        connection.execute(
            """
            INSERT INTO job_leads VALUES (?, 1, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?)
            """,
            (
                lead_id,
                "https://www.linkedin.com/jobs/view/123/",
                "linkedin:123",
                "linkedin",
                "linkedin:123",
                "manual",
                "queued",
                timestamp,
                timestamp,
                "2026-10-22T12:00:00+00:00",
            ),
        )

    with TestClient(create_app(database_path=database_path)) as migrated_client:
        fetched = migrated_client.get(f"/v1/job-leads/{lead_id}")

    assert fetched.status_code == 200
    assert fetched.json()["stage"] == "pending"
    assert fetched.json()["attemptCount"] == 0


def test_operational_and_unexpected_failures_use_sanitized_problem_details(
    client: TestClient,
) -> None:
    class BrokenService:
        def __init__(self, error: Exception) -> None:
            self.error = error

        def create(self, command: object) -> None:
            raise self.error

    body = {
        "sourceUrl": "https://www.linkedin.com/jobs/view/123/",
        "discoveredBy": "manual",
    }
    client.app.state.job_lead_service = BrokenService(
        sqlite3.OperationalError("database is locked: PRIVATE")
    )
    busy = client.post(
        "/v1/job-leads",
        headers={"Idempotency-Key": "busy-check"},
        json=body,
    )
    client.app.state.job_lead_service = BrokenService(
        RuntimeError("PRIVATE INTERNAL DETAIL")
    )
    tolerant_client = TestClient(client.app, raise_server_exceptions=False)
    unexpected = tolerant_client.post(
        "/v1/job-leads",
        headers={"Idempotency-Key": "error-check"},
        json=body,
    )

    assert busy.status_code == 503
    assert busy.headers["retry-after"] == "1"
    assert busy.json()["code"] == "controlStoreBusy"
    assert "PRIVATE" not in busy.text
    assert unexpected.status_code == 500
    assert unexpected.json()["code"] == "internalError"
    assert "PRIVATE" not in unexpected.text


def test_future_control_store_schema_is_rejected_without_downgrade(
    tmp_path: Path,
) -> None:
    database_path = tmp_path / "future.sqlite3"
    with sqlite3.connect(database_path) as connection:
        connection.execute("PRAGMA user_version = 999")

    with pytest.raises(UnsupportedControlStoreVersionError):
        SqliteJobLeadRepository(database_path).initialize()

    with sqlite3.connect(database_path) as connection:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 999


def test_current_schema_initialization_is_idempotent(tmp_path: Path) -> None:
    database_path = tmp_path / "current.sqlite3"
    repository = SqliteJobLeadRepository(database_path)

    repository.initialize()
    repository.initialize()

    with sqlite3.connect(database_path) as connection:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 3
        aliases = connection.execute(
            "SELECT name FROM sqlite_master WHERE name = 'job_lead_source_aliases'"
        ).fetchone()
    assert aliases is not None


def test_interrupted_migration_rolls_back_atomically(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    database_path = tmp_path / "interrupted.sqlite3"
    repository = SqliteJobLeadRepository(database_path)

    def interrupt(connection: sqlite3.Connection) -> None:
        connection.execute("CREATE TABLE migration_marker (value TEXT)")
        raise RuntimeError("simulated migration interruption")

    monkeypatch.setattr(repository, "_create_control_tables", interrupt)
    with pytest.raises(RuntimeError, match="simulated migration interruption"):
        repository.initialize()

    with sqlite3.connect(database_path) as connection:
        assert connection.execute("PRAGMA user_version").fetchone()[0] == 0
        marker = connection.execute(
            "SELECT name FROM sqlite_master WHERE name = 'migration_marker'"
        ).fetchone()
        leads = connection.execute(
            "SELECT name FROM sqlite_master WHERE name = 'job_leads'"
        ).fetchone()
    assert marker is None
    assert leads is None


def test_raw_source_or_model_content_is_not_persisted(client: TestClient) -> None:
    sentinel = "VERY_PRIVATE_FULL_JOB_DESCRIPTION_SENTINEL"
    raw_description = client.post(
        "/v1/job-leads",
        headers={"Idempotency-Key": "privacy-check-description"},
        json={
            "sourceUrl": "https://example.com/job/123",
            "discoveredBy": "manual",
            "rawDescription": sentinel,
        },
    )
    prose_reference = client.post(
        "/v1/job-leads",
        headers={"Idempotency-Key": "privacy-check-reference"},
        json={
            "sourceUrl": "https://example.com/job/123",
            "discoveredBy": "email",
            "sourceReference": f"gmail:message-1\n{sentinel}",
        },
    )

    assert raw_description.status_code == 422
    assert prose_reference.status_code == 422
    with pytest.raises(InvalidJobLeadMetadataError):
        client.app.state.job_lead_service.create(
            CreateJobLead(
                source_url="https://example.com/job/456",
                discovered_by="email",
                idempotency_key="direct-privacy-check",
                source_reference=f"email:message-1\n{sentinel}",
            )
        )
    database = Path(client.app.state.job_lead_repository._database_path).read_bytes()
    assert sentinel.encode() not in database
