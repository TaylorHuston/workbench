from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi.testclient import TestClient

from pkm_api.main import create_app


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    vault = tmp_path / "vault"
    postings = vault / "02-personal/career/job-market/companies/example/jobs"
    postings.mkdir(parents=True)
    (postings / "platform-engineer-job-posting.md").write_text(
        """---
class: JobPosting
postingKey: linkedin:123
company: "[[02-personal/career/job-market/companies/example/example-company]]"
role: Platform Engineer
status: captured
interestLevel: 4
sourceUrl: https://www.linkedin.com/jobs/view/123/
capturedDate: 2026-09-22
roleArchetype: platform-engineering
workType: remote
seniority: senior
---
Private body that must not appear in the API.
"""
    )
    (postings / "staff-engineer-job-posting.md").write_text(
        """---
class: JobPosting
postingKey: greenhouse:456
company: "[[02-personal/career/job-market/companies/example/example-company]]"
role: Staff Engineer
status: applied
interestLevel: 5
sourceUrl: https://boards.greenhouse.io/example/jobs/456
capturedDate: 2026-09-21
roleArchetype: backend-engineering
workType: hybrid
seniority: staff
---
Private body.
"""
    )
    (postings / "archived-job-posting.md").write_text(
        """---
class: JobPosting
postingKey: archived:1
role: Old Role
status: closed
archived: true
---
"""
    )
    app = create_app(
        database_path=tmp_path / "control.sqlite3",
        vault_root=vault,
    )
    with TestClient(app) as test_client:
        yield test_client


def test_lists_captured_queue_without_note_body(client: TestClient) -> None:
    response = client.get("/v1/job-postings", params={"status": "captured"})

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["items"]) == 1
    assert payload["items"][0]["postingKey"] == "linkedin:123"
    assert payload["items"][0]["company"] == "example"
    assert "Private body" not in response.text


def test_job_posting_list_is_cursor_paginated(client: TestClient) -> None:
    first = client.get("/v1/job-postings", params={"limit": 1})

    assert first.status_code == 200
    assert first.json()["items"][0]["postingKey"] == "linkedin:123"
    next_url = first.json()["links"]["next"]
    query = parse_qs(urlsplit(next_url).query)
    second = client.get(
        "/v1/job-postings",
        params={"limit": 1, "cursor": query["cursor"][0]},
    )

    assert second.status_code == 200
    assert second.json()["items"][0]["postingKey"] == "greenhouse:456"
    assert second.json()["nextCursor"] is None


def test_job_stats_are_derived_from_current_non_archived_postings(
    client: TestClient,
) -> None:
    response = client.get("/v1/job-stats")

    assert response.status_code == 200
    assert response.json() == {
        "total": 2,
        "byStatus": {"applied": 1, "captured": 1},
        "byRoleArchetype": {
            "backend-engineering": 1,
            "platform-engineering": 1,
        },
        "byWorkType": {"hybrid": 1, "remote": 1},
        "bySeniority": {"senior": 1, "staff": 1},
    }


def test_invalid_job_posting_cursor_and_status_are_problem_details(
    client: TestClient,
) -> None:
    invalid_cursor = client.get("/v1/job-postings", params={"cursor": "not-base64"})
    invalid_status = client.get("/v1/job-postings", params={"status": "unknown"})

    assert invalid_cursor.status_code == 422
    assert invalid_cursor.headers["content-type"].startswith("application/problem+json")
    assert invalid_status.status_code == 422
