from __future__ import annotations

import json
import subprocess
import threading
from contextlib import AbstractContextManager
from pathlib import Path
from types import SimpleNamespace
from typing import Self

import pytest
from openai_codex import ApprovalMode, ExternalMessage

from pkm_api.application.job_processing import JobProcessingError
from pkm_api.domain.job_postings import (
    JobPostingProposal,
    Seniority,
    WorkType,
)
from pkm_api.infrastructure import codex_job_assessment
from pkm_api.infrastructure.codex_job_assessment import (
    IsolatedCodexJobAssessor,
    load_assessment_inputs,
)


class FakeThread:
    def __init__(self, result: object) -> None:
        self._result = result
        self.run_input: object | None = None
        self.output_schema: object | None = None

    def run(self, run_input: object, *, output_schema: object) -> object:
        self.run_input = run_input
        self.output_schema = output_schema
        return self._result


class BlockingThread:
    def __init__(self) -> None:
        self.started = threading.Event()
        self.closed = threading.Event()

    def run(self, run_input: object, *, output_schema: object) -> object:
        self.started.set()
        self.closed.wait(timeout=5)
        raise RuntimeError("transport closed")


class FakeCodex(AbstractContextManager["FakeCodex"]):
    def __init__(self, result: object, *, account_type: str = "chatgpt") -> None:
        self.thread = FakeThread(result)
        self.thread_options: dict[str, object] | None = None
        self.account_type = account_type
        self.refresh_token = False

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def account(self, *, refresh_token: bool = False) -> object:
        self.refresh_token = refresh_token
        account = SimpleNamespace(
            type=self.account_type,
            plan_type=SimpleNamespace(value="pro"),
        )
        return SimpleNamespace(account=SimpleNamespace(root=account))

    def thread_start(self, **kwargs: object) -> FakeThread:
        self.thread_options = kwargs
        return self.thread


class DelayedEnterCodex(FakeCodex):
    def __init__(self) -> None:
        super().__init__(completed_result(valid_payload()))
        self.entered = threading.Event()
        self.allow_enter = threading.Event()
        self.closed = threading.Event()

    def __enter__(self) -> Self:
        self.entered.set()
        self.allow_enter.wait(timeout=5)
        return self

    def close(self) -> None:
        self.closed.set()


class CancellableFakeCodex(FakeCodex):
    def __init__(self) -> None:
        super().__init__(completed_result(valid_payload()))
        self.blocking_thread = BlockingThread()

    def thread_start(self, **kwargs: object) -> BlockingThread:
        self.thread_options = kwargs
        return self.blocking_thread

    def close(self) -> None:
        self.blocking_thread.closed.set()


@pytest.fixture
def proposal() -> JobPostingProposal:
    return JobPostingProposal(
        schema_version="job-posting-proposal/v1",
        posting_key="linkedin:4470613618",
        company="Example Corp",
        role="Platform Engineer",
        source_url="https://www.linkedin.com/jobs/view/4470613618/",
        location="Remote",
        work_type=WorkType.REMOTE,
        seniority=Seniority.SENIOR,
        skills=("Python", "AWS"),
        evidence_text="Build internal deployment automation.",
    )


def completed_result(payload: dict[str, object]) -> object:
    return SimpleNamespace(
        status=SimpleNamespace(value="completed"),
        final_response=json.dumps(payload),
        items=(),
    )


def valid_payload() -> dict[str, object]:
    return {
        "schemaVersion": "job-posting-assessment/v1",
        "interestLevel": 4,
        "roleArchetype": "platform-infrastructure-devops",
        "summary": "Strong current fit with one unresolved constraint.",
        "strengths": ["Relevant automation experience"],
        "gaps": ["On-call scope is unclear"],
        "confirmedBlocker": False,
        "unresolvedMaterialConstraint": True,
        "majorReadinessGap": False,
        "aspirational": False,
        "networkSignal": False,
    }


def test_assessor_uses_ephemeral_tool_denied_isolated_codex_thread(
    tmp_path: Path,
    proposal: JobPostingProposal,
) -> None:
    auth = tmp_path / "real-codex" / "auth.json"
    auth.parent.mkdir()
    auth.write_text("not-a-real-token")
    fake = FakeCodex(completed_result(valid_payload()))
    captured_config: list[object] = []

    def codex_factory(config: object) -> FakeCodex:
        captured_config.append(config)
        return fake

    assessor = IsolatedCodexJobAssessor(
        policy_text="POLICY",
        candidate_context="CANDIDATE",
        role_archetypes={"platform-infrastructure-devops"},
        auth_file=auth,
        vault_root=tmp_path / "vault",
        codex_factory=codex_factory,
    )

    assessment = assessor.assess(proposal)

    assert assessment.interest_level == 4
    assert assessment.network_signal is False
    assert fake.refresh_token is True
    assert len(captured_config) == 1
    launch_args = captured_config[0].launch_args_override
    assert launch_args[:2] == ["/usr/bin/env", "-i"]
    assert not any("OPENAI_API_KEY" in value for value in launch_args)
    assert fake.thread_options is not None
    assert fake.thread_options["approval_mode"] is ApprovalMode.deny_all
    assert fake.thread_options["ephemeral"] is True
    assert "model" not in fake.thread_options
    assert "model_provider" not in fake.thread_options
    thread_config = fake.thread_options["config"]
    assert thread_config["bypass_hook_trust"] is True
    assert thread_config["features"]["hooks"] is True
    assert thread_config["features"]["plugins"] is False
    assert thread_config["features"]["apps"] is False
    assert thread_config["permissions"]["assessment"]["network"] == {"enabled": False}
    filesystem = thread_config["permissions"]["assessment"]["filesystem"]
    assert filesystem[str(Path.home().resolve())] == "deny"
    assert filesystem[str((tmp_path / "vault").resolve())] == "deny"
    assert filesystem[str(auth.parent.resolve())] == "deny"
    assert isinstance(fake.thread.run_input, ExternalMessage)
    assert fake.thread.run_input.tool_name == "untrusted_job_posting"
    assert "Build internal deployment automation." in fake.thread.run_input.content
    assert "CANDIDATE" not in fake.thread.run_input.content
    assert fake.thread.output_schema["additionalProperties"] is False
    assert not Path(fake.thread_options["cwd"]).exists()


def test_assessor_cancellation_closes_the_active_isolated_codex_process(
    tmp_path: Path,
    proposal: JobPostingProposal,
) -> None:
    auth = tmp_path / "auth.json"
    auth.write_text("not-a-real-token")
    fake = CancellableFakeCodex()
    assessor = IsolatedCodexJobAssessor(
        policy_text="POLICY",
        candidate_context="CANDIDATE",
        role_archetypes={"platform-infrastructure-devops"},
        auth_file=auth,
        vault_root=tmp_path / "vault",
        codex_factory=lambda config: fake,
    )
    errors: list[Exception] = []

    def assess() -> None:
        try:
            assessor.assess(proposal)
        except Exception as error:
            errors.append(error)

    thread = threading.Thread(target=assess)
    thread.start()
    assert fake.blocking_thread.started.wait(timeout=1)

    assessor.cancel()
    thread.join(timeout=1)

    assert not thread.is_alive()
    assert fake.blocking_thread.closed.is_set()
    assert len(errors) == 1
    assert isinstance(errors[0], JobProcessingError)
    assert errors[0].code == "assessmentUnavailable"


def test_assessor_cancellation_during_codex_setup_is_not_lost(
    tmp_path: Path,
    proposal: JobPostingProposal,
) -> None:
    auth = tmp_path / "auth.json"
    auth.write_text("not-a-real-token")
    fake = DelayedEnterCodex()
    assessor = IsolatedCodexJobAssessor(
        policy_text="POLICY",
        candidate_context="CANDIDATE",
        role_archetypes={"platform-infrastructure-devops"},
        auth_file=auth,
        vault_root=tmp_path / "vault",
        codex_factory=lambda config: fake,
    )
    errors: list[Exception] = []

    def assess() -> None:
        try:
            assessor.assess(proposal)
        except Exception as error:
            errors.append(error)

    thread = threading.Thread(target=assess)
    thread.start()
    assert fake.entered.wait(timeout=1)

    assessor.cancel()
    fake.allow_enter.set()
    thread.join(timeout=1)

    assert not thread.is_alive()
    assert fake.closed.is_set()
    assert len(errors) == 1
    assert isinstance(errors[0], JobProcessingError)
    assert errors[0].code == "workerStopping"


def test_assessor_rejects_non_chatgpt_authentication_inside_broker(
    tmp_path: Path,
    proposal: JobPostingProposal,
) -> None:
    auth = tmp_path / "auth.json"
    auth.write_text("not-a-real-token")
    assessor = IsolatedCodexJobAssessor(
        policy_text="POLICY",
        candidate_context="CANDIDATE",
        role_archetypes={"platform-infrastructure-devops"},
        auth_file=auth,
        vault_root=tmp_path / "vault",
        codex_factory=lambda config: FakeCodex(
            completed_result(valid_payload()),
            account_type="apiKey",
        ),
    )

    with pytest.raises(JobProcessingError) as raised:
        assessor.assess(proposal)

    assert raised.value.code == "assessmentUnavailable"
    assert raised.value.retryable is True


def test_filesystem_probe_denies_home_vault_auth_and_global_config(
    tmp_path: Path,
) -> None:
    auth = tmp_path / "global-codex" / "auth.json"
    auth.parent.mkdir()
    auth.write_text("fake credential canary")
    (auth.parent / "config.toml").write_text("global config canary")
    vault = tmp_path / "vault"
    candidate = vault / "02-personal/career/strategy/career-advisor-snapshot.md"
    candidate.parent.mkdir(parents=True)
    candidate.write_text("vault canary")
    assessor = IsolatedCodexJobAssessor(
        policy_text="POLICY",
        candidate_context="CANDIDATE",
        role_archetypes={"platform-infrastructure-devops"},
        auth_file=auth,
        vault_root=vault,
    )

    denied = assessor.verify_filesystem_isolation()

    assert denied == 5


def test_filesystem_probe_timeout_is_mapped_without_protected_paths(
    tmp_path: Path,
    monkeypatch: object,
) -> None:
    auth = tmp_path / "global-codex" / "auth.json"
    auth.parent.mkdir()
    auth.write_text("fake credential canary")
    (auth.parent / "config.toml").write_text("global config canary")
    vault = tmp_path / "private-vault"
    candidate = vault / "02-personal/career/strategy/career-advisor-snapshot.md"
    candidate.parent.mkdir(parents=True)
    candidate.write_text("vault canary")
    assessor = IsolatedCodexJobAssessor(
        policy_text="POLICY",
        candidate_context="CANDIDATE",
        role_archetypes={"platform-infrastructure-devops"},
        auth_file=auth,
        vault_root=vault,
    )

    def time_out(command: list[str], **kwargs: object) -> object:
        raise subprocess.TimeoutExpired(command, timeout=30)

    monkeypatch.setattr(codex_job_assessment.subprocess, "run", time_out)

    with pytest.raises(RuntimeError) as raised:
        assessor.verify_filesystem_isolation()

    assert str(raised.value) == "The Codex filesystem isolation probe failed."
    assert str(vault) not in str(raised.value)
    assert str(auth) not in str(raised.value)


def test_assessor_rejects_any_attempted_tool_use(
    tmp_path: Path,
    proposal: JobPostingProposal,
) -> None:
    auth = tmp_path / "auth.json"
    auth.write_text("not-a-real-token")
    fake = FakeCodex(completed_result(valid_payload()))

    def codex_factory(config: object) -> FakeCodex:
        hook_counter = next(
            Path(part.removeprefix("PKM_API_HOOK_COUNTER="))
            for part in config.launch_args_override
            if part.startswith("PKM_API_HOOK_COUNTER=")
        )
        hook_counter.write_text("1\n")
        return fake

    assessor = IsolatedCodexJobAssessor(
        policy_text="POLICY",
        candidate_context="CANDIDATE",
        role_archetypes={"platform-infrastructure-devops"},
        auth_file=auth,
        vault_root=tmp_path / "vault",
        codex_factory=codex_factory,
    )

    with pytest.raises(JobProcessingError) as raised:
        assessor.assess(proposal)

    assert raised.value.code == "assessmentToolAttempt"
    assert raised.value.retryable is False


@pytest.mark.parametrize(
    ("result", "code", "retryable"),
    [
        (
            SimpleNamespace(
                status=SimpleNamespace(value="failed"),
                final_response=None,
                items=(),
            ),
            "assessmentUnavailable",
            True,
        ),
        (
            SimpleNamespace(
                status=SimpleNamespace(value="completed"),
                final_response="not-json",
                items=(),
            ),
            "invalidAssessment",
            False,
        ),
    ],
)
def test_assessor_maps_failures_to_safe_processing_errors(
    tmp_path: Path,
    proposal: JobPostingProposal,
    result: object,
    code: str,
    retryable: bool,
) -> None:
    auth = tmp_path / "auth.json"
    auth.write_text("not-a-real-token")
    assessor = IsolatedCodexJobAssessor(
        policy_text="POLICY",
        candidate_context="CANDIDATE",
        role_archetypes={"platform-infrastructure-devops"},
        auth_file=auth,
        vault_root=tmp_path / "vault",
        codex_factory=lambda config: FakeCodex(result),
    )

    with pytest.raises(JobProcessingError) as raised:
        assessor.assess(proposal)

    assert raised.value.code == code
    assert raised.value.retryable is retryable
    assert "not-json" not in raised.value.safe_message


def test_assessment_inputs_are_loaded_from_confined_bounded_files(
    tmp_path: Path,
) -> None:
    vault = tmp_path / "vault"
    policy = tmp_path / "policy.md"
    skills = vault / "09-system/values/job-posting-skills.md"
    archetypes = vault / "02-personal/career/job-market/role-archetypes.md"
    candidate = vault / "02-personal/career/strategy/career-advisor-snapshot.md"
    skills.parent.mkdir(parents=True)
    archetypes.parent.mkdir(parents=True)
    candidate.parent.mkdir(parents=True)
    policy.write_text("assessment policy")
    skills.write_text("Python\nAWS\n")
    archetypes.write_text(
        "## Canonical `roleArchetype` Values\n\n"
        "- `platform-infrastructure-devops` - Platform\n"
        "- `applied-ai-engineer` - AI\n\n"
        "## Next section\n"
        "- `not-an-archetype`\n"
    )
    candidate.write_text("Candidate summary")

    loaded = load_assessment_inputs(vault_root=vault, policy_path=policy)

    assert loaded.policy_text == "assessment policy"
    assert loaded.canonical_skills == frozenset({"Python", "AWS"})
    assert loaded.role_archetypes == frozenset(
        {"platform-infrastructure-devops", "applied-ai-engineer"}
    )
    assert loaded.candidate_context == "Candidate summary"


def test_assessment_inputs_reject_symlinked_private_context(tmp_path: Path) -> None:
    vault = tmp_path / "vault"
    policy = tmp_path / "policy.md"
    skills = vault / "09-system/values/job-posting-skills.md"
    archetypes = vault / "02-personal/career/job-market/role-archetypes.md"
    candidate = vault / "02-personal/career/strategy/career-advisor-snapshot.md"
    skills.parent.mkdir(parents=True)
    archetypes.parent.mkdir(parents=True)
    candidate.parent.mkdir(parents=True)
    policy.write_text("assessment policy")
    skills.write_text("Python\n")
    archetypes.write_text(
        "## Canonical `roleArchetype` Values\n"
        "- `platform-infrastructure-devops` - Platform\n"
        "## End\n"
    )
    outside = tmp_path / "outside.md"
    outside.write_text("private")
    candidate.symlink_to(outside)

    with pytest.raises(ValueError, match="regular file"):
        load_assessment_inputs(vault_root=vault, policy_path=policy)
