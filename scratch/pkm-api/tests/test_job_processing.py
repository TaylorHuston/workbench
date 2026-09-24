from __future__ import annotations

import datetime as dt
from dataclasses import dataclass, replace
from pathlib import Path

import pytest

from pkm_api.application.job_leads import (
    CreateJobLead,
    JobLeadNotFoundError,
    JobLeadService,
    canonicalize_job_url,
)
from pkm_api.application.job_processing import (
    CanonicalJobPostingValidator,
    DisabledJobPostingMaterializer,
    JobLeadLeaseLostError,
    JobLeadProcessor,
    JobProcessingError,
    RetrievedJobSource,
)
from pkm_api.domain.job_leads import (
    JobLeadOutcome,
    JobLeadStatus,
    MaterializationStatus,
)
from pkm_api.domain.job_postings import (
    CatalogMatch,
    CatalogMatchKind,
    JobPostingAssessment,
    JobPostingProposal,
    Seniority,
    WorkType,
)
from pkm_api.infrastructure.sqlite_job_leads import SqliteJobLeadRepository

NOW = dt.datetime(2026, 9, 23, 12, 0, tzinfo=dt.UTC)


@dataclass
class FakeRetriever:
    failure: Exception | None = None
    final_url: str | None = None

    def retrieve(self, source_url: str) -> RetrievedJobSource:
        if self.failure is not None:
            raise self.failure
        return RetrievedJobSource(
            requested_url=source_url,
            final_url=self.final_url or source_url,
            media_type="text/html",
            body=b"PRIVATE RAW SOURCE BODY",
            sha256="abc123",
            retrieved_at=NOW,
        )


@dataclass
class FakeExtractor:
    proposal: JobPostingProposal

    def extract(self, source: RetrievedJobSource, lead: object) -> JobPostingProposal:
        assert source.body == b"PRIVATE RAW SOURCE BODY"
        return self.proposal


@dataclass
class FakeCatalog:
    match: CatalogMatch

    def find_match(self, proposal: JobPostingProposal) -> CatalogMatch:
        return self.match


@dataclass
class FakeAssessor:
    assessment: JobPostingAssessment
    called: bool = False

    def assess(self, proposal: JobPostingProposal) -> JobPostingAssessment:
        self.called = True
        return self.assessment


@pytest.fixture
def proposal() -> JobPostingProposal:
    return JobPostingProposal(
        schema_version="job-posting-proposal/v1",
        posting_key="linkedin:4470613618",
        company="Example Corp",
        role="Platform Engineer",
        source_url="https://www.linkedin.com/jobs/view/4470613618/",
        location="United States",
        work_type=WorkType.REMOTE,
        seniority=Seniority.SENIOR,
        skills=("Python", "AWS"),
    )


@pytest.fixture
def assessment() -> JobPostingAssessment:
    return JobPostingAssessment(
        schema_version="job-posting-assessment/v1",
        interest_level=4,
        role_archetype="platform-infrastructure-devops",
        summary="Strong platform fit with one location uncertainty.",
        strengths=("Platform automation",),
        gaps=("Location remains broad",),
        confirmed_blocker=False,
        unresolved_material_constraint=True,
        major_readiness_gap=False,
        aspirational=False,
        network_signal=False,
    )


def create_repository(
    tmp_path: Path, *, max_attempts: int = 3
) -> SqliteJobLeadRepository:
    repository = SqliteJobLeadRepository(tmp_path / "control.sqlite3")
    service = JobLeadService(
        repository,
        clock=lambda: NOW,
        max_attempts=max_attempts,
    )
    service.initialize()
    service.create(
        CreateJobLead(
            source_url="https://www.linkedin.com/jobs/view/4470613618/",
            discovered_by="manual",
            idempotency_key="lead-1",
        )
    )
    return repository


def create_processor(
    repository: SqliteJobLeadRepository,
    *,
    proposal: JobPostingProposal,
    assessment: JobPostingAssessment,
    match: CatalogMatch | None = None,
    retriever: FakeRetriever | None = None,
) -> tuple[JobLeadProcessor, FakeAssessor]:
    assessor = FakeAssessor(assessment)
    processor = JobLeadProcessor(
        repository=repository,
        retriever=retriever or FakeRetriever(),
        extractor=FakeExtractor(proposal),
        catalog=FakeCatalog(match or CatalogMatch(CatalogMatchKind.NONE)),
        assessor=assessor,
        validator=CanonicalJobPostingValidator(
            canonical_skills={"Python", "AWS"},
            role_archetypes={"platform-infrastructure-devops"},
        ),
        materializer=DisabledJobPostingMaterializer(),
        clock=lambda: NOW + dt.timedelta(minutes=1),
    )
    return processor, assessor


def test_unique_lead_stops_at_validated_materialization_boundary(
    tmp_path: Path,
    proposal: JobPostingProposal,
    assessment: JobPostingAssessment,
) -> None:
    repository = create_repository(tmp_path)
    processor, assessor = create_processor(
        repository,
        proposal=proposal,
        assessment=assessment,
    )

    result = processor.process_next(worker_id="worker-1")

    assert result is not None
    assert result.status is JobLeadStatus.READY_FOR_MATERIALIZATION
    assert result.outcome is not None
    assert result.outcome.materialization_status is MaterializationStatus.DISABLED
    assert result.outcome.company == "Example Corp"
    assert assessor.called is True
    assert b"PRIVATE RAW SOURCE BODY" not in (tmp_path / "control.sqlite3").read_bytes()


def test_exact_and_possible_matches_terminate_without_assessment(
    tmp_path: Path,
    proposal: JobPostingProposal,
    assessment: JobPostingAssessment,
) -> None:
    exact_repository = create_repository(tmp_path / "exact")
    exact_processor, exact_assessor = create_processor(
        exact_repository,
        proposal=proposal,
        assessment=assessment,
        match=CatalogMatch(CatalogMatchKind.EXACT, posting_key=proposal.posting_key),
    )
    exact = exact_processor.process_next(worker_id="worker-exact")

    possible_repository = create_repository(tmp_path / "possible")
    possible_processor, possible_assessor = create_processor(
        possible_repository,
        proposal=proposal,
        assessment=assessment,
        match=CatalogMatch(CatalogMatchKind.POSSIBLE_REPOST),
    )
    possible = possible_processor.process_next(worker_id="worker-possible")

    assert exact is not None and exact.status is JobLeadStatus.ALREADY_TRACKED
    assert possible is not None and possible.status is JobLeadStatus.POSSIBLE_REPOST
    assert exact_assessor.called is False
    assert possible_assessor.called is False


def test_redirect_aliases_converge_before_duplicate_assessment(
    tmp_path: Path,
    proposal: JobPostingProposal,
    assessment: JobPostingAssessment,
) -> None:
    repository = SqliteJobLeadRepository(tmp_path / "control.sqlite3")
    service = JobLeadService(
        repository,
        clock=lambda: NOW,
        ttl=dt.timedelta(days=1),
    )
    service.initialize()
    first = service.create(
        CreateJobLead(
            source_url="https://jobs.example.com/short/a",
            discovered_by="manual",
            idempotency_key="short-a",
        )
    ).job_lead
    first_processor, first_assessor = create_processor(
        repository,
        proposal=proposal,
        assessment=assessment,
        retriever=FakeRetriever(final_url=proposal.source_url),
    )
    first_result = first_processor.process_next(worker_id="worker-a")

    service = JobLeadService(
        repository,
        clock=lambda: NOW,
        ttl=dt.timedelta(days=3),
    )
    second = service.create(
        CreateJobLead(
            source_url="https://jobs.example.com/short/b",
            discovered_by="manual",
            idempotency_key="short-b",
        )
    ).job_lead
    second_processor, second_assessor = create_processor(
        repository,
        proposal=proposal,
        assessment=assessment,
        retriever=FakeRetriever(final_url=proposal.source_url),
    )
    second_result = second_processor.process_next(worker_id="worker-b")

    assert first_result is not None
    assert first_result.id == first.id
    assert first_result.source_key == proposal.posting_key
    assert first_assessor.called is True
    assert second_result is not None
    assert second_result.id == second.id
    assert second_result.status is JobLeadStatus.ALREADY_TRACKED
    assert second_result.outcome is not None
    assert second_result.outcome.kind == "duplicateJobLead"
    assert second_assessor.called is False
    short_alias = service.create(
        CreateJobLead(
            source_url="https://jobs.example.com/short/b",
            discovered_by="manual",
            idempotency_key="short-b-again",
        )
    )
    assert short_alias.created is False
    assert short_alias.job_lead.id == second.id
    replay = service.create(
        CreateJobLead(
            source_url=proposal.source_url,
            discovered_by="manual",
            idempotency_key="final-url",
        )
    )
    assert replay.created is False
    assert replay.job_lead.id == first.id

    assert repository.purge_expired(now=NOW + dt.timedelta(days=2)) == 1
    after_purge = service.create(
        CreateJobLead(
            source_url="https://jobs.example.com/short/b",
            discovered_by="manual",
            idempotency_key="short-b-after-purge",
        )
    )
    assert after_purge.created is False
    assert after_purge.job_lead.id == second.id


def test_generic_final_url_retains_valid_generic_source_identity(
    tmp_path: Path,
    proposal: JobPostingProposal,
    assessment: JobPostingAssessment,
) -> None:
    final_url = "https://jobs.example.com/job/123?utm_source=ignored"
    canonical = canonicalize_job_url(final_url)
    repository = SqliteJobLeadRepository(tmp_path / "control.sqlite3")
    service = JobLeadService(repository, clock=lambda: NOW)
    service.initialize()
    service.create(
        CreateJobLead(
            source_url="https://short.example.com/a",
            discovered_by="manual",
            idempotency_key="generic-redirect",
        )
    )
    generic_proposal = replace(
        proposal,
        posting_key=canonical.source_key,
        source_url="https://untrusted-extractor.example/wrong",
    )
    processor, _ = create_processor(
        repository,
        proposal=generic_proposal,
        assessment=assessment,
        retriever=FakeRetriever(final_url=final_url),
    )

    result = processor.process_next(worker_id="worker-generic")

    assert result is not None
    assert result.status is JobLeadStatus.READY_FOR_MATERIALIZATION
    assert result.source is canonical.source
    assert result.source_key == canonical.source_key
    assert result.source_url == canonical.url
    assert result.posting_key == canonical.source_key
    assert result.outcome is not None
    assert result.outcome.posting_key == canonical.source_key


def test_retryable_processing_failure_requeues_then_exhausts_attempts(
    tmp_path: Path,
    proposal: JobPostingProposal,
    assessment: JobPostingAssessment,
) -> None:
    repository = create_repository(tmp_path, max_attempts=1)
    processor, _ = create_processor(
        repository,
        proposal=proposal,
        assessment=assessment,
        retriever=FakeRetriever(
            JobProcessingError(
                "sourceUnavailable",
                "The source is temporarily unavailable.",
                retryable=True,
            )
        ),
    )

    result = processor.process_next(worker_id="worker-1")

    assert result is not None
    assert result.status is JobLeadStatus.FAILED
    assert result.last_error is not None
    assert result.last_error.code == "sourceUnavailable"
    assert "PRIVATE" not in result.last_error.message


def test_expired_lease_can_be_reclaimed_and_old_worker_is_fenced(
    tmp_path: Path,
) -> None:
    repository = create_repository(tmp_path)
    first = repository.claim_next(
        worker_id="worker-1",
        now=NOW,
        lease_duration=dt.timedelta(seconds=30),
    )
    second = repository.claim_next(
        worker_id="worker-2",
        now=NOW + dt.timedelta(seconds=31),
        lease_duration=dt.timedelta(seconds=30),
    )

    assert first is not None
    assert second is not None
    assert first.job_lead.id == second.job_lead.id
    assert first.lease_token != second.lease_token
    with pytest.raises(JobLeadLeaseLostError):
        repository.complete_claim(
            first,
            status=JobLeadStatus.SKIPPED,
            outcome=JobLeadOutcome(kind="stale"),
            now=NOW + dt.timedelta(seconds=32),
        )


def test_expired_leases_exhaust_attempt_budget_without_unbounded_reclaims(
    tmp_path: Path,
) -> None:
    repository = create_repository(tmp_path, max_attempts=2)
    first = repository.claim_next(
        worker_id="worker-1",
        now=NOW,
        lease_duration=dt.timedelta(seconds=30),
    )
    assert first is not None
    second = repository.claim_next(
        worker_id="worker-2",
        now=NOW + dt.timedelta(seconds=31),
        lease_duration=dt.timedelta(seconds=30),
    )
    assert second is not None

    third = repository.claim_next(
        worker_id="worker-3",
        now=NOW + dt.timedelta(seconds=62),
        lease_duration=dt.timedelta(seconds=30),
    )
    exhausted = repository.get(first.job_lead.id)

    assert third is None
    assert exhausted.status is JobLeadStatus.FAILED
    assert exhausted.attempt_count == 2
    assert exhausted.last_error is not None
    assert exhausted.last_error.code == "leaseExpired"


def test_expired_terminal_leads_are_purged_but_active_work_is_retained(
    tmp_path: Path,
) -> None:
    repository = SqliteJobLeadRepository(tmp_path / "control.sqlite3")
    service = JobLeadService(
        repository,
        clock=lambda: NOW,
        ttl=dt.timedelta(days=1),
    )
    service.initialize()
    lead = service.create(
        CreateJobLead(
            source_url="https://www.linkedin.com/jobs/view/123/",
            discovered_by="manual",
            idempotency_key="lead-123",
        )
    ).job_lead
    claim = repository.claim_next(
        worker_id="worker-1",
        now=NOW,
        lease_duration=dt.timedelta(minutes=1),
    )
    assert claim is not None
    repository.complete_claim(
        claim,
        status=JobLeadStatus.SKIPPED,
        outcome=JobLeadOutcome(kind="unsupportedSource"),
        now=NOW,
    )

    assert repository.purge_expired(now=NOW + dt.timedelta(days=2)) == 1
    with pytest.raises(JobLeadNotFoundError):
        repository.get(lead.id)


def test_validator_enforces_interest_caps_and_canonical_skills(
    proposal: JobPostingProposal,
    assessment: JobPostingAssessment,
) -> None:
    validator = CanonicalJobPostingValidator(
        canonical_skills={"Python"},
        role_archetypes={"platform-infrastructure-devops"},
    )
    invalid_score = replace(
        assessment,
        interest_level=5,
        confirmed_blocker=True,
        unresolved_material_constraint=False,
    )

    with pytest.raises(JobProcessingError, match="non-canonical skills"):
        validator.validate(proposal, assessment)
    with pytest.raises(JobProcessingError, match="caps interestLevel at 2"):
        CanonicalJobPostingValidator(
            canonical_skills={"Python", "AWS"},
            role_archetypes={"platform-infrastructure-devops"},
        ).validate(proposal, invalid_score)
