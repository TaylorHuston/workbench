from __future__ import annotations

import datetime as dt
import re
from pathlib import Path
from typing import Any

import yaml

from pkm_api.application.job_leads import InvalidJobUrlError, canonicalize_job_url
from pkm_api.application.job_postings import (
    JobPostingCatalogUnavailableError,
    JobPostingSummary,
)
from pkm_api.application.job_processing import JobProcessingError
from pkm_api.domain.job_postings import (
    CatalogMatch,
    CatalogMatchKind,
    JobPostingProposal,
)

_WIKILINK = re.compile(r"^\[\[([^]|]+)(?:\|[^]]+)?]]$")
_NON_ALNUM = re.compile(r"[^a-z0-9]+")


class MarkdownJobPostingCatalog:
    """Read-only exact-identity and possible-repost lookup for vault postings."""

    def __init__(
        self,
        vault_root: Path,
        *,
        postings_root: str = "02-personal/career/job-market/companies",
        max_frontmatter_bytes: int = 64 * 1024,
    ) -> None:
        self._vault_root = vault_root.resolve(strict=True)
        self._postings_root = (self._vault_root / postings_root).resolve(strict=True)
        if not self._postings_root.is_relative_to(self._vault_root):
            raise ValueError("postings_root must remain inside vault_root")
        self._max_frontmatter_bytes = max_frontmatter_bytes

    def find_match(self, proposal: JobPostingProposal) -> CatalogMatch:
        possible = False
        proposed_company = _normalize_company(proposal.company)
        proposed_role = _normalize_text(proposal.role)
        proposed_url = _canonical_or_original(proposal.source_url)
        try:
            paths = sorted(self._postings_root.rglob("*.md"))
        except OSError as error:
            raise JobProcessingError(
                "catalogUnavailable",
                "The JobPosting catalog could not be read.",
                retryable=True,
            ) from error

        for path in paths:
            if path.is_symlink():
                continue
            resolved = path.resolve()
            if not resolved.is_relative_to(self._postings_root):
                continue
            data = self._frontmatter(resolved)
            if data.get("class") != "JobPosting":
                continue
            posting_key = _string(data.get("postingKey"))
            raw_external_ids = data.get("externalIds", [])
            external_ids = (
                {
                    identifier
                    for item in raw_external_ids
                    if (identifier := _string(item)) is not None
                }
                if isinstance(raw_external_ids, list)
                else set()
            )
            source_url = _canonical_or_original(_string(data.get("sourceUrl")))
            if (
                proposal.posting_key == posting_key
                or proposal.posting_key in external_ids
                or (proposed_url and proposed_url == source_url)
            ):
                return CatalogMatch(
                    CatalogMatchKind.EXACT,
                    posting_key=posting_key or proposal.posting_key,
                )

            company = _normalize_company(
                _string(data.get("company")) or path.parent.name
            )
            role = _normalize_text(_string(data.get("role")))
            if company == proposed_company and role == proposed_role:
                possible = True

        if possible:
            return CatalogMatch(
                CatalogMatchKind.POSSIBLE_REPOST,
                reason="companyRoleMatch",
            )
        return CatalogMatch(CatalogMatchKind.NONE)

    def list_summaries(self) -> list[JobPostingSummary]:
        summaries: list[JobPostingSummary] = []
        try:
            paths = sorted(self._postings_root.rglob("*.md"))
            for path in paths:
                if path.is_symlink():
                    continue
                resolved = path.resolve()
                if not resolved.is_relative_to(self._postings_root):
                    continue
                data = self._frontmatter(resolved)
                if data.get("class") != "JobPosting" or data.get("archived") is True:
                    continue
                relative_path = resolved.relative_to(self._vault_root).as_posix()
                summaries.append(
                    JobPostingSummary(
                        posting_key=(
                            _string(data.get("postingKey")) or f"path:{relative_path}"
                        ),
                        company=_company_identifier(
                            _string(data.get("company")) or path.parent.name
                        ),
                        role=_string(data.get("role")) or path.stem,
                        status=_string(data.get("status")) or "unknown",
                        interest_level=_integer(data.get("interestLevel")),
                        source_url=_string(data.get("sourceUrl")),
                        captured_date=_date_string(data.get("capturedDate")),
                        role_archetype=_string(data.get("roleArchetype")),
                        work_type=_string(data.get("workType")) or "unknown",
                        seniority=_string(data.get("seniority")) or "unknown",
                        path=relative_path,
                    )
                )
        except JobProcessingError as error:
            raise JobPostingCatalogUnavailableError(
                "The JobPosting catalog could not be read."
            ) from error
        except OSError as error:
            raise JobPostingCatalogUnavailableError(
                "The JobPosting catalog could not be read."
            ) from error
        return summaries

    def _frontmatter(self, path: Path) -> dict[str, Any]:
        try:
            with path.open("rb") as handle:
                content = handle.read(self._max_frontmatter_bytes + 1)
        except OSError as error:
            raise JobProcessingError(
                "catalogUnavailable",
                "The JobPosting catalog could not be read.",
                retryable=True,
            ) from error
        text = content.decode("utf-8", errors="replace")
        if not text.startswith("---\n"):
            return {}
        end = text.find("\n---", 4)
        if end < 0:
            return {}
        try:
            loaded = yaml.safe_load(text[4:end])
        except yaml.YAMLError:
            return {}
        return loaded if isinstance(loaded, dict) else {}


def _canonical_or_original(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return canonicalize_job_url(value).url
    except InvalidJobUrlError:
        return value


def _company_identifier(value: str) -> str:
    match = _WIKILINK.fullmatch(value.strip())
    if match:
        value = Path(match.group(1)).name
    return value.removesuffix("-company")


def _normalize_company(value: str) -> str:
    match = _WIKILINK.fullmatch(value.strip())
    if match:
        value = Path(match.group(1)).name
    normalized = _normalize_text(value)
    return normalized.removesuffix("company")


def _normalize_text(value: str | None) -> str:
    return _NON_ALNUM.sub("", (value or "").lower())


def _string(value: object) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _integer(value: object) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _date_string(value: object) -> str | None:
    if isinstance(value, (dt.date, dt.datetime)):
        return value.isoformat()
    return _string(value)
