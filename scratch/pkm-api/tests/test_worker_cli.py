from __future__ import annotations

import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

from pkm_api import worker_cli
from pkm_api.infrastructure.codex_job_assessment import IsolationVerification
from pkm_api.infrastructure.job_worker_runtime import PreparedJobWorker
from pkm_api.worker_cli import run_worker


class FakeProcessor:
    def __init__(self, results: list[object | None]) -> None:
        self.results = results
        self.worker_ids: list[str] = []

    def process_next(self, *, worker_id: str) -> object | None:
        self.worker_ids.append(worker_id)
        return self.results.pop(0)


def test_worker_drains_until_queue_is_empty_without_exposing_source_data() -> None:
    processor = FakeProcessor(
        [
            SimpleNamespace(
                id="lead-1",
                status=SimpleNamespace(value="readyForMaterialization"),
                source_url="https://example.test/private-query",
            ),
            SimpleNamespace(
                id="lead-2",
                status=SimpleNamespace(value="alreadyTracked"),
                source_url="https://example.test/other-private-query",
            ),
            None,
        ]
    )
    lines: list[str] = []

    summary = run_worker(
        processor,
        worker_id="worker-test",
        max_items=10,
        emit=lines.append,
    )

    assert summary.processed == 2
    assert summary.queue_empty is True
    assert summary.statuses == {
        "alreadyTracked": 1,
        "readyForMaterialization": 1,
    }
    assert processor.worker_ids == ["worker-test", "worker-test", "worker-test"]
    rendered = "\n".join(lines)
    assert "lead-1" in rendered
    assert "private-query" not in rendered
    assert "other-private-query" not in rendered


def test_worker_isolation_only_uses_broker_auth_not_default_codex(
    tmp_path: Path,
    monkeypatch: object,
    capsys: object,
) -> None:
    vault = tmp_path / "vault"
    vault.mkdir()
    isolation = IsolationVerification(
        tool_attempts_blocked=1,
        protected_paths_denied=5,
        protected_content_disclosed=False,
        authentication_method="chatgpt",
    )
    monkeypatch.setattr(
        worker_cli,
        "prepare_job_worker",
        lambda **kwargs: PreparedJobWorker(
            processor=FakeProcessor([]),
            isolation=isolation,
        ),
    )
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "pkm-api-worker",
            "--vault-root",
            str(vault),
            "--verify-isolation-only",
        ],
    )

    worker_cli.main()

    assert "authMethod=chatgpt" in capsys.readouterr().out


def test_worker_preflight_error_does_not_log_sensitive_paths(
    tmp_path: Path,
    monkeypatch: object,
    capsys: object,
) -> None:
    vault = tmp_path / "private-vault"
    vault.mkdir()
    monkeypatch.setattr(
        worker_cli,
        "prepare_job_worker",
        lambda **kwargs: (_ for _ in ()).throw(
            ValueError(f"private path failed: {vault}/secret.md")
        ),
    )
    monkeypatch.setattr(
        sys,
        "argv",
        ["pkm-api-worker", "--vault-root", str(vault)],
    )

    with pytest.raises(SystemExit) as raised:
        worker_cli.main()

    assert raised.value.code == 2
    captured = capsys.readouterr()
    assert "preflightFailed" in captured.err
    assert str(vault) not in captured.err
    assert "secret.md" not in captured.err


def test_worker_stops_at_explicit_item_limit() -> None:
    processor = FakeProcessor(
        [
            SimpleNamespace(id="lead-1", status=SimpleNamespace(value="failed")),
            SimpleNamespace(id="lead-2", status=SimpleNamespace(value="failed")),
        ]
    )

    summary = run_worker(
        processor,
        worker_id="worker-test",
        max_items=1,
        emit=lambda line: None,
    )

    assert summary.processed == 1
    assert summary.queue_empty is False
    assert processor.worker_ids == ["worker-test"]
