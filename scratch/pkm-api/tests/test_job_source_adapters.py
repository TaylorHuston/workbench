from __future__ import annotations

import datetime as dt
from dataclasses import replace
from pathlib import Path

import pytest

from pkm_api.application.job_leads import CreateJobLead, JobLeadService
from pkm_api.application.job_processing import RetrievedJobSource, SkipJobLead
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


def test_linkedin_public_markup_extracts_when_json_ld_is_absent(
    tmp_path: Path,
) -> None:
    lead = create_lead(tmp_path)
    html = b"""
    <html><body>
      <h1 class="top-card-layout__title topcard__title">
        Senior Solutions Consultant
      </h1>
      <a class="topcard__org-name-link">Accruent</a>
      <span class="topcard__flavor topcard__flavor--bullet">United States</span>
      <div class="show-more-less-html__markup">
        <strong>Role Summary<br></strong>
        <p>Advise enterprise customers on secure SaaS deployments.
        <video><source src="overview.mp4"></video>
        <wbr><ul><li>Lead discovery workshops.</ul>
        <div><p>Translate technical concepts into business value.</div>
      </div>
      <div>UNRELATED PAGE CONTENT</div>
    </body></html>
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
    assert proposal.company == "Accruent"
    assert proposal.role == "Senior Solutions Consultant"
    assert proposal.location == "United States"
    assert proposal.work_type is WorkType.UNKNOWN
    assert proposal.seniority is Seniority.SENIOR
    assert "Role Summary" in proposal.evidence_text
    assert "Lead discovery workshops." in proposal.evidence_text
    assert "Translate technical concepts into business value." in proposal.evidence_text
    assert "UNRELATED PAGE CONTENT" not in proposal.evidence_text


@pytest.mark.parametrize(
    "final_url",
    [
        "https://www.linkedin.com/company/example/",
        "https://www.linkedin.com/jobs/view/9999999999/",
        "https://www.linkedin.example/jobs/view/4470613618/",
    ],
)
def test_linkedin_public_markup_is_restricted_to_the_claimed_job_path(
    tmp_path: Path,
    final_url: str,
) -> None:
    lead = create_lead(tmp_path)
    source = RetrievedJobSource(
        requested_url=lead.source_url,
        final_url=final_url,
        media_type="text/html",
        body=(
            b'<h1 class="top-card-layout__title">Unrelated Role</h1>'
            b'<a class="topcard__org-name-link">Unrelated Company</a>'
        ),
        sha256="fixture",
        retrieved_at=NOW,
    )

    with pytest.raises(SkipJobLead) as raised:
        LinkedInJsonLdJobPostingExtractor().extract(source, lead)

    assert raised.value.code == "unsupportedSource"


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
