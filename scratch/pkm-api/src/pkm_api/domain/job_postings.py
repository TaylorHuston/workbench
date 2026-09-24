from __future__ import annotations

from dataclasses import dataclass
from enum import StrEnum


class WorkType(StrEnum):
    REMOTE = "remote"
    HYBRID = "hybrid"
    ONSITE = "onsite"
    UNKNOWN = "unknown"


class Seniority(StrEnum):
    ENTRY = "entry"
    MID = "mid"
    SENIOR = "senior"
    STAFF = "staff"
    PRINCIPAL = "principal"
    MANAGER = "manager"
    DIRECTOR = "director"
    EXECUTIVE = "executive"
    UNKNOWN = "unknown"


class CatalogMatchKind(StrEnum):
    NONE = "none"
    EXACT = "exact"
    POSSIBLE_REPOST = "possibleRepost"


@dataclass(frozen=True, slots=True)
class SalaryRange:
    minimum: int
    maximum: int
    currency: str
    period: str
    type: str


@dataclass(frozen=True, slots=True)
class JobPostingProposal:
    schema_version: str
    posting_key: str
    company: str
    role: str
    source_url: str
    location: str | None
    work_type: WorkType
    seniority: Seniority
    skills: tuple[str, ...]
    evidence_text: str = ""
    salary: SalaryRange | None = None
    application_deadline: str | None = None


@dataclass(frozen=True, slots=True)
class JobPostingAssessment:
    schema_version: str
    interest_level: int
    role_archetype: str
    summary: str
    strengths: tuple[str, ...]
    gaps: tuple[str, ...]
    confirmed_blocker: bool
    unresolved_material_constraint: bool
    major_readiness_gap: bool
    aspirational: bool
    network_signal: bool


@dataclass(frozen=True, slots=True)
class CatalogMatch:
    kind: CatalogMatchKind
    posting_key: str | None = None
    reason: str | None = None


@dataclass(frozen=True, slots=True)
class ValidatedJobPosting:
    proposal: JobPostingProposal
    assessment: JobPostingAssessment
    warnings: tuple[str, ...] = ()
