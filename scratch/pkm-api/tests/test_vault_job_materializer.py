from __future__ import annotations

import datetime as dt
from dataclasses import replace
from pathlib import Path

import pytest
import yaml

from pkm_api.application.job_processing import JobProcessingError
from pkm_api.domain.job_leads import (
    JobLead,
    JobLeadSource,
    JobLeadStage,
    JobLeadStatus,
    MaterializationStatus,
)
from pkm_api.domain.job_postings import (
    JobPostingAssessment,
    JobPostingProposal,
    SalaryRange,
    Seniority,
    ValidatedJobPosting,
    WorkType,
)
from pkm_api.infrastructure import vault_job_materializer as materializer_module
from pkm_api.infrastructure.vault_job_materializer import VaultJobPostingMaterializer

NOW = dt.datetime(2026, 9, 26, 14, 30, tzinfo=dt.UTC)


def _frontmatter(path: Path) -> dict[str, object]:
    text = path.read_text(encoding="utf-8")
    assert text.startswith("---\n")
    return yaml.safe_load(text.split("\n---\n", 1)[0][4:])


@pytest.fixture
def vault(tmp_path: Path) -> Path:
    root = tmp_path / "vault"
    companies = root / "02-personal/career/job-market/companies"
    companies.mkdir(parents=True)
    queue = root / "02-personal/career/job-market/role-archetype-review-queue.md"
    queue.write_text(
        """---
class: Note
---

# Role Archetype Review Queue

## Pending

| Captured | Posting | `postingKey` | Captured archetype |
|---|---|---|---|

## Completed Reviews

- None yet.
""",
        encoding="utf-8",
    )
    return root


@pytest.fixture
def lead() -> JobLead:
    return JobLead(
        id="8fa85f64-5717-4562-b3fc-2c963f66afa6",
        version=4,
        source_url="https://www.linkedin.com/jobs/view/4470613618/",
        source_key="linkedin:4470613618",
        source=JobLeadSource.LINKEDIN,
        posting_key="linkedin:4470613618",
        discovered_by="n8n",
        source_reference="apify:run-1:4470613618",
        status=JobLeadStatus.PROCESSING,
        stage=JobLeadStage.MATERIALIZING,
        attempt_count=1,
        retry_count=0,
        max_attempts=3,
        next_attempt_at=None,
        last_error=None,
        outcome=None,
        created_at=NOW,
        updated_at=NOW,
        expires_at=NOW + dt.timedelta(days=30),
    )


@pytest.fixture
def posting() -> ValidatedJobPosting:
    return ValidatedJobPosting(
        proposal=JobPostingProposal(
            schema_version="job-posting-proposal/v1",
            posting_key="linkedin:4470613618",
            company="Example Corp",
            role="Senior Platform Engineer",
            source_url="https://www.linkedin.com/jobs/view/4470613618/",
            location="United States",
            work_type=WorkType.REMOTE,
            seniority=Seniority.SENIOR,
            skills=("Python", "AWS"),
            evidence_text="PRIVATE SOURCE TEXT THAT MUST NOT BE WRITTEN",
            salary=SalaryRange(
                minimum=150000,
                maximum=190000,
                currency="USD",
                period="annual",
                type="base",
            ),
            application_deadline="2026-10-31",
        ),
        assessment=JobPostingAssessment(
            schema_version="job-posting-assessment/v1",
            interest_level=4,
            role_archetype="platform-infrastructure-devops",
            summary="Strong fit.\n## Injected heading",
            strengths=("Platform automation", "Cloud delivery\n- injected"),
            gaps=("Location policy remains unclear",),
            confirmed_blocker=False,
            unresolved_material_constraint=True,
            major_readiness_gap=False,
            aspirational=True,
            network_signal=False,
        ),
        warnings=("Assessment retains an unresolved material constraint.",),
    )


def test_materializes_minimal_company_posting_queue_and_processing_log(
    vault: Path,
    lead: JobLead,
    posting: ValidatedJobPosting,
) -> None:
    materializer = VaultJobPostingMaterializer(vault, clock=lambda: NOW)

    result = materializer.materialize(posting, lead=lead)

    assert result.status is MaterializationStatus.SUCCEEDED
    assert result.posting_key == "linkedin:4470613618"
    assert result.posting_path == (
        "02-personal/career/job-market/companies/example-corp/"
        "senior-platform-engineer-linkedin-4470613618.md"
    )
    company_path = (
        vault / "02-personal/career/job-market/companies/example-corp/"
        "example-corp-company.md"
    )
    posting_path = vault / result.posting_path
    assert company_path.read_text(encoding="utf-8") == (
        "---\nclass: Company\n---\n\n# Example Corp\n"
    )
    data = _frontmatter(posting_path)
    assert data == {
        "class": "JobPosting",
        "postingKey": "linkedin:4470613618",
        "externalIds": ["linkedin:4470613618"],
        "company": (
            "[[02-personal/career/job-market/companies/example-corp/"
            "example-corp-company]]"
        ),
        "role": "Senior Platform Engineer",
        "status": "captured",
        "interestLevel": 4,
        "sourceUrl": "https://www.linkedin.com/jobs/view/4470613618/",
        "source": "linkedin",
        "capturedDate": "2026-09-26",
        "lastChecked": "2026-09-26",
        "roleArchetype": "platform-infrastructure-devops",
        "location": "United States",
        "workType": "remote",
        "seniority": "senior",
        "skills": ["Python", "AWS"],
        "applicationDeadline": "2026-10-31",
        "aspirational": True,
        "salaryMin": 150000,
        "salaryMax": 190000,
        "salaryCurrency": "USD",
        "salaryPeriod": "annual",
        "salaryType": "base",
    }
    text = posting_path.read_text(encoding="utf-8")
    assert "PRIVATE SOURCE TEXT" not in text
    assert "\n## Injected heading\n" not in text
    assert "Cloud delivery - injected" in text
    assert "## Assessment" in text
    assert "## Fit signals" in text
    assert "## Activity" in text
    assert "- 2026-09-26: Captured and assessed automatically." in text

    queue = (
        vault / "02-personal/career/job-market/role-archetype-review-queue.md"
    ).read_text(encoding="utf-8")
    assert "`linkedin:4470613618`" in queue
    assert "Example Corp - Senior Platform Engineer" in queue
    log = (vault / "02-personal/career/job-market/job-processing-log.md").read_text(
        encoding="utf-8"
    )
    assert "| 2026-09-26 14:30 UTC |" in log
    assert (
        "| added | Added [[02-personal/career/job-market/companies/example-corp/"
        "senior-platform-engineer-linkedin-4470613618\\|Example Corp - Senior "
        "Platform Engineer]]. <!-- pkm-api-job-lead-added:" in log
    )
    assert "pkm-api-job-lead-added:8fa85f64-5717-4562-b3fc-2c963f66afa6" in log
    assert log.rstrip().endswith("b3fc-2c963f66afa6 --> |")


def test_materialization_is_idempotent_and_repairs_missing_derived_rows(
    vault: Path,
    lead: JobLead,
    posting: ValidatedJobPosting,
) -> None:
    materializer = VaultJobPostingMaterializer(vault, clock=lambda: NOW)
    first = materializer.materialize(posting, lead=lead)
    queue_path = vault / "02-personal/career/job-market/role-archetype-review-queue.md"
    log_path = vault / "02-personal/career/job-market/job-processing-log.md"
    queue_path.write_text(
        queue_path.read_text(encoding="utf-8").replace(
            next(
                line
                for line in queue_path.read_text(encoding="utf-8").splitlines(True)
                if "linkedin:4470613618" in line
            ),
            "",
        ),
        encoding="utf-8",
    )
    log_path.unlink()

    second = materializer.materialize(
        posting,
        lead=replace(lead, retry_count=lead.retry_count + 1),
    )

    assert second == first
    assert len(list((vault / first.posting_path).parent.glob("*.md"))) == 2
    assert queue_path.read_text(encoding="utf-8").count("`linkedin:4470613618`") == 1
    assert log_path.read_text(encoding="utf-8").count("pkm-api-job-lead-added:") == 1

    third = materializer.materialize(
        posting,
        lead=replace(lead, retry_count=lead.retry_count + 2),
    )

    assert third == first
    assert log_path.read_text(encoding="utf-8").count("pkm-api-job-lead-added:") == 1


def test_materializer_reuses_existing_compatible_company_note(
    vault: Path,
    lead: JobLead,
    posting: ValidatedJobPosting,
) -> None:
    company = vault / "02-personal/career/job-market/companies/example-corp"
    company.mkdir()
    existing = company / "legacy-example-record.md"
    content = "---\nclass: Company\naliases:\n  - Example\n---\n\n# Example Corp\n"
    existing.write_text(content, encoding="utf-8")
    materializer = VaultJobPostingMaterializer(vault, clock=lambda: NOW)

    result = materializer.materialize(posting, lead=lead)

    assert result.posting_path is not None
    assert existing.read_text(encoding="utf-8") == content
    assert not (company / "example-corp-company.md").exists()
    assert _frontmatter(vault / result.posting_path)["company"] == (
        "[[02-personal/career/job-market/companies/example-corp/legacy-example-record]]"
    )


def test_materializer_refuses_symlinked_company_directory(
    vault: Path,
    lead: JobLead,
    posting: ValidatedJobPosting,
    tmp_path: Path,
) -> None:
    companies = vault / "02-personal/career/job-market/companies"
    outside = tmp_path / "outside"
    outside.mkdir()
    (companies / "example-corp").symlink_to(outside, target_is_directory=True)
    materializer = VaultJobPostingMaterializer(vault, clock=lambda: NOW)

    with pytest.raises(JobProcessingError) as raised:
        materializer.materialize(posting, lead=lead)

    assert raised.value.code == "unsafeVaultPath"
    assert raised.value.retryable is False
    assert list(outside.iterdir()) == []


def test_materializer_reconciles_create_race_when_exact_posting_won(
    vault: Path,
    lead: JobLead,
    posting: ValidatedJobPosting,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original_link = materializer_module.os.link

    def publish_then_report_collision(
        source: object,
        destination: object,
        **kwargs: object,
    ) -> None:
        original_link(source, destination, **kwargs)
        if str(destination).endswith("linkedin-4470613618.md"):
            raise FileExistsError("simulated concurrent exact create")

    monkeypatch.setattr(materializer_module.os, "link", publish_then_report_collision)
    materializer = VaultJobPostingMaterializer(vault, clock=lambda: NOW)

    result = materializer.materialize(posting, lead=lead)

    assert result.status is MaterializationStatus.SUCCEEDED
    assert result.posting_path is not None
    assert _frontmatter(vault / result.posting_path)["postingKey"] == (
        "linkedin:4470613618"
    )


def test_materializer_does_not_follow_parent_swapped_to_symlink(
    vault: Path,
    lead: JobLead,
    posting: ValidatedJobPosting,
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    company = vault / "02-personal/career/job-market/companies/example-corp"
    moved = vault / "02-personal/career/job-market/companies/example-corp-moved"
    outside = tmp_path / "outside-race"
    outside.mkdir()
    original_link = materializer_module.os.link
    swapped = False

    def swap_parent_before_publish(*args: object, **kwargs: object) -> None:
        nonlocal swapped
        if not swapped:
            swapped = True
            company.rename(moved)
            company.symlink_to(outside, target_is_directory=True)
        original_link(*args, **kwargs)

    monkeypatch.setattr(materializer_module.os, "link", swap_parent_before_publish)
    materializer = VaultJobPostingMaterializer(vault, clock=lambda: NOW)

    with pytest.raises(JobProcessingError) as raised:
        materializer.materialize(posting, lead=lead)

    assert raised.value.code == "unsafeVaultPath"
    assert list(outside.iterdir()) == []
    assert not (vault / "02-personal/career/job-market/job-processing-log.md").exists()


def test_materializer_rejects_possible_repost_at_write_boundary(
    vault: Path,
    lead: JobLead,
    posting: ValidatedJobPosting,
) -> None:
    company = vault / "02-personal/career/job-market/companies/example-corp"
    company.mkdir()
    (company / "example-corp-company.md").write_text(
        "---\nclass: Company\n---\n\n# Example Corp\n",
        encoding="utf-8",
    )
    (company / "senior-platform-engineer-other-123.md").write_text(
        """---
class: JobPosting
postingKey: other:123
externalIds:
  - other:123
company: "[[02-personal/career/job-market/companies/example-corp/example-corp-company]]"
role: Senior Platform Engineer
status: captured
interestLevel: 3
sourceUrl: https://example.com/jobs/123
source: company-site
capturedDate: 2026-09-25
roleArchetype: platform-infrastructure-devops
workType: remote
seniority: senior
skills: []
---

# Senior Platform Engineer - Example Corp
""",
        encoding="utf-8",
    )
    materializer = VaultJobPostingMaterializer(vault, clock=lambda: NOW)

    result = materializer.materialize(posting, lead=lead)

    assert result.status is MaterializationStatus.POSSIBLE_REPOST
    assert result.posting_path is None
    assert not (company / "senior-platform-engineer-linkedin-4470613618.md").exists()


def test_materializer_rejects_invalid_application_deadline(
    vault: Path,
    lead: JobLead,
    posting: ValidatedJobPosting,
) -> None:
    invalid = replace(
        posting,
        proposal=replace(posting.proposal, application_deadline="next Friday"),
    )
    materializer = VaultJobPostingMaterializer(vault, clock=lambda: NOW)

    with pytest.raises(JobProcessingError) as raised:
        materializer.materialize(invalid, lead=lead)

    assert raised.value.code == "invalidMaterializationCandidate"
    assert not list((vault / "02-personal/career/job-market/companies").rglob("*.md"))
