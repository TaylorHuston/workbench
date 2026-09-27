from __future__ import annotations

import os
import socket
from dataclasses import dataclass
from pathlib import Path

from pkm_api.application.job_processing import (
    CanonicalJobPostingValidator,
    JobLeadProcessor,
)
from pkm_api.application.job_worker import InProcessJobLeadWorker
from pkm_api.infrastructure.codex_auth import resolve_codex_auth_file
from pkm_api.infrastructure.codex_job_assessment import (
    IsolatedCodexJobAssessor,
    IsolationVerification,
    load_assessment_inputs,
)
from pkm_api.infrastructure.linkedin_job_extractor import (
    LinkedInJsonLdJobPostingExtractor,
)
from pkm_api.infrastructure.markdown_job_catalog import MarkdownJobPostingCatalog
from pkm_api.infrastructure.safe_http_job_sources import SafeHttpJobSourceRetriever
from pkm_api.infrastructure.sqlite_job_leads import SqliteJobLeadRepository
from pkm_api.infrastructure.vault_job_materializer import VaultJobPostingMaterializer


@dataclass(frozen=True, slots=True)
class PreparedJobWorker:
    processor: JobLeadProcessor
    isolation: IsolationVerification


def prepare_job_worker(
    *,
    repository: SqliteJobLeadRepository,
    vault_root: Path,
) -> PreparedJobWorker:
    vault = vault_root.resolve(strict=True)
    policy_path = (
        Path(__file__).resolve().parent.parent / "policies/job-assessment-v1.md"
    )
    inputs = load_assessment_inputs(vault_root=vault, policy_path=policy_path)
    assessor = IsolatedCodexJobAssessor(
        policy_text=inputs.policy_text,
        candidate_context=inputs.candidate_context,
        role_archetypes=inputs.role_archetypes,
        auth_file=resolve_codex_auth_file(),
        vault_root=vault,
    )
    isolation = assessor.verify_isolation()
    processor = JobLeadProcessor(
        repository=repository,
        retriever=SafeHttpJobSourceRetriever(),
        extractor=LinkedInJsonLdJobPostingExtractor(),
        catalog=MarkdownJobPostingCatalog(vault),
        assessor=assessor,
        validator=CanonicalJobPostingValidator(
            canonical_skills=inputs.canonical_skills,
            role_archetypes=inputs.role_archetypes,
        ),
        materializer=VaultJobPostingMaterializer(vault),
    )
    return PreparedJobWorker(processor=processor, isolation=isolation)


def build_default_in_process_worker(
    repository: SqliteJobLeadRepository,
    vault_root: Path | None,
) -> InProcessJobLeadWorker:
    if vault_root is None:
        raise ValueError("The in-process worker requires a configured vault root.")
    prepared = prepare_job_worker(repository=repository, vault_root=vault_root)
    return InProcessJobLeadWorker(
        prepared.processor,
        worker_id=f"{socket.gethostname()}:{os.getpid()}",
    )
