from __future__ import annotations

import json
import re
from contextlib import suppress
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlsplit

from pkm_api.application.job_processing import RetrievedJobSource, SkipJobLead
from pkm_api.domain.job_leads import JobLead, JobLeadSource
from pkm_api.domain.job_postings import (
    JobPostingProposal,
    SalaryRange,
    Seniority,
    WorkType,
)

_WHITESPACE = re.compile(r"\s+")
_LINKEDIN_PUBLIC_FIELDS = {
    "top-card-layout__title": ("role", 300),
    "topcard__org-name-link": ("company", 200),
    "topcard__flavor--bullet": ("location", 500),
    "show-more-less-html__markup": ("description", 20_000),
}
_VOID_ELEMENTS = frozenset(
    {
        "area",
        "base",
        "br",
        "col",
        "embed",
        "hr",
        "img",
        "input",
        "link",
        "meta",
        "param",
        "source",
        "track",
        "wbr",
    }
)
_LINKEDIN_JOB_PATH = re.compile(r"/jobs/view/(?:[^/]*-)?(\d+)/?")


class LinkedInJsonLdJobPostingExtractor:
    """Extract bounded identity and evidence from public job-posting markup."""

    def extract(self, source: RetrievedJobSource, lead: JobLead) -> JobPostingProposal:
        documents = self._documents(source)
        posting = _find_job_posting(documents)
        if posting is None:
            posting = _linkedin_public_posting(source, lead)
        if posting is None:
            raise SkipJobLead(
                "unsupportedSource",
                "The source did not expose structured JobPosting data.",
            )

        role = _clean_text(posting.get("title"), maximum=300)
        organization = posting.get("hiringOrganization")
        company = _clean_text(
            organization.get("name") if isinstance(organization, dict) else None,
            maximum=200,
        )
        if not role or not company:
            raise SkipJobLead(
                "incompleteSource",
                "The source did not identify both the company and role.",
            )

        location = _job_location(posting)
        description = _html_to_text(str(posting.get("description", "")))
        evidence = _WHITESPACE.sub(
            " ",
            " | ".join(
                item for item in (company, role, location or "", description) if item
            ),
        ).strip()[:20_000]
        return JobPostingProposal(
            schema_version="job-posting-proposal/v1",
            posting_key=lead.posting_key or lead.source_key,
            company=company,
            role=role,
            source_url=source.final_url,
            location=location,
            work_type=_work_type(posting),
            seniority=_seniority(role),
            skills=(),
            evidence_text=evidence,
            salary=_salary(posting),
            application_deadline=_clean_text(posting.get("validThrough"), maximum=50),
        )

    @staticmethod
    def _documents(source: RetrievedJobSource) -> list[object]:
        text = source.body.decode("utf-8", errors="replace")
        if source.media_type == "application/json":
            try:
                return [json.loads(text)]
            except json.JSONDecodeError as error:
                raise SkipJobLead(
                    "invalidSource",
                    "The source returned invalid structured data.",
                ) from error
        parser = _JsonLdParser()
        parser.feed(text)
        return parser.documents


class _JsonLdParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.documents: list[object] = []
        self._capture = False
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {key.lower(): (value or "") for key, value in attrs}
        if tag.lower() == "script" and values.get("type", "").lower() == (
            "application/ld+json"
        ):
            self._capture = True
            self._parts = []

    def handle_data(self, data: str) -> None:
        if self._capture:
            self._parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() != "script" or not self._capture:
            return
        self._capture = False
        with suppress(json.JSONDecodeError):
            self.documents.append(json.loads("".join(self._parts)))
        self._parts = []


class _LinkedInPublicMarkupParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.values: dict[str, str] = {}
        self._field: str | None = None
        self._maximum = 0
        self._container_tag: str | None = None
        self._container_depth = 0
        self._length = 0
        self._parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        normalized_tag = tag.lower()
        if self._field is not None:
            if normalized_tag in _VOID_ELEMENTS:
                self._append(" ")
            elif normalized_tag == self._container_tag:
                self._container_depth += 1
            return

        values = {key.lower(): (value or "") for key, value in attrs}
        classes = frozenset(values.get("class", "").split())
        for class_name, (field, maximum) in _LINKEDIN_PUBLIC_FIELDS.items():
            if class_name in classes and field not in self.values:
                self._field = field
                self._maximum = maximum
                self._container_tag = normalized_tag
                self._container_depth = 1
                self._length = 0
                self._parts = []
                return

    def handle_data(self, data: str) -> None:
        if self._field is not None:
            self._append(data)

    def handle_endtag(self, tag: str) -> None:
        if self._field is None or tag.lower() != self._container_tag:
            return
        self._container_depth -= 1
        if self._container_depth > 0:
            return
        value = _clean_text(" ".join(self._parts), maximum=self._maximum)
        if value:
            self.values[self._field] = value
        self._field = None
        self._maximum = 0
        self._container_tag = None
        self._container_depth = 0
        self._length = 0
        self._parts = []

    def _append(self, value: str) -> None:
        remaining = self._maximum - self._length
        if remaining <= 0:
            return
        bounded = value[:remaining]
        self._parts.append(bounded)
        self._length += len(bounded)


class _VisibleTextParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def _linkedin_public_posting(
    source: RetrievedJobSource,
    lead: JobLead,
) -> dict[str, Any] | None:
    parsed = urlsplit(source.final_url)
    hostname = (parsed.hostname or "").lower()
    path_match = _LINKEDIN_JOB_PATH.fullmatch(parsed.path)
    expected_id = (lead.posting_key or "").removeprefix("linkedin:")
    if (
        lead.source is not JobLeadSource.LINKEDIN
        or not (hostname == "linkedin.com" or hostname.endswith(".linkedin.com"))
        or path_match is None
        or path_match.group(1) != expected_id
    ):
        return None
    parser = _LinkedInPublicMarkupParser()
    parser.feed(source.body.decode("utf-8", errors="replace"))
    role = parser.values.get("role")
    company = parser.values.get("company")
    if not role or not company:
        return None
    posting: dict[str, Any] = {
        "@type": "JobPosting",
        "title": role,
        "hiringOrganization": {"name": company},
        "description": parser.values.get("description", ""),
    }
    location = parser.values.get("location")
    if location:
        posting["applicantLocationRequirements"] = {"name": location}
    return posting


def _find_job_posting(value: object) -> dict[str, Any] | None:
    if isinstance(value, list):
        for item in value:
            found = _find_job_posting(item)
            if found is not None:
                return found
    if isinstance(value, dict):
        item_type = value.get("@type")
        types = item_type if isinstance(item_type, list) else [item_type]
        if "JobPosting" in types:
            return value
        for key in ("@graph", "mainEntity", "itemListElement"):
            found = _find_job_posting(value.get(key))
            if found is not None:
                return found
    return None


def _job_location(posting: dict[str, Any]) -> str | None:
    locations = posting.get("jobLocation")
    if not isinstance(locations, list):
        locations = [locations]
    values: list[str] = []
    for location in locations:
        if not isinstance(location, dict):
            continue
        address = location.get("address")
        if not isinstance(address, dict):
            continue
        value = ", ".join(
            str(address[key]).strip()
            for key in ("addressLocality", "addressRegion", "addressCountry")
            if address.get(key)
        )
        if value and value not in values:
            values.append(value)
    if values:
        return "; ".join(values)[:500]
    requirements = posting.get("applicantLocationRequirements")
    if isinstance(requirements, dict):
        return _clean_text(requirements.get("name"), maximum=500)
    return None


def _work_type(posting: dict[str, Any]) -> WorkType:
    location_type = str(posting.get("jobLocationType", "")).upper()
    if "TELECOMMUTE" in location_type:
        return WorkType.REMOTE
    return WorkType.UNKNOWN


def _seniority(role: str) -> Seniority:
    normalized = role.lower()
    for token, seniority in (
        ("executive", Seniority.EXECUTIVE),
        ("vice president", Seniority.EXECUTIVE),
        ("director", Seniority.DIRECTOR),
        ("principal", Seniority.PRINCIPAL),
        ("staff", Seniority.STAFF),
        ("manager", Seniority.MANAGER),
        ("senior", Seniority.SENIOR),
        ("junior", Seniority.ENTRY),
        ("entry", Seniority.ENTRY),
    ):
        if token in normalized:
            return seniority
    return Seniority.UNKNOWN


def _salary(posting: dict[str, Any]) -> SalaryRange | None:
    base_salary = posting.get("baseSalary")
    if not isinstance(base_salary, dict):
        return None
    value = base_salary.get("value")
    if not isinstance(value, dict):
        return None
    minimum = value.get("minValue")
    maximum = value.get("maxValue")
    if not isinstance(minimum, (int, float)) or not isinstance(maximum, (int, float)):
        return None
    unit = str(value.get("unitText", "")).upper()
    period = {"YEAR": "annual", "HOUR": "hourly"}.get(unit)
    currency = str(base_salary.get("currency", "")).upper()
    if period is None or len(currency) != 3:
        return None
    return SalaryRange(
        minimum=int(minimum),
        maximum=int(maximum),
        currency=currency,
        period=period,
        type="base",
    )


def _clean_text(value: object, *, maximum: int) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = _WHITESPACE.sub(" ", value).strip()
    return cleaned[:maximum] or None


def _html_to_text(value: str) -> str:
    parser = _VisibleTextParser()
    parser.feed(value)
    return _WHITESPACE.sub(" ", " ".join(parser.parts)).strip()
