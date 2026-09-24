from __future__ import annotations

import datetime as dt
from dataclasses import replace
from pathlib import Path

from pkm_api.application.job_leads import CreateJobLead, JobLeadService
from pkm_api.application.job_processing import RetrievedJobSource
from pkm_api.domain.job_postings import CatalogMatchKind, Seniority, WorkType
from pkm_api.infrastructure.linkedin_job_extractor import (
    LinkedInJsonLdJobPostingExtractor,
)
from pkm_api.infrastructure.markdown_job_catalog import MarkdownJobPostingCatalog
from pkm_api.infrastructure.sqlite_job_leads import SqliteJobLeadRepository

NOW = dt.datetime(2026, 9, 23, 12, 0, tzinfo=dt.UTC)


def create_lead(tmp_path: Path):
    repository = SqliteJobLeadRepository(tmp_path / "control.sqlite3")
    service = JobLeadService(repository, clock=lambda: NOW)
    service.initialize()
    return service.create(
        CreateJobLead(
            source_url="https://www.linkedin.com/jobs/view/4470613618/",
            discovered_by="manual",
            idempotency_key="lead-1",
        )
    ).job_lead


def test_linkedin_json_ld_extracts_bounded_job_proposal(tmp_path: Path) -> None:
    lead = create_lead(tmp_path)
    html = b"""
    <html><head><script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      "title": "Senior Platform Engineer",
      "hiringOrganization": {"@type": "Organization", "name": "Example Corp"},
      "description": "<p>Build reliable platforms with Python.</p>",
      "jobLocationType": "TELECOMMUTE",
      "applicantLocationRequirements": {"name": "United States"},
      "baseSalary": {
        "currency": "USD",
        "value": {"minValue": 150000, "maxValue": 190000, "unitText": "YEAR"}
      },
      "validThrough": "2026-10-15"
    }
    </script></head></html>
    """
    source = RetrievedJobSource(
        requested_url=lead.source_url,
        final_url=lead.source_url,
        media_type="text/html",
        body=html,
        sha256="fixture",
        retrieved_at=NOW,
    )

    proposal = LinkedInJsonLdJobPostingExtractor().extract(source, lead)

    assert proposal.posting_key == "linkedin:4470613618"
    assert proposal.company == "Example Corp"
    assert proposal.role == "Senior Platform Engineer"
    assert proposal.work_type is WorkType.REMOTE
    assert proposal.seniority is Seniority.SENIOR
    assert proposal.location == "United States"
    assert proposal.salary is not None
    assert proposal.salary.minimum == 150000
    assert "Build reliable platforms with Python." in proposal.evidence_text
    assert "<p>" not in proposal.evidence_text


def test_markdown_catalog_distinguishes_exact_and_possible_reposts(
    tmp_path: Path,
) -> None:
    vault = tmp_path / "vault"
    company = vault / "02-personal/career/job-market/companies/example-corp"
    company.mkdir(parents=True)
    (company / "platform-engineer-linkedin-123.md").write_text(
        """---
class: JobPosting
postingKey: linkedin:123
externalIds:
  - greenhouse:abc
company: "[[example-corp-company]]"
role: Platform Engineer
sourceUrl: https://www.linkedin.com/jobs/view/123/?trk=alert
---

# Platform Engineer
"""
    )
    catalog = MarkdownJobPostingCatalog(vault)
    lead = create_lead(tmp_path)
    base = LinkedInJsonLdJobPostingExtractor().extract(
        RetrievedJobSource(
            requested_url=lead.source_url,
            final_url=lead.source_url,
            media_type="application/json",
            body=(
                b'{"@type":"JobPosting","title":"Platform Engineer",'
                b'"hiringOrganization":{"name":"Example Corp"}}'
            ),
            sha256="fixture",
            retrieved_at=NOW,
        ),
        lead,
    )

    exact = catalog.find_match(replace(base, posting_key="greenhouse:abc"))
    possible = catalog.find_match(replace(base, posting_key="linkedin:999"))
    unique = catalog.find_match(
        replace(base, posting_key="linkedin:998", role="Different Role")
    )

    assert exact.kind is CatalogMatchKind.EXACT
    assert exact.posting_key == "linkedin:123"
    assert possible.kind is CatalogMatchKind.POSSIBLE_REPOST
    assert unique.kind is CatalogMatchKind.NONE
