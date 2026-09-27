from __future__ import annotations

import datetime as dt
import fcntl
import hashlib
import os
import re
import stat
import tempfile
import uuid
from collections.abc import Callable, Iterator
from contextlib import contextmanager, suppress
from pathlib import Path
from typing import Any

import yaml

from pkm_api.application.job_leads import canonicalize_job_url
from pkm_api.application.job_processing import (
    JobProcessingError,
    MaterializationResult,
)
from pkm_api.domain.job_leads import JobLead, MaterializationStatus
from pkm_api.domain.job_postings import ValidatedJobPosting

_COMPANIES = Path("02-personal/career/job-market/companies")
_REVIEW_QUEUE = Path("02-personal/career/job-market/role-archetype-review-queue.md")
_PROCESSING_LOG = Path("02-personal/career/job-market/job-processing-log.md")
_NON_ALNUM = re.compile(r"[^a-z0-9]+")
_WHITESPACE = re.compile(r"\s+")
_MAX_NOTE_BYTES = 256 * 1024
_MAX_CATALOG_NOTE_BYTES = 64 * 1024


class VaultJobPostingMaterializer:
    """Create confined, idempotent Markdown records in a private vault."""

    def __init__(
        self,
        vault_root: Path,
        *,
        clock: Callable[[], dt.datetime] | None = None,
    ) -> None:
        if vault_root.is_symlink():
            raise ValueError("vault_root must not be a symlink")
        self._vault_root = vault_root.resolve(strict=True)
        self._companies_root = self._resolve_directory(_COMPANIES)
        self._clock = clock or (lambda: dt.datetime.now(dt.UTC))
        digest = hashlib.sha256(str(self._vault_root).encode()).hexdigest()[:20]
        self._lock_path = Path(tempfile.gettempdir()) / f"pkm-api-vault-{digest}.lock"

    def materialize(
        self,
        posting: ValidatedJobPosting,
        *,
        lead: JobLead,
    ) -> MaterializationResult:
        self._validate_candidate(posting)
        with self._exclusive_lock():
            match_kind, match_path = self._find_match(posting)
            if match_kind == "possible":
                return MaterializationResult(
                    status=MaterializationStatus.POSSIBLE_REPOST,
                    posting_key=posting.proposal.posting_key,
                )

            company_slug = _slug(posting.proposal.company, maximum=80)
            role_slug = _slug(posting.proposal.role, maximum=100)
            identity_slug = _identity_slug(posting.proposal.posting_key)
            company_relative = _COMPANIES / company_slug
            company_note_relative = company_relative / f"{company_slug}-company.md"
            posting_relative = company_relative / f"{role_slug}-{identity_slug}.md"

            if match_kind == "exact" and match_path is not None:
                posting_relative = match_path
            else:
                self._ensure_company_directory(company_slug)
                company_note_relative = self._ensure_company_note(
                    company_slug=company_slug,
                    relative_path=company_note_relative,
                    company_name=posting.proposal.company,
                )
                self._create_posting(
                    relative_path=posting_relative,
                    company_note_relative=company_note_relative,
                    posting=posting,
                )

            self._append_review_queue(posting, posting_relative)
            self._append_processing_log(posting, posting_relative, lead)
            return MaterializationResult(
                status=MaterializationStatus.SUCCEEDED,
                posting_key=posting.proposal.posting_key,
                posting_path=posting_relative.as_posix(),
            )

    def _resolve_directory(self, relative: Path) -> Path:
        current = self._vault_root
        for part in relative.parts:
            candidate = current / part
            if candidate.is_symlink() or not candidate.is_dir():
                raise ValueError(f"Expected a regular vault directory: {relative}")
            current = candidate.resolve(strict=True)
            if not current.is_relative_to(self._vault_root):
                raise ValueError("Vault directory escaped the configured root.")
        return current

    @contextmanager
    def _exclusive_lock(self) -> Iterator[None]:
        descriptor = os.open(
            self._lock_path,
            os.O_CREAT | os.O_RDWR | getattr(os, "O_NOFOLLOW", 0),
            0o600,
        )
        try:
            os.chmod(self._lock_path, 0o600)
            fcntl.flock(descriptor, fcntl.LOCK_EX)
            yield
        finally:
            fcntl.flock(descriptor, fcntl.LOCK_UN)
            os.close(descriptor)

    def _find_match(self, posting: ValidatedJobPosting) -> tuple[str, Path | None]:
        proposal = posting.proposal
        proposed_company = _identity_text(proposal.company)
        proposed_role = _identity_text(proposal.role)
        proposed_url = canonicalize_job_url(proposal.source_url).url
        possible_path: Path | None = None
        try:
            paths = sorted(self._companies_root.rglob("*.md"))
        except OSError as error:
            self._fail(
                "vaultUnavailable",
                "The vault catalog could not be read.",
                error,
            )
        for path in paths:
            if path.is_symlink():
                continue
            resolved = path.resolve()
            if not resolved.is_relative_to(self._companies_root):
                continue
            data = self._read_frontmatter(path, maximum=_MAX_CATALOG_NOTE_BYTES)
            if data.get("class") != "JobPosting":
                continue
            posting_key = _text(data.get("postingKey"))
            external_ids = data.get("externalIds")
            identifiers = (
                {value for item in external_ids if (value := _text(item)) is not None}
                if isinstance(external_ids, list)
                else set()
            )
            source_url = _text(data.get("sourceUrl"))
            if source_url:
                try:
                    source_url = canonicalize_job_url(source_url).url
                except Exception:
                    source_url = None
            relative = resolved.relative_to(self._vault_root)
            if (
                proposal.posting_key == posting_key
                or proposal.posting_key in identifiers
                or proposed_url == source_url
            ):
                return "exact", relative
            company = _text(data.get("company")) or path.parent.name
            company = Path(_wikilink_target(company)).name.removesuffix("-company")
            if (
                _identity_text(company) == proposed_company
                and _identity_text(_text(data.get("role")) or "") == proposed_role
            ):
                possible_path = relative
        return ("possible", possible_path) if possible_path else ("none", None)

    def _ensure_company_directory(self, company_slug: str) -> None:
        try:
            with self._open_directory(_COMPANIES) as companies_fd:
                with suppress(FileExistsError):
                    os.mkdir(company_slug, mode=0o700, dir_fd=companies_fd)
                descriptor = os.open(
                    company_slug,
                    os.O_RDONLY | os.O_DIRECTORY | getattr(os, "O_NOFOLLOW", 0),
                    dir_fd=companies_fd,
                )
                os.close(descriptor)
        except OSError as error:
            raise JobProcessingError(
                "unsafeVaultPath",
                "The Company directory is not a safe vault directory.",
                retryable=False,
            ) from error

    def _ensure_company_note(
        self,
        *,
        company_slug: str,
        relative_path: Path,
        company_name: str,
    ) -> Path:
        company_directory = self._companies_root / company_slug
        candidates: list[Path] = []
        for candidate in sorted(company_directory.glob("*.md")):
            if candidate.is_symlink() or not candidate.is_file():
                continue
            data = self._read_frontmatter(candidate)
            if data.get("class") != "Company":
                continue
            body = self._read_regular(candidate)
            heading = next(
                (line[2:] for line in body.splitlines() if line.startswith("# ")),
                "",
            )
            if heading and _identity_text(heading) == _identity_text(company_name):
                candidates.append(candidate)
        if len(candidates) > 1:
            raise JobProcessingError(
                "companyIdentityConflict",
                "The Company folder contains ambiguous Company records.",
                retryable=False,
            )
        if candidates:
            return candidates[0].resolve().relative_to(self._vault_root)

        path = self._vault_root / relative_path
        if path.exists() or path.is_symlink():
            raise JobProcessingError(
                "companyIdentityConflict",
                "The Company path is already owned by another record.",
                retryable=False,
            )
        content = f"---\nclass: Company\n---\n\n# {_single_line(company_name)}\n"
        self._atomic_create(path, content)
        return relative_path

    def _create_posting(
        self,
        *,
        relative_path: Path,
        company_note_relative: Path,
        posting: ValidatedJobPosting,
    ) -> None:
        path = self._vault_root / relative_path
        content = self._render_posting(posting, company_note_relative)
        try:
            self._atomic_create(path, content)
        except FileExistsError:
            data = self._read_frontmatter(path)
            if data.get("postingKey") != posting.proposal.posting_key:
                raise JobProcessingError(
                    "postingPathConflict",
                    "The JobPosting path is already owned by another record.",
                    retryable=False,
                ) from None

    def _render_posting(
        self,
        posting: ValidatedJobPosting,
        company_note_relative: Path,
    ) -> str:
        proposal = posting.proposal
        assessment = posting.assessment
        captured_date = self._clock().astimezone(dt.UTC).date().isoformat()
        source = canonicalize_job_url(proposal.source_url).source.value
        data: dict[str, object] = {
            "class": "JobPosting",
            "postingKey": proposal.posting_key,
            "externalIds": [proposal.posting_key],
            "company": f"[[{company_note_relative.with_suffix('').as_posix()}]]",
            "role": proposal.role,
            "status": "captured",
            "interestLevel": assessment.interest_level,
            "sourceUrl": proposal.source_url,
            "source": source,
            "capturedDate": captured_date,
            "lastChecked": captured_date,
            "roleArchetype": assessment.role_archetype,
            "workType": proposal.work_type.value,
            "seniority": proposal.seniority.value,
            "skills": list(proposal.skills),
        }
        if proposal.location:
            data["location"] = _single_line(proposal.location)
        if proposal.application_deadline:
            data["applicationDeadline"] = proposal.application_deadline
        if assessment.aspirational:
            data["aspirational"] = True
        if assessment.network_signal:
            data["networkSignal"] = True
        if proposal.salary is not None:
            data.update(
                {
                    "salaryMin": proposal.salary.minimum,
                    "salaryMax": proposal.salary.maximum,
                    "salaryCurrency": proposal.salary.currency,
                    "salaryPeriod": proposal.salary.period,
                    "salaryType": proposal.salary.type,
                }
            )
        frontmatter = yaml.safe_dump(
            data,
            allow_unicode=True,
            sort_keys=False,
            width=1000,
        ).rstrip()
        strengths = "; ".join(_single_line(value) for value in assessment.strengths)
        gaps = "; ".join(_single_line(value) for value in assessment.gaps)
        title = f"{_single_line(proposal.role)} - {_single_line(proposal.company)}"
        return (
            f"---\n{frontmatter}\n---\n\n"
            f"# {title}\n\n"
            "## Assessment\n\n"
            f"{_single_line(assessment.summary)}\n\n"
            "## Fit signals\n\n"
            f"- Strong: {strengths or 'None identified.'}\n"
            f"- Gaps: {gaps or 'None identified.'}\n\n"
            "## Activity\n\n"
            f"- {captured_date}: Captured and assessed automatically.\n"
        )

    def _append_review_queue(
        self,
        posting: ValidatedJobPosting,
        posting_relative: Path,
    ) -> None:
        path = self._vault_root / _REVIEW_QUEUE
        text = self._read_regular(path)
        key = posting.proposal.posting_key
        if f"`{key}`" in text or posting_relative.with_suffix("").as_posix() in text:
            return
        marker = "\n## Completed Reviews"
        if marker not in text:
            raise JobProcessingError(
                "reviewQueueUnavailable",
                "The role-archetype review queue has an unsupported shape.",
                retryable=True,
            )
        captured = self._clock().astimezone(dt.UTC).date().isoformat()
        display = _table_text(f"{posting.proposal.company} - {posting.proposal.role}")
        link = posting_relative.with_suffix("").as_posix().replace("|", "\\|")
        row = (
            f"| {captured} | [[{link}\\|{display}]] | "
            f"`{_table_text(key)}` | "
            f"`{_table_text(posting.assessment.role_archetype)}` |\n"
        )
        prefix, suffix = text.split(marker, 1)
        updated = prefix.rstrip() + "\n" + row + marker + suffix
        self._atomic_replace(path, updated)

    def _append_processing_log(
        self,
        posting: ValidatedJobPosting,
        posting_relative: Path,
        lead: JobLead,
    ) -> None:
        path = self._vault_root / _PROCESSING_LOG
        marker = f"pkm-api-job-lead-added:{lead.id}"
        if path.exists() or path.is_symlink():
            text = self._read_regular(path)
            if marker in text:
                return
            if "| Timestamp | URL | Result | Note |" not in text:
                raise JobProcessingError(
                    "processingLogUnavailable",
                    "The job processing log has an unsupported shape.",
                    retryable=True,
                )
        else:
            text = (
                "# Job Processing Log\n\n"
                "| Timestamp | URL | Result | Note |\n"
                "| --- | --- | --- | --- |\n"
            )
        timestamp = self._clock().astimezone(dt.UTC).strftime("%Y-%m-%d %H:%M UTC")
        link = posting_relative.with_suffix("").as_posix().replace("|", "\\|")
        display = _table_text(f"{posting.proposal.company} - {posting.proposal.role}")
        row = (
            f"| {timestamp} | {_table_text(posting.proposal.source_url)} | added | "
            f"Added [[{link}\\|{display}]]. <!-- {marker} --> |\n"
        )
        self._atomic_replace(path, text.rstrip() + "\n" + row)

    def _read_frontmatter(
        self,
        path: Path,
        *,
        maximum: int = _MAX_NOTE_BYTES,
    ) -> dict[str, Any]:
        text = self._read_regular(path, maximum=maximum)
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

    def _read_regular(self, path: Path, *, maximum: int = _MAX_NOTE_BYTES) -> str:
        if path.is_symlink() or not path.is_file():
            raise JobProcessingError(
                "unsafeVaultPath",
                "A required vault file is not a regular file.",
                retryable=False,
            )
        resolved = path.resolve(strict=True)
        if not resolved.is_relative_to(self._vault_root):
            raise JobProcessingError(
                "unsafeVaultPath",
                "A vault file escaped the configured root.",
                retryable=False,
            )
        if resolved.stat().st_size > maximum:
            raise JobProcessingError(
                "vaultFileTooLarge",
                "A required vault file exceeds the supported size.",
                retryable=False,
            )
        try:
            return resolved.read_text(encoding="utf-8")
        except OSError as error:
            self._fail(
                "vaultUnavailable",
                "A required vault file could not be read.",
                error,
            )

    def _atomic_create(self, path: Path, content: str) -> None:
        relative = self._relative_vault_path(path)
        temporary = f".{path.name}.{uuid.uuid4().hex}.tmp"
        flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0)
        with self._open_directory(relative.parent) as parent_fd:
            descriptor = os.open(temporary, flags, 0o600, dir_fd=parent_fd)
            try:
                with os.fdopen(
                    descriptor,
                    "w",
                    encoding="utf-8",
                    closefd=True,
                ) as handle:
                    handle.write(content)
                    handle.flush()
                    os.fsync(handle.fileno())
                descriptor = -1
                os.link(
                    temporary,
                    path.name,
                    src_dir_fd=parent_fd,
                    dst_dir_fd=parent_fd,
                    follow_symlinks=False,
                )
                os.fsync(parent_fd)
            finally:
                if descriptor >= 0:
                    os.close(descriptor)
                with suppress(FileNotFoundError):
                    os.unlink(temporary, dir_fd=parent_fd)
        self._verify_regular(relative)

    def _atomic_replace(self, path: Path, content: str) -> None:
        relative = self._relative_vault_path(path)
        temporary = f".{path.name}.{uuid.uuid4().hex}.tmp"
        flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0)
        with self._open_directory(relative.parent) as parent_fd:
            try:
                existing = os.stat(path.name, dir_fd=parent_fd, follow_symlinks=False)
            except FileNotFoundError:
                existing = None
            if existing is not None and not stat.S_ISREG(existing.st_mode):
                raise JobProcessingError(
                    "unsafeVaultPath",
                    "A vault destination is not a regular file.",
                    retryable=False,
                )
            descriptor = os.open(temporary, flags, 0o600, dir_fd=parent_fd)
            try:
                with os.fdopen(
                    descriptor,
                    "w",
                    encoding="utf-8",
                    closefd=True,
                ) as handle:
                    handle.write(content)
                    handle.flush()
                    os.fsync(handle.fileno())
                descriptor = -1
                os.replace(
                    temporary,
                    path.name,
                    src_dir_fd=parent_fd,
                    dst_dir_fd=parent_fd,
                )
                os.fsync(parent_fd)
            finally:
                if descriptor >= 0:
                    os.close(descriptor)
                with suppress(FileNotFoundError):
                    os.unlink(temporary, dir_fd=parent_fd)
        self._verify_regular(relative)

    def _verify_regular(self, relative: Path) -> None:
        try:
            with self._open_directory(relative.parent) as parent_fd:
                metadata = os.stat(
                    relative.name,
                    dir_fd=parent_fd,
                    follow_symlinks=False,
                )
                if not stat.S_ISREG(metadata.st_mode):
                    raise OSError("not a regular file")
        except (OSError, JobProcessingError) as error:
            raise JobProcessingError(
                "unsafeVaultPath",
                "The published vault file could not be safely verified.",
                retryable=False,
            ) from error

    @contextmanager
    def _open_directory(self, relative: Path) -> Iterator[int]:
        descriptor = -1
        try:
            descriptor = os.open(
                self._vault_root,
                os.O_RDONLY | os.O_DIRECTORY | getattr(os, "O_NOFOLLOW", 0),
            )
            try:
                for part in relative.parts:
                    if part in {"", ".", ".."}:
                        raise JobProcessingError(
                            "unsafeVaultPath",
                            "The destination path is unsafe.",
                            retryable=False,
                        )
                    child = os.open(
                        part,
                        os.O_RDONLY | os.O_DIRECTORY | getattr(os, "O_NOFOLLOW", 0),
                        dir_fd=descriptor,
                    )
                    os.close(descriptor)
                    descriptor = child
            except OSError as error:
                raise JobProcessingError(
                    "unsafeVaultPath",
                    "The destination path is not a safe vault directory.",
                    retryable=False,
                ) from error
            yield descriptor
        finally:
            if descriptor >= 0:
                os.close(descriptor)

    def _relative_vault_path(self, path: Path) -> Path:
        try:
            relative = path.relative_to(self._vault_root)
        except ValueError as error:
            raise JobProcessingError(
                "unsafeVaultPath",
                "The destination escaped the configured vault root.",
                retryable=False,
            ) from error
        if not relative.parts or any(
            part in {"", ".", ".."} for part in relative.parts
        ):
            raise JobProcessingError(
                "unsafeVaultPath",
                "The destination path is unsafe.",
                retryable=False,
            )
        return relative

    @staticmethod
    def _validate_candidate(posting: ValidatedJobPosting) -> None:
        deadline = posting.proposal.application_deadline
        if deadline:
            try:
                parsed = dt.date.fromisoformat(deadline)
            except ValueError as error:
                raise JobProcessingError(
                    "invalidMaterializationCandidate",
                    "The application deadline is not a valid ISO date.",
                    retryable=False,
                ) from error
            if parsed.isoformat() != deadline:
                raise JobProcessingError(
                    "invalidMaterializationCandidate",
                    "The application deadline is not a canonical ISO date.",
                    retryable=False,
                )

    @staticmethod
    def _fail(code: str, message: str, error: Exception) -> None:
        raise JobProcessingError(code, message, retryable=True) from error


def _slug(value: str, *, maximum: int) -> str:
    normalized = _NON_ALNUM.sub("-", value.lower()).strip("-")
    if not normalized:
        normalized = "record-" + hashlib.sha256(value.encode()).hexdigest()[:12]
    if len(normalized) > maximum:
        digest = hashlib.sha256(value.encode()).hexdigest()[:10]
        normalized = f"{normalized[: maximum - 11].rstrip('-')}-{digest}"
    return normalized


def _identity_slug(posting_key: str) -> str:
    parts = posting_key.split(":")
    source = _slug(parts[0], maximum=24)
    identifier = _slug("-".join(parts[1:]) or posting_key, maximum=48)
    return f"{source}-{identifier}"


def _identity_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def _single_line(value: str) -> str:
    return _WHITESPACE.sub(" ", value).strip()


def _table_text(value: str) -> str:
    return _single_line(value).replace("|", "\\|")


def _wikilink_target(value: str) -> str:
    stripped = value.strip()
    if stripped.startswith("[[") and stripped.endswith("]]"):
        stripped = stripped[2:-2]
    return stripped.split("|", 1)[0]


def _text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None
