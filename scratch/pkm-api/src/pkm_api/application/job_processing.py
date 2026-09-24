from __future__ import annotations

import datetime as dt
from collections.abc import Callable, Collection
from dataclasses import dataclass, replace
from typing import Protocol
from urllib.parse import urlsplit

from pkm_api.application.job_leads import canonicalize_job_url
from pkm_api.domain.job_leads import (
    JobLead,
    JobLeadClaim,
    JobLeadError,
    JobLeadOutcome,
    JobLeadSource,
    JobLeadStage,
    JobLeadStatus,
    MaterializationStatus,
)
from pkm_api.domain.job_postings import (
    CatalogMatch,
    CatalogMatchKind,
    JobPostingAssessment,
    JobPostingProposal,
    ValidatedJobPosting,
)


class JobLeadLeaseLostError(RuntimeError):
    pass


class JobProcessingError(RuntimeError):
    def __init__(self, code: str, safe_message: str, *, retryable: bool) -> None:
        super().__init__(safe_message)
        self.code = code
        self.safe_message = safe_message
        self.retryable = retryable


class SkipJobLead(JobProcessingError):
    def __init__(self, code: str, safe_message: str) -> None:
        super().__init__(code, safe_message, retryable=False)


@dataclass(frozen=True, slots=True)
class RetrievedJobSource:
    requested_url: str
    final_url: str
    media_type: str
    body: bytes
    sha256: str
    retrieved_at: dt.datetime


@dataclass(frozen=True, slots=True)
class MaterializationResult:
    status: MaterializationStatus
    posting_key: str | None = None


class JobSourceRetriever(Protocol):
    def retrieve(self, source_url: str) -> RetrievedJobSource: ...


class JobPostingExtractor(Protocol):
    def extract(
        self, source: RetrievedJobSource, lead: JobLead
    ) -> JobPostingProposal: ...


class JobPostingCatalog(Protocol):
    def find_match(self, proposal: JobPostingProposal) -> CatalogMatch: ...


class JobPostingAssessor(Protocol):
    def assess(self, proposal: JobPostingProposal) -> JobPostingAssessment: ...


class JobPostingProposalValidator(Protocol):
    def validate(
        self,
        proposal: JobPostingProposal,
        assessment: JobPostingAssessment,
    ) -> ValidatedJobPosting: ...


class JobPostingMaterializer(Protocol):
    def materialize(self, posting: ValidatedJobPosting) -> MaterializationResult: ...


class JobLeadWorkRepository(Protocol):
    def claim_next(
        self,
        *,
        worker_id: str,
        now: dt.datetime,
        lease_duration: dt.timedelta,
    ) -> JobLeadClaim | None: ...

    def reconcile_source_alias(
        self,
        claim: JobLeadClaim,
        *,
        canonical_url: str,
        source_key: str,
        source: JobLeadSource,
        posting_key: str | None,
        now: dt.datetime,
    ) -> tuple[JobLeadClaim, JobLead | None]: ...

    def advance_claim(
        self,
        claim: JobLeadClaim,
        *,
        stage: JobLeadStage,
        now: dt.datetime,
        lease_duration: dt.timedelta,
    ) -> JobLeadClaim: ...

    def complete_claim(
        self,
        claim: JobLeadClaim,
        *,
        status: JobLeadStatus,
        outcome: JobLeadOutcome,
        now: dt.datetime,
    ) -> JobLead: ...

    def fail_claim(
        self,
        claim: JobLeadClaim,
        *,
        error: JobLeadError,
        now: dt.datetime,
    ) -> JobLead: ...


class DisabledJobPostingMaterializer:
    def materialize(self, posting: ValidatedJobPosting) -> MaterializationResult:
        return MaterializationResult(
            status=MaterializationStatus.DISABLED,
            posting_key=posting.proposal.posting_key,
        )


class CanonicalJobPostingValidator:
    def __init__(
        self,
        *,
        canonical_skills: Collection[str],
        role_archetypes: Collection[str],
    ) -> None:
        self._canonical_skills = frozenset(canonical_skills)
        self._role_archetypes = frozenset(role_archetypes)

    def validate(
        self,
        proposal: JobPostingProposal,
        assessment: JobPostingAssessment,
    ) -> ValidatedJobPosting:
        if proposal.schema_version != "job-posting-proposal/v1":
            self._invalid("Unsupported proposal schema version.")
        if assessment.schema_version != "job-posting-assessment/v1":
            self._invalid("Unsupported assessment schema version.")
        self._bounded_required("postingKey", proposal.posting_key, 200)
        self._bounded_required("company", proposal.company, 200)
        self._bounded_required("role", proposal.role, 300)
        if urlsplit(proposal.source_url).scheme != "https":
            self._invalid("The proposed source URL must use HTTPS.")
        if len(proposal.evidence_text) > 20_000:
            self._invalid("The extracted evidence exceeds the assessment limit.")

        unknown_skills = sorted(set(proposal.skills) - self._canonical_skills)
        if unknown_skills:
            self._invalid("The proposal contains non-canonical skills.")
        if len(proposal.skills) != len(set(proposal.skills)):
            self._invalid("The proposal contains duplicate skills.")
        if assessment.role_archetype not in self._role_archetypes:
            self._invalid("The assessment contains an unsupported role archetype.")
        if not 1 <= assessment.interest_level <= 5:
            self._invalid("interestLevel must be between 1 and 5.")
        if assessment.confirmed_blocker and assessment.interest_level > 2:
            self._invalid("A confirmed blocker caps interestLevel at 2.")
        if assessment.major_readiness_gap and assessment.interest_level > 3:
            self._invalid("A major readiness gap caps interestLevel at 3.")
        if assessment.unresolved_material_constraint and assessment.interest_level > 4:
            self._invalid("An unresolved material constraint caps interestLevel at 4.")
        if assessment.network_signal:
            self._invalid("A URL-only JobLead cannot establish networkSignal.")
        self._bounded_required("assessment summary", assessment.summary, 1000)
        self._validate_bullets("strengths", assessment.strengths)
        self._validate_bullets("gaps", assessment.gaps)

        if proposal.salary is not None:
            salary = proposal.salary
            if salary.minimum < 0 or salary.maximum < salary.minimum:
                self._invalid("The salary range is invalid.")
            if len(salary.currency) != 3 or not salary.currency.isupper():
                self._invalid("Salary currency must be a three-letter uppercase code.")
            if salary.period not in {"annual", "hourly"}:
                self._invalid("Salary period must be annual or hourly.")
            if salary.type not in {"base", "ote", "unknown"}:
                self._invalid("Salary type must be base, ote, or unknown.")

        warnings = ()
        if assessment.unresolved_material_constraint:
            warnings = ("Assessment retains an unresolved material constraint.",)
        return ValidatedJobPosting(
            proposal=proposal,
            assessment=assessment,
            warnings=warnings,
        )

    @staticmethod
    def _bounded_required(name: str, value: str, maximum: int) -> None:
        if not value.strip() or len(value) > maximum:
            CanonicalJobPostingValidator._invalid(f"{name} is missing or too long.")

    @staticmethod
    def _validate_bullets(name: str, values: tuple[str, ...]) -> None:
        if len(values) > 10 or any(
            not value.strip() or len(value) > 300 for value in values
        ):
            CanonicalJobPostingValidator._invalid(f"{name} are invalid or too long.")

    @staticmethod
    def _invalid(message: str) -> None:
        raise JobProcessingError("invalidAssessment", message, retryable=False)


class JobLeadProcessor:
    def __init__(
        self,
        *,
        repository: JobLeadWorkRepository,
        retriever: JobSourceRetriever,
        extractor: JobPostingExtractor,
        catalog: JobPostingCatalog,
        assessor: JobPostingAssessor,
        validator: JobPostingProposalValidator,
        materializer: JobPostingMaterializer,
        clock: Callable[[], dt.datetime] | None = None,
        lease_duration: dt.timedelta = dt.timedelta(minutes=15),
    ) -> None:
        self._repository = repository
        self._retriever = retriever
        self._extractor = extractor
        self._catalog = catalog
        self._assessor = assessor
        self._validator = validator
        self._materializer = materializer
        self._clock = clock or (lambda: dt.datetime.now(dt.UTC))
        self._lease_duration = lease_duration

    def process_next(self, *, worker_id: str) -> JobLead | None:
        claim = self._repository.claim_next(
            worker_id=worker_id,
            now=self._clock(),
            lease_duration=self._lease_duration,
        )
        if claim is None:
            return None
        try:
            source = self._retriever.retrieve(claim.job_lead.source_url)
            claim = self._advance(claim, JobLeadStage.EXTRACTING)
            proposal = self._extractor.extract(source, claim.job_lead)
            canonical_source = canonicalize_job_url(source.final_url)
            resolved_posting_key = (
                canonical_source.posting_key or canonical_source.source_key
            )
            claim, duplicate_lead = self._repository.reconcile_source_alias(
                claim,
                canonical_url=canonical_source.url,
                source_key=canonical_source.source_key,
                source=canonical_source.source,
                posting_key=resolved_posting_key,
                now=self._clock(),
            )
            proposal = replace(
                proposal,
                source_url=canonical_source.url,
                posting_key=resolved_posting_key,
            )
            if duplicate_lead is not None:
                return self._complete_match(
                    claim,
                    status=JobLeadStatus.ALREADY_TRACKED,
                    kind="duplicateJobLead",
                    proposal=proposal,
                    posting_key=(duplicate_lead.posting_key or proposal.posting_key),
                    warnings=(
                        "The resolved source is already represented by another "
                        "JobLead.",
                    ),
                )
            claim = self._advance(claim, JobLeadStage.DEDUPLICATING)
            match = self._catalog.find_match(proposal)
            if match.kind is CatalogMatchKind.EXACT:
                return self._complete_match(
                    claim,
                    status=JobLeadStatus.ALREADY_TRACKED,
                    kind="alreadyTracked",
                    proposal=proposal,
                    posting_key=match.posting_key or proposal.posting_key,
                )
            if match.kind is CatalogMatchKind.POSSIBLE_REPOST:
                return self._complete_match(
                    claim,
                    status=JobLeadStatus.POSSIBLE_REPOST,
                    kind="possibleRepost",
                    proposal=proposal,
                    posting_key=match.posting_key,
                    warnings=("Potential repost requires identity review.",),
                )

            claim = self._advance(claim, JobLeadStage.ASSESSING)
            assessment = self._assessor.assess(proposal)
            claim = self._advance(claim, JobLeadStage.VALIDATING)
            validated = self._validator.validate(proposal, assessment)
            claim = self._advance(claim, JobLeadStage.MATERIALIZING)
            materialization = self._materializer.materialize(validated)
            final_status = (
                JobLeadStatus.MATERIALIZED
                if materialization.status is MaterializationStatus.SUCCEEDED
                else JobLeadStatus.READY_FOR_MATERIALIZATION
            )
            return self._repository.complete_claim(
                claim,
                status=final_status,
                outcome=JobLeadOutcome(
                    kind=final_status.value,
                    posting_key=materialization.posting_key or proposal.posting_key,
                    company=proposal.company,
                    role=proposal.role,
                    warnings=validated.warnings,
                    materialization_status=materialization.status,
                ),
                now=self._clock(),
            )
        except JobLeadLeaseLostError:
            raise
        except SkipJobLead as error:
            return self._repository.complete_claim(
                claim,
                status=JobLeadStatus.SKIPPED,
                outcome=JobLeadOutcome(
                    kind=error.code,
                    warnings=(error.safe_message,),
                ),
                now=self._clock(),
            )
        except JobProcessingError as error:
            return self._repository.fail_claim(
                claim,
                error=JobLeadError(
                    code=error.code,
                    message=error.safe_message,
                    retryable=error.retryable,
                ),
                now=self._clock(),
            )
        except Exception:
            return self._repository.fail_claim(
                claim,
                error=JobLeadError(
                    code="unexpectedProcessingFailure",
                    message="JobLead processing failed unexpectedly.",
                    retryable=True,
                ),
                now=self._clock(),
            )

    def _advance(self, claim: JobLeadClaim, stage: JobLeadStage) -> JobLeadClaim:
        return self._repository.advance_claim(
            claim,
            stage=stage,
            now=self._clock(),
            lease_duration=self._lease_duration,
        )

    def _complete_match(
        self,
        claim: JobLeadClaim,
        *,
        status: JobLeadStatus,
        kind: str,
        proposal: JobPostingProposal,
        posting_key: str | None,
        warnings: tuple[str, ...] = (),
    ) -> JobLead:
        return self._repository.complete_claim(
            claim,
            status=status,
            outcome=JobLeadOutcome(
                kind=kind,
                posting_key=posting_key,
                company=proposal.company,
                role=proposal.role,
                warnings=warnings,
            ),
            now=self._clock(),
        )
