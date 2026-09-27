from __future__ import annotations

import argparse
import os
import socket
import sys
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from pkm_api.infrastructure.codex_auth import CodexAuthenticationError
from pkm_api.infrastructure.job_worker_runtime import prepare_job_worker
from pkm_api.infrastructure.sqlite_job_leads import SqliteJobLeadRepository


class Processor(Protocol):
    def process_next(self, *, worker_id: str) -> object | None: ...


@dataclass(frozen=True, slots=True)
class WorkerRunSummary:
    processed: int
    queue_empty: bool
    statuses: dict[str, int]


def run_worker(
    processor: Processor,
    *,
    worker_id: str,
    max_items: int,
    emit: Callable[[str], None] = print,
) -> WorkerRunSummary:
    if max_items < 1:
        raise ValueError("max_items must be at least 1")
    statuses: Counter[str] = Counter()
    processed = 0
    queue_empty = False
    while processed < max_items:
        result = processor.process_next(worker_id=worker_id)
        if result is None:
            queue_empty = True
            break
        status = _status_value(result)
        resource_id = str(getattr(result, "id", "unknown"))
        statuses[status] += 1
        processed += 1
        emit(f"JobLead {resource_id}: {status}")
    return WorkerRunSummary(
        processed=processed,
        queue_empty=queue_empty,
        statuses=dict(sorted(statuses.items())),
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Process queued JobLeads through isolated assessment and confined "
            "vault materialization."
        )
    )
    parser.add_argument(
        "--vault-root",
        type=Path,
        default=(
            Path(os.environ["PKM_API_VAULT_ROOT"])
            if os.environ.get("PKM_API_VAULT_ROOT")
            else None
        ),
        required=not bool(os.environ.get("PKM_API_VAULT_ROOT")),
    )
    parser.add_argument(
        "--control-db",
        type=Path,
        default=Path(os.environ.get("PKM_API_CONTROL_DB", ".local/pkm-api.sqlite3")),
    )
    parser.add_argument(
        "--max-items",
        type=_positive_integer,
        default=25,
        help="Maximum eligible JobLeads to process in this run (default: 25).",
    )
    parser.add_argument(
        "--worker-id",
        default=f"{socket.gethostname()}:{os.getpid()}",
    )
    parser.add_argument(
        "--verify-isolation-only",
        action="store_true",
        help="Run the live adversarial isolation check without claiming work.",
    )
    args = parser.parse_args()

    try:
        vault_root = args.vault_root.resolve(strict=True)
        repository = SqliteJobLeadRepository(args.control_db)
        prepared = prepare_job_worker(
            repository=repository,
            vault_root=vault_root,
        )
        verification = prepared.isolation
        print(
            "Codex isolation: ready "
            f"(blockedToolAttempts={verification.tool_attempts_blocked}, "
            f"protectedPathsDenied={verification.protected_paths_denied}, "
            f"authMethod={verification.authentication_method})"
        )
        if args.verify_isolation_only:
            return

        repository.initialize()
        summary = run_worker(
            prepared.processor,
            worker_id=args.worker_id,
            max_items=args.max_items,
        )
        statuses = ", ".join(
            f"{status}={count}" for status, count in summary.statuses.items()
        )
        print(
            f"Worker complete: processed={summary.processed}, "
            f"queueEmpty={str(summary.queue_empty).lower()}"
            + (f", {statuses}" if statuses else "")
        )
    except CodexAuthenticationError as error:
        print(
            "Worker unavailable: codexAuthenticationUnavailable",
            file=sys.stderr,
        )
        raise SystemExit(2) from error
    except (OSError, RuntimeError, ValueError) as error:
        print("Worker unavailable: preflightFailed", file=sys.stderr)
        raise SystemExit(2) from error


def _positive_integer(value: str) -> int:
    parsed = int(value)
    if parsed < 1:
        raise argparse.ArgumentTypeError("must be at least 1")
    return parsed


def _status_value(result: object) -> str:
    status = getattr(result, "status", "unknown")
    return str(getattr(status, "value", status))


if __name__ == "__main__":
    main()
