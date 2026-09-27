from __future__ import annotations

import datetime as dt
import json
import os
import sqlite3
import uuid
from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from pathlib import Path

from pkm_api.application.job_leads import (
    CreateJobLeadResult,
    IdempotencyKeyConflictError,
    JobLeadCursor,
    JobLeadNotFoundError,
    JobLeadNotRetryableError,
    PreconditionFailedError,
    RetryJobLeadResult,
)
from pkm_api.application.job_processing import (
    JobLeadLeaseLostError,
    JobProcessingError,
)
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
    JobPostingAssessment,
    JobPostingProposal,
    SalaryRange,
    Seniority,
    ValidatedJobPosting,
    WorkType,
)

_SCHEMA_VERSION = 4


class UnsupportedControlStoreVersionError(RuntimeError):
    pass


class SqliteJobLeadRepository:
    def __init__(self, database_path: Path) -> None:
        self._database_path = database_path

    def initialize(self) -> None:
        directory_created = not self._database_path.parent.exists()
        self._database_path.parent.mkdir(parents=True, exist_ok=True)
        if directory_created:
            os.chmod(self._database_path.parent, 0o700)
        database_created = not self._database_path.exists()
        with self._connect() as connection:
            if database_created:
                os.chmod(self._database_path, 0o600)
            connection.execute("BEGIN IMMEDIATE")
            version = int(connection.execute("PRAGMA user_version").fetchone()[0])
            if version > _SCHEMA_VERSION:
                raise UnsupportedControlStoreVersionError(
                    f"Control store schema v{version} is newer than supported "
                    f"v{_SCHEMA_VERSION}."
                )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS job_leads (
                    id TEXT PRIMARY KEY,
                    version INTEGER NOT NULL CHECK (version >= 1),
                    source_url TEXT NOT NULL,
                    source_key TEXT NOT NULL UNIQUE,
                    source TEXT NOT NULL,
                    posting_key TEXT,
                    discovered_by TEXT NOT NULL,
                    source_reference TEXT,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL
                )
                """
            )
            if version < _SCHEMA_VERSION:
                self._migrate_job_leads(connection)
            self._create_control_tables(connection)
            connection.execute(
                """
                INSERT OR IGNORE INTO job_lead_source_aliases (source_key, resource_id)
                SELECT source_key, id FROM job_leads
                """
            )
            if version < _SCHEMA_VERSION:
                connection.execute(f"PRAGMA user_version = {_SCHEMA_VERSION}")

    def create_or_get(
        self,
        lead: JobLead,
        *,
        operation: str,
        idempotency_key: str,
        request_digest: str,
        idempotency_expires_at: dt.datetime,
    ) -> CreateJobLeadResult:
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            replay_id = self._check_idempotency(
                connection,
                operation=operation,
                idempotency_key=idempotency_key,
                request_digest=request_digest,
                now=lead.created_at,
            )
            if replay_id is not None:
                return CreateJobLeadResult(
                    job_lead=self._get(connection, replay_id),
                    created=False,
                    idempotency_replayed=True,
                )

            existing = connection.execute(
                """
                SELECT job_leads.*
                FROM job_lead_source_aliases
                JOIN job_leads ON job_leads.id = job_lead_source_aliases.resource_id
                WHERE job_lead_source_aliases.source_key = ?
                """,
                (lead.source_key,),
            ).fetchone()
            created = existing is None
            if created:
                self._insert_job_lead(connection, lead)
                connection.execute(
                    """
                    INSERT INTO job_lead_source_aliases (source_key, resource_id)
                    VALUES (?, ?)
                    """,
                    (lead.source_key, lead.id),
                )
                selected = lead
                self._record_event(
                    connection,
                    selected,
                    event_type="created",
                    from_status=None,
                    occurred_at=lead.created_at,
                )
            else:
                selected = self._to_job_lead(existing)

            self._record_idempotency(
                connection,
                operation=operation,
                idempotency_key=idempotency_key,
                request_digest=request_digest,
                resource_id=selected.id,
                created_at=lead.created_at,
                expires_at=idempotency_expires_at,
            )
            return CreateJobLeadResult(job_lead=selected, created=created)

    def get(self, job_lead_id: str) -> JobLead:
        with self._connect() as connection:
            return self._get(connection, job_lead_id)

    def list(
        self,
        *,
        statuses: Sequence[JobLeadStatus],
        limit: int,
        cursor: JobLeadCursor | None,
    ) -> tuple[list[JobLead], bool]:
        clauses: list[str] = []
        parameters: list[object] = []
        if statuses:
            placeholders = ", ".join("?" for _ in statuses)
            clauses.append(f"status IN ({placeholders})")
            parameters.extend(status.value for status in statuses)
        if cursor is not None:
            clauses.append("(created_at < ? OR (created_at = ? AND id < ?))")
            created_at = cursor.created_at.isoformat()
            parameters.extend((created_at, created_at, cursor.id))
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        parameters.append(limit + 1)
        with self._connect() as connection:
            rows = connection.execute(
                f"""
                SELECT * FROM job_leads
                {where}
                ORDER BY created_at DESC, id DESC
                LIMIT ?
                """,
                parameters,
            ).fetchall()
        has_more = len(rows) > limit
        return [self._to_job_lead(row) for row in rows[:limit]], has_more

    def retry(
        self,
        job_lead_id: str,
        *,
        expected_version: int,
        operation: str,
        idempotency_key: str,
        request_digest: str,
        idempotency_expires_at: dt.datetime,
        now: dt.datetime,
    ) -> RetryJobLeadResult:
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            replay_id = self._check_idempotency(
                connection,
                operation=operation,
                idempotency_key=idempotency_key,
                request_digest=request_digest,
                now=now,
            )
            if replay_id is not None:
                return RetryJobLeadResult(
                    job_lead=self._get(connection, replay_id),
                    idempotency_replayed=True,
                )

            current = self._get(connection, job_lead_id)
            if current.version != expected_version:
                raise PreconditionFailedError(job_lead_id)
            if current.status is not JobLeadStatus.FAILED:
                raise JobLeadNotRetryableError(job_lead_id)

            connection.execute(
                """
                UPDATE job_leads
                SET version = version + 1,
                    status = ?, stage = ?, retry_count = retry_count + 1,
                    next_attempt_at = ?, last_error_code = NULL,
                    last_error_message = NULL, last_error_retryable = NULL,
                    outcome_json = NULL, updated_at = ?,
                    lease_owner = NULL, lease_token = NULL,
                    lease_expires_at = NULL
                WHERE id = ? AND version = ?
                """,
                (
                    JobLeadStatus.QUEUED.value,
                    JobLeadStage.PENDING.value,
                    now.isoformat(),
                    now.isoformat(),
                    job_lead_id,
                    expected_version,
                ),
            )
            updated = self._get(connection, job_lead_id)
            self._record_event(
                connection,
                updated,
                event_type="manuallyRetried",
                from_status=current.status,
                occurred_at=now,
            )
            self._record_idempotency(
                connection,
                operation=operation,
                idempotency_key=idempotency_key,
                request_digest=request_digest,
                resource_id=job_lead_id,
                created_at=now,
                expires_at=idempotency_expires_at,
            )
            return RetryJobLeadResult(job_lead=updated)

    def purge_expired(self, *, now: dt.datetime) -> int:
        terminal_statuses = (
            JobLeadStatus.READY_FOR_MATERIALIZATION,
            JobLeadStatus.ALREADY_TRACKED,
            JobLeadStatus.POSSIBLE_REPOST,
            JobLeadStatus.SKIPPED,
            JobLeadStatus.MATERIALIZED,
            JobLeadStatus.FAILED,
        )
        placeholders = ", ".join("?" for _ in terminal_statuses)
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            rows = connection.execute(
                f"""
                SELECT id FROM job_leads
                WHERE expires_at <= ? AND status IN ({placeholders})
                """,
                (now.isoformat(), *(item.value for item in terminal_statuses)),
            ).fetchall()
            identifiers = [str(row["id"]) for row in rows]
            for identifier in identifiers:
                connection.execute(
                    "DELETE FROM job_lead_source_aliases WHERE resource_id = ?",
                    (identifier,),
                )
                connection.execute(
                    "DELETE FROM idempotency_records WHERE resource_id = ?",
                    (identifier,),
                )
                connection.execute(
                    "DELETE FROM job_lead_attempts WHERE job_lead_id = ?",
                    (identifier,),
                )
                connection.execute(
                    "DELETE FROM job_lead_events WHERE job_lead_id = ?",
                    (identifier,),
                )
                connection.execute("DELETE FROM job_leads WHERE id = ?", (identifier,))
            connection.execute(
                "DELETE FROM idempotency_records WHERE expires_at <= ?",
                (now.isoformat(),),
            )
            return len(identifiers)

    def claim_next(
        self,
        *,
        worker_id: str,
        now: dt.datetime,
        lease_duration: dt.timedelta,
    ) -> JobLeadClaim | None:
        lease_token = str(uuid.uuid4())
        lease_expires_at = now + lease_duration
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            while True:
                row = connection.execute(
                    """
                    SELECT * FROM job_leads
                    WHERE (
                        status = ? AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
                    ) OR (
                        status = ? AND lease_expires_at <= ?
                    ) OR (
                        status = ? AND materialization_candidate_json IS NOT NULL
                    )
                    ORDER BY
                        CASE WHEN status = 'readyForMaterialization' THEN 1 ELSE 0 END,
                        created_at ASC,
                        id ASC
                    LIMIT 1
                    """,
                    (
                        JobLeadStatus.QUEUED.value,
                        now.isoformat(),
                        JobLeadStatus.PROCESSING.value,
                        now.isoformat(),
                        JobLeadStatus.READY_FOR_MATERIALIZATION.value,
                    ),
                ).fetchone()
                if row is None:
                    return None
                current = self._to_job_lead(row)
                previous_lease_token = row["lease_token"]
                if current.status is JobLeadStatus.PROCESSING and previous_lease_token:
                    connection.execute(
                        """
                        UPDATE job_lead_attempts
                        SET completed_at = ?, outcome = 'leaseExpired',
                            error_code = 'leaseExpired'
                        WHERE lease_token = ? AND completed_at IS NULL
                        """,
                        (now.isoformat(), previous_lease_token),
                    )
                    if (
                        self._attempts_in_generation(connection, current)
                        >= current.max_attempts
                    ):
                        self._fail_expired_attempt_budget(connection, current, now)
                        continue
                break
            resume_materialization = row["materialization_candidate_json"] is not None
            claimed_stage = (
                JobLeadStage.MATERIALIZING
                if resume_materialization
                else JobLeadStage.RETRIEVING
            )
            connection.execute(
                """
                UPDATE job_leads
                SET version = version + 1, status = ?, stage = ?,
                    attempt_count = attempt_count + 1,
                    updated_at = ?, next_attempt_at = NULL,
                    lease_owner = ?, lease_token = ?, lease_expires_at = ?
                WHERE id = ?
                """,
                (
                    JobLeadStatus.PROCESSING.value,
                    claimed_stage.value,
                    now.isoformat(),
                    worker_id,
                    lease_token,
                    lease_expires_at.isoformat(),
                    current.id,
                ),
            )
            claimed = self._get(connection, current.id)
            connection.execute(
                """
                INSERT INTO job_lead_attempts (
                    job_lead_id, attempt_number, retry_generation,
                    worker_id, lease_token, started_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    claimed.id,
                    claimed.attempt_count,
                    claimed.retry_count,
                    worker_id,
                    lease_token,
                    now.isoformat(),
                ),
            )
            self._record_event(
                connection,
                claimed,
                event_type="claimed",
                from_status=current.status,
                occurred_at=now,
            )
            return JobLeadClaim(
                job_lead=claimed,
                worker_id=worker_id,
                lease_token=lease_token,
                lease_expires_at=lease_expires_at,
            )

    def reconcile_source_alias(
        self,
        claim: JobLeadClaim,
        *,
        canonical_url: str,
        source_key: str,
        source: JobLeadSource,
        posting_key: str | None,
        now: dt.datetime,
    ) -> tuple[JobLeadClaim, JobLead | None]:
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            active = connection.execute(
                """
                SELECT id FROM job_leads
                WHERE id = ? AND status = ? AND lease_token = ?
                    AND lease_expires_at > ?
                """,
                (
                    claim.job_lead.id,
                    JobLeadStatus.PROCESSING.value,
                    claim.lease_token,
                    now.isoformat(),
                ),
            ).fetchone()
            if active is None:
                raise JobLeadLeaseLostError(claim.job_lead.id)
            existing_alias = connection.execute(
                """
                SELECT resource_id FROM job_lead_source_aliases
                WHERE source_key = ?
                """,
                (source_key,),
            ).fetchone()
            if (
                existing_alias is not None
                and existing_alias["resource_id"] != claim.job_lead.id
            ):
                existing_id = str(existing_alias["resource_id"])
                return claim, self._get(connection, existing_id)
            connection.execute(
                """
                INSERT OR IGNORE INTO job_lead_source_aliases (source_key, resource_id)
                VALUES (?, ?)
                """,
                (source_key, claim.job_lead.id),
            )
            connection.execute(
                """
                UPDATE job_leads
                SET version = version + 1, source_url = ?, source_key = ?,
                    source = ?, posting_key = COALESCE(?, posting_key), updated_at = ?
                WHERE id = ?
                """,
                (
                    canonical_url,
                    source_key,
                    source.value,
                    posting_key,
                    now.isoformat(),
                    claim.job_lead.id,
                ),
            )
            lead = self._get(connection, claim.job_lead.id)
            return (
                JobLeadClaim(
                    job_lead=lead,
                    worker_id=claim.worker_id,
                    lease_token=claim.lease_token,
                    lease_expires_at=claim.lease_expires_at,
                ),
                None,
            )

    def advance_claim(
        self,
        claim: JobLeadClaim,
        *,
        stage: JobLeadStage,
        now: dt.datetime,
        lease_duration: dt.timedelta,
    ) -> JobLeadClaim:
        lease_expires_at = now + lease_duration
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            changed = connection.execute(
                """
                UPDATE job_leads
                SET version = version + 1, stage = ?, updated_at = ?,
                    lease_expires_at = ?
                WHERE id = ? AND status = ? AND lease_token = ?
                    AND lease_expires_at > ?
                """,
                (
                    stage.value,
                    now.isoformat(),
                    lease_expires_at.isoformat(),
                    claim.job_lead.id,
                    JobLeadStatus.PROCESSING.value,
                    claim.lease_token,
                    now.isoformat(),
                ),
            ).rowcount
            if changed != 1:
                raise JobLeadLeaseLostError(claim.job_lead.id)
            lead = self._get(connection, claim.job_lead.id)
            return JobLeadClaim(
                job_lead=lead,
                worker_id=claim.worker_id,
                lease_token=claim.lease_token,
                lease_expires_at=lease_expires_at,
            )

    def save_materialization_candidate(
        self,
        claim: JobLeadClaim,
        *,
        posting: ValidatedJobPosting,
        now: dt.datetime,
        lease_duration: dt.timedelta,
    ) -> JobLeadClaim:
        lease_expires_at = now + lease_duration
        candidate = self._materialization_candidate_json(posting)
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            changed = connection.execute(
                """
                UPDATE job_leads
                SET version = version + 1, stage = ?, updated_at = ?,
                    lease_expires_at = ?, materialization_candidate_json = ?
                WHERE id = ? AND status = ? AND lease_token = ?
                    AND lease_expires_at > ?
                """,
                (
                    JobLeadStage.MATERIALIZING.value,
                    now.isoformat(),
                    lease_expires_at.isoformat(),
                    candidate,
                    claim.job_lead.id,
                    JobLeadStatus.PROCESSING.value,
                    claim.lease_token,
                    now.isoformat(),
                ),
            ).rowcount
            if changed != 1:
                raise JobLeadLeaseLostError(claim.job_lead.id)
            lead = self._get(connection, claim.job_lead.id)
            return JobLeadClaim(
                job_lead=lead,
                worker_id=claim.worker_id,
                lease_token=claim.lease_token,
                lease_expires_at=lease_expires_at,
            )

    def load_materialization_candidate(
        self,
        claim: JobLeadClaim,
    ) -> ValidatedJobPosting:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT materialization_candidate_json
                FROM job_leads
                WHERE id = ? AND status = ? AND lease_token = ?
                """,
                (
                    claim.job_lead.id,
                    JobLeadStatus.PROCESSING.value,
                    claim.lease_token,
                ),
            ).fetchone()
        if row is None:
            raise JobLeadLeaseLostError(claim.job_lead.id)
        value = row["materialization_candidate_json"]
        if value is None:
            raise JobProcessingError(
                "materializationCandidateUnavailable",
                "The validated materialization candidate is unavailable.",
                retryable=False,
            )
        try:
            return self._materialization_candidate(str(value))
        except (KeyError, TypeError, ValueError, json.JSONDecodeError) as error:
            raise JobProcessingError(
                "materializationCandidateInvalid",
                "The validated materialization candidate is invalid.",
                retryable=False,
            ) from error

    def complete_claim(
        self,
        claim: JobLeadClaim,
        *,
        status: JobLeadStatus,
        outcome: JobLeadOutcome,
        now: dt.datetime,
    ) -> JobLead:
        if status in {JobLeadStatus.QUEUED, JobLeadStatus.PROCESSING}:
            raise ValueError("completion status must be terminal")
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            changed = connection.execute(
                """
                UPDATE job_leads
                SET version = version + 1, status = ?, stage = ?,
                    posting_key = COALESCE(?, posting_key), outcome_json = ?,
                    updated_at = ?, lease_owner = NULL, lease_token = NULL,
                    lease_expires_at = NULL, materialization_candidate_json = NULL,
                    last_error_code = NULL, last_error_message = NULL,
                    last_error_retryable = NULL
                WHERE id = ? AND status = ? AND lease_token = ?
                    AND lease_expires_at > ?
                """,
                (
                    status.value,
                    JobLeadStage.COMPLETED.value,
                    outcome.posting_key,
                    self._outcome_json(outcome),
                    now.isoformat(),
                    claim.job_lead.id,
                    JobLeadStatus.PROCESSING.value,
                    claim.lease_token,
                    now.isoformat(),
                ),
            ).rowcount
            if changed != 1:
                raise JobLeadLeaseLostError(claim.job_lead.id)
            completed = self._get(connection, claim.job_lead.id)
            connection.execute(
                """
                UPDATE job_lead_attempts
                SET completed_at = ?, outcome = ?
                WHERE lease_token = ?
                """,
                (now.isoformat(), status.value, claim.lease_token),
            )
            self._record_event(
                connection,
                completed,
                event_type="completed",
                from_status=JobLeadStatus.PROCESSING,
                occurred_at=now,
            )
            return completed

    def fail_claim(
        self,
        claim: JobLeadClaim,
        *,
        error: JobLeadError,
        now: dt.datetime,
    ) -> JobLead:
        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            current = self._get(connection, claim.job_lead.id)
            attempts_in_generation = self._attempts_in_generation(connection, current)
            will_retry = (
                error.retryable and attempts_in_generation < current.max_attempts
            )
            status = JobLeadStatus.QUEUED if will_retry else JobLeadStatus.FAILED
            stage = JobLeadStage.PENDING if will_retry else JobLeadStage.COMPLETED
            next_attempt_at = None
            if will_retry:
                delay_seconds = min(
                    3600,
                    60 * (2 ** max(0, attempts_in_generation - 1)),
                )
                next_attempt_at = now + dt.timedelta(seconds=delay_seconds)

            changed = connection.execute(
                """
                UPDATE job_leads
                SET version = version + 1, status = ?, stage = ?,
                    next_attempt_at = ?, last_error_code = ?,
                    last_error_message = ?, last_error_retryable = ?,
                    materialization_candidate_json = CASE
                        WHEN ? THEN materialization_candidate_json ELSE NULL END,
                    updated_at = ?, lease_owner = NULL, lease_token = NULL,
                    lease_expires_at = NULL
                WHERE id = ? AND status = ? AND lease_token = ?
                    AND lease_expires_at > ?
                """,
                (
                    status.value,
                    stage.value,
                    next_attempt_at.isoformat() if next_attempt_at else None,
                    error.code,
                    error.message,
                    int(error.retryable),
                    int(will_retry),
                    now.isoformat(),
                    claim.job_lead.id,
                    JobLeadStatus.PROCESSING.value,
                    claim.lease_token,
                    now.isoformat(),
                ),
            ).rowcount
            if changed != 1:
                raise JobLeadLeaseLostError(claim.job_lead.id)
            failed = self._get(connection, claim.job_lead.id)
            connection.execute(
                """
                UPDATE job_lead_attempts
                SET completed_at = ?, outcome = ?, error_code = ?
                WHERE lease_token = ?
                """,
                (
                    now.isoformat(),
                    "requeued" if will_retry else "failed",
                    error.code,
                    claim.lease_token,
                ),
            )
            self._record_event(
                connection,
                failed,
                event_type="requeued" if will_retry else "failed",
                from_status=JobLeadStatus.PROCESSING,
                occurred_at=now,
                error_code=error.code,
            )
            return failed

    @staticmethod
    def _attempts_in_generation(connection: sqlite3.Connection, lead: JobLead) -> int:
        row = connection.execute(
            """
            SELECT COUNT(*) AS count
            FROM job_lead_attempts
            WHERE job_lead_id = ? AND retry_generation = ?
            """,
            (lead.id, lead.retry_count),
        ).fetchone()
        return int(row["count"])

    def _fail_expired_attempt_budget(
        self,
        connection: sqlite3.Connection,
        lead: JobLead,
        now: dt.datetime,
    ) -> None:
        message = "The worker lease expired and the attempt budget was exhausted."
        connection.execute(
            """
            UPDATE job_leads
            SET version = version + 1, status = ?, stage = ?,
                next_attempt_at = NULL, last_error_code = 'leaseExpired',
                last_error_message = ?, last_error_retryable = 1,
                updated_at = ?, lease_owner = NULL, lease_token = NULL,
                lease_expires_at = NULL, materialization_candidate_json = NULL
            WHERE id = ? AND status = ?
            """,
            (
                JobLeadStatus.FAILED.value,
                JobLeadStage.COMPLETED.value,
                message,
                now.isoformat(),
                lead.id,
                JobLeadStatus.PROCESSING.value,
            ),
        )
        failed = self._get(connection, lead.id)
        self._record_event(
            connection,
            failed,
            event_type="failed",
            from_status=JobLeadStatus.PROCESSING,
            occurred_at=now,
            error_code="leaseExpired",
        )

    @staticmethod
    def _create_control_tables(connection: sqlite3.Connection) -> None:
        statements = (
            """
            CREATE TABLE IF NOT EXISTS idempotency_records (
                operation TEXT NOT NULL,
                idempotency_key TEXT NOT NULL,
                request_digest TEXT NOT NULL,
                resource_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                PRIMARY KEY (operation, idempotency_key),
                FOREIGN KEY (resource_id) REFERENCES job_leads(id)
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS job_lead_source_aliases (
                source_key TEXT PRIMARY KEY,
                resource_id TEXT NOT NULL,
                FOREIGN KEY (resource_id) REFERENCES job_leads(id)
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS job_lead_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_lead_id TEXT NOT NULL,
                attempt_number INTEGER NOT NULL,
                retry_generation INTEGER NOT NULL,
                worker_id TEXT NOT NULL,
                lease_token TEXT NOT NULL UNIQUE,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                outcome TEXT,
                error_code TEXT,
                FOREIGN KEY (job_lead_id) REFERENCES job_leads(id)
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS job_lead_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_lead_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                from_status TEXT,
                to_status TEXT NOT NULL,
                version INTEGER NOT NULL,
                error_code TEXT,
                occurred_at TEXT NOT NULL,
                FOREIGN KEY (job_lead_id) REFERENCES job_leads(id)
            )
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_job_lead_source_alias_resource
            ON job_lead_source_aliases (resource_id)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_job_leads_list
            ON job_leads (created_at DESC, id DESC)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_job_leads_claim
            ON job_leads (status, next_attempt_at, created_at)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_job_lead_events_resource
            ON job_lead_events (job_lead_id, id)
            """,
        )
        for statement in statements:
            connection.execute(statement)

    def _migrate_job_leads(self, connection: sqlite3.Connection) -> None:
        columns = {
            str(row["name"])
            for row in connection.execute("PRAGMA table_info(job_leads)").fetchall()
        }
        additions = {
            "stage": "TEXT NOT NULL DEFAULT 'pending'",
            "attempt_count": "INTEGER NOT NULL DEFAULT 0",
            "retry_count": "INTEGER NOT NULL DEFAULT 0",
            "max_attempts": "INTEGER NOT NULL DEFAULT 3",
            "next_attempt_at": "TEXT",
            "last_error_code": "TEXT",
            "last_error_message": "TEXT",
            "last_error_retryable": "INTEGER",
            "outcome_json": "TEXT",
            "lease_owner": "TEXT",
            "lease_token": "TEXT",
            "lease_expires_at": "TEXT",
            "materialization_candidate_json": "TEXT",
        }
        for name, declaration in additions.items():
            if name not in columns:
                connection.execute(
                    f"ALTER TABLE job_leads ADD COLUMN {name} {declaration}"
                )
        connection.execute(
            """
            UPDATE job_leads
            SET status = ?, stage = ?
            WHERE status = 'duplicate'
            """,
            (
                JobLeadStatus.ALREADY_TRACKED.value,
                JobLeadStage.COMPLETED.value,
            ),
        )
        connection.execute(
            """
            UPDATE job_leads
            SET next_attempt_at = COALESCE(next_attempt_at, created_at)
            WHERE status = ?
            """,
            (JobLeadStatus.QUEUED.value,),
        )

    def _insert_job_lead(self, connection: sqlite3.Connection, lead: JobLead) -> None:
        connection.execute(
            """
            INSERT INTO job_leads (
                id, version, source_url, source_key, source, posting_key,
                discovered_by, source_reference, status, stage,
                attempt_count, retry_count, max_attempts, next_attempt_at,
                last_error_code, last_error_message, last_error_retryable,
                outcome_json, lease_owner, lease_token, lease_expires_at,
                materialization_candidate_json, created_at, updated_at, expires_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                NULL, NULL, NULL, NULL, ?, ?, ?
            )
            """,
            (
                lead.id,
                lead.version,
                lead.source_url,
                lead.source_key,
                lead.source.value,
                lead.posting_key,
                lead.discovered_by,
                lead.source_reference,
                lead.status.value,
                lead.stage.value,
                lead.attempt_count,
                lead.retry_count,
                lead.max_attempts,
                lead.next_attempt_at.isoformat() if lead.next_attempt_at else None,
                lead.last_error.code if lead.last_error else None,
                lead.last_error.message if lead.last_error else None,
                int(lead.last_error.retryable) if lead.last_error else None,
                self._outcome_json(lead.outcome) if lead.outcome else None,
                lead.created_at.isoformat(),
                lead.updated_at.isoformat(),
                lead.expires_at.isoformat(),
            ),
        )

    def _get(self, connection: sqlite3.Connection, job_lead_id: str) -> JobLead:
        row = connection.execute(
            "SELECT * FROM job_leads WHERE id = ?", (job_lead_id,)
        ).fetchone()
        if row is None:
            raise JobLeadNotFoundError(job_lead_id)
        return self._to_job_lead(row)

    def _check_idempotency(
        self,
        connection: sqlite3.Connection,
        *,
        operation: str,
        idempotency_key: str,
        request_digest: str,
        now: dt.datetime,
    ) -> str | None:
        row = connection.execute(
            """
            SELECT request_digest, resource_id, expires_at
            FROM idempotency_records
            WHERE operation = ? AND idempotency_key = ?
            """,
            (operation, idempotency_key),
        ).fetchone()
        if row is None:
            return None
        if dt.datetime.fromisoformat(str(row["expires_at"])) <= now:
            connection.execute(
                """
                DELETE FROM idempotency_records
                WHERE operation = ? AND idempotency_key = ?
                """,
                (operation, idempotency_key),
            )
            return None
        if str(row["request_digest"]) != request_digest:
            raise IdempotencyKeyConflictError(idempotency_key)
        return str(row["resource_id"])

    @staticmethod
    def _record_idempotency(
        connection: sqlite3.Connection,
        *,
        operation: str,
        idempotency_key: str,
        request_digest: str,
        resource_id: str,
        created_at: dt.datetime,
        expires_at: dt.datetime,
    ) -> None:
        connection.execute(
            """
            INSERT INTO idempotency_records (
                operation, idempotency_key, request_digest, resource_id,
                created_at, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                operation,
                idempotency_key,
                request_digest,
                resource_id,
                created_at.isoformat(),
                expires_at.isoformat(),
            ),
        )

    @staticmethod
    def _record_event(
        connection: sqlite3.Connection,
        lead: JobLead,
        *,
        event_type: str,
        from_status: JobLeadStatus | None,
        occurred_at: dt.datetime,
        error_code: str | None = None,
    ) -> None:
        connection.execute(
            """
            INSERT INTO job_lead_events (
                job_lead_id, event_type, from_status, to_status,
                version, error_code, occurred_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                lead.id,
                event_type,
                from_status.value if from_status else None,
                lead.status.value,
                lead.version,
                error_code,
                occurred_at.isoformat(),
            ),
        )

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self._database_path, isolation_level=None)
        try:
            connection.row_factory = sqlite3.Row
            connection.execute("PRAGMA foreign_keys = ON")
            connection.execute("PRAGMA busy_timeout = 5000")
            yield connection
            if connection.in_transaction:
                connection.commit()
        except Exception:
            if connection.in_transaction:
                connection.rollback()
            raise
        finally:
            connection.close()

    @staticmethod
    def _materialization_candidate_json(posting: ValidatedJobPosting) -> str:
        proposal = posting.proposal
        assessment = posting.assessment
        salary = proposal.salary
        return json.dumps(
            {
                "schemaVersion": "materialization-candidate/v1",
                "proposal": {
                    "schemaVersion": proposal.schema_version,
                    "postingKey": proposal.posting_key,
                    "company": proposal.company,
                    "role": proposal.role,
                    "sourceUrl": proposal.source_url,
                    "location": proposal.location,
                    "workType": proposal.work_type.value,
                    "seniority": proposal.seniority.value,
                    "skills": list(proposal.skills),
                    "salary": (
                        {
                            "minimum": salary.minimum,
                            "maximum": salary.maximum,
                            "currency": salary.currency,
                            "period": salary.period,
                            "type": salary.type,
                        }
                        if salary is not None
                        else None
                    ),
                    "applicationDeadline": proposal.application_deadline,
                },
                "assessment": {
                    "schemaVersion": assessment.schema_version,
                    "interestLevel": assessment.interest_level,
                    "roleArchetype": assessment.role_archetype,
                    "summary": assessment.summary,
                    "strengths": list(assessment.strengths),
                    "gaps": list(assessment.gaps),
                    "confirmedBlocker": assessment.confirmed_blocker,
                    "unresolvedMaterialConstraint": (
                        assessment.unresolved_material_constraint
                    ),
                    "majorReadinessGap": assessment.major_readiness_gap,
                    "aspirational": assessment.aspirational,
                    "networkSignal": assessment.network_signal,
                },
                "warnings": list(posting.warnings),
            },
            ensure_ascii=True,
            separators=(",", ":"),
        )

    @staticmethod
    def _materialization_candidate(value: str) -> ValidatedJobPosting:
        data = json.loads(value)
        if data["schemaVersion"] != "materialization-candidate/v1":
            raise ValueError("unsupported materialization candidate")
        proposal = data["proposal"]
        assessment = data["assessment"]
        salary_data = proposal.get("salary")
        salary = (
            SalaryRange(
                minimum=int(salary_data["minimum"]),
                maximum=int(salary_data["maximum"]),
                currency=str(salary_data["currency"]),
                period=str(salary_data["period"]),
                type=str(salary_data["type"]),
            )
            if salary_data is not None
            else None
        )
        return ValidatedJobPosting(
            proposal=JobPostingProposal(
                schema_version=str(proposal["schemaVersion"]),
                posting_key=str(proposal["postingKey"]),
                company=str(proposal["company"]),
                role=str(proposal["role"]),
                source_url=str(proposal["sourceUrl"]),
                location=(
                    str(proposal["location"])
                    if proposal.get("location") is not None
                    else None
                ),
                work_type=WorkType(str(proposal["workType"])),
                seniority=Seniority(str(proposal["seniority"])),
                skills=tuple(str(item) for item in proposal["skills"]),
                evidence_text="",
                salary=salary,
                application_deadline=(
                    str(proposal["applicationDeadline"])
                    if proposal.get("applicationDeadline") is not None
                    else None
                ),
            ),
            assessment=JobPostingAssessment(
                schema_version=str(assessment["schemaVersion"]),
                interest_level=int(assessment["interestLevel"]),
                role_archetype=str(assessment["roleArchetype"]),
                summary=str(assessment["summary"]),
                strengths=tuple(str(item) for item in assessment["strengths"]),
                gaps=tuple(str(item) for item in assessment["gaps"]),
                confirmed_blocker=bool(assessment["confirmedBlocker"]),
                unresolved_material_constraint=bool(
                    assessment["unresolvedMaterialConstraint"]
                ),
                major_readiness_gap=bool(assessment["majorReadinessGap"]),
                aspirational=bool(assessment["aspirational"]),
                network_signal=bool(assessment["networkSignal"]),
            ),
            warnings=tuple(str(item) for item in data.get("warnings", [])),
        )

    @staticmethod
    def _outcome_json(outcome: JobLeadOutcome) -> str:
        return json.dumps(
            {
                "kind": outcome.kind,
                "postingKey": outcome.posting_key,
                "postingPath": outcome.posting_path,
                "company": outcome.company,
                "role": outcome.role,
                "warnings": list(outcome.warnings),
                "materializationStatus": outcome.materialization_status.value,
            },
            separators=(",", ":"),
        )

    @staticmethod
    def _to_job_lead(row: sqlite3.Row) -> JobLead:
        last_error = None
        if row["last_error_code"] is not None:
            last_error = JobLeadError(
                code=str(row["last_error_code"]),
                message=str(row["last_error_message"]),
                retryable=bool(row["last_error_retryable"]),
            )
        outcome = None
        if row["outcome_json"] is not None:
            value = json.loads(str(row["outcome_json"]))
            outcome = JobLeadOutcome(
                kind=str(value["kind"]),
                posting_key=value.get("postingKey"),
                posting_path=value.get("postingPath"),
                company=value.get("company"),
                role=value.get("role"),
                warnings=tuple(value.get("warnings", [])),
                materialization_status=MaterializationStatus(
                    value.get("materializationStatus", "notReady")
                ),
            )
        next_attempt_at = row["next_attempt_at"]
        return JobLead(
            id=str(row["id"]),
            version=int(row["version"]),
            source_url=str(row["source_url"]),
            source_key=str(row["source_key"]),
            source=JobLeadSource(str(row["source"])),
            posting_key=row["posting_key"],
            discovered_by=str(row["discovered_by"]),
            source_reference=row["source_reference"],
            status=JobLeadStatus(str(row["status"])),
            stage=JobLeadStage(str(row["stage"])),
            attempt_count=int(row["attempt_count"]),
            retry_count=int(row["retry_count"]),
            max_attempts=int(row["max_attempts"]),
            next_attempt_at=(
                dt.datetime.fromisoformat(str(next_attempt_at))
                if next_attempt_at is not None
                else None
            ),
            last_error=last_error,
            outcome=outcome,
            created_at=dt.datetime.fromisoformat(str(row["created_at"])),
            updated_at=dt.datetime.fromisoformat(str(row["updated_at"])),
            expires_at=dt.datetime.fromisoformat(str(row["expires_at"])),
        )
