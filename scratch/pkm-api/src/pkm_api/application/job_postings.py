from __future__ import annotations

import base64
import collections
import json
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Protocol

from pkm_api.application.job_leads import InvalidCursorError


class JobPostingCatalogUnavailableError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class JobPostingSummary:
    posting_key: str
    company: str
    role: str
    status: str
    interest_level: int | None
    source_url: str | None
    captured_date: str | None
    role_archetype: str | None
    work_type: str
    seniority: str
    path: str


@dataclass(frozen=True, slots=True)
class JobPostingPage:
    items: tuple[JobPostingSummary, ...]
    next_cursor: str | None


@dataclass(frozen=True, slots=True)
class JobPostingStats:
    total: int
    by_status: dict[str, int]
    by_role_archetype: dict[str, int]
    by_work_type: dict[str, int]
    by_seniority: dict[str, int]


class JobPostingReadCatalog(Protocol):
    def list_summaries(self) -> list[JobPostingSummary]: ...


class JobPostingQueryService:
    def __init__(self, catalog: JobPostingReadCatalog) -> None:
        self._catalog = catalog

    def list(
        self,
        *,
        statuses: Sequence[str] = (),
        limit: int = 25,
        cursor: str | None = None,
    ) -> JobPostingPage:
        selected = set(statuses)
        records = [
            item
            for item in self._catalog.list_summaries()
            if not selected or item.status in selected
        ]
        records.sort(key=_sort_key, reverse=True)
        if cursor is not None:
            cursor_key = _decode_cursor(cursor)
            records = [item for item in records if _sort_key(item) < cursor_key]
        has_more = len(records) > limit
        page = records[:limit]
        next_cursor = _encode_cursor(page[-1]) if has_more and page else None
        return JobPostingPage(items=tuple(page), next_cursor=next_cursor)

    def stats(self) -> JobPostingStats:
        records = self._catalog.list_summaries()
        return JobPostingStats(
            total=len(records),
            by_status=_counts(item.status for item in records),
            by_role_archetype=_counts(
                item.role_archetype or "unclassified" for item in records
            ),
            by_work_type=_counts(item.work_type for item in records),
            by_seniority=_counts(item.seniority for item in records),
        )


def _sort_key(item: JobPostingSummary) -> tuple[str, str]:
    return (item.captured_date or "0000-00-00", item.path)


def _encode_cursor(item: JobPostingSummary) -> str:
    payload = json.dumps(
        {"capturedDate": item.captured_date, "path": item.path},
        separators=(",", ":"),
    ).encode()
    return base64.urlsafe_b64encode(payload).decode().rstrip("=")


def _decode_cursor(value: str) -> tuple[str, str]:
    try:
        padding = "=" * (-len(value) % 4)
        payload = json.loads(base64.urlsafe_b64decode(value + padding))
        captured_date = payload.get("capturedDate") or "0000-00-00"
        path = payload["path"]
        if not isinstance(captured_date, str) or not isinstance(path, str) or not path:
            raise ValueError
    except Exception as error:
        raise InvalidCursorError("cursor is invalid or malformed") from error
    return (captured_date, path)


def _counts(values: Iterable[str]) -> dict[str, int]:
    counter = collections.Counter(values)
    return dict(sorted(counter.items()))
