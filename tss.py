"""Triton Student System (TSS) course-data adapter.

UC San Diego's public Class Planner exposes the same TSS-era catalog information
students see while planning: modules, events, meetings, live seats, and waitlist
counts.  This module normalizes that API into Trittton's existing Course/Section
shape and provides the official Class Planner -> TSS booking handoff.

Booking itself intentionally stays in TSS.  Student-specific checks (booking
window, holds, prerequisites, unit limits, and confirmation) require the
student's authenticated TSS session and must not be replayed by this service.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
import re
import threading
import time
from typing import Callable, Iterable

import requests


CLASS_PLANNER_BASE = "https://classplanner.apps.ucsd.edu"
CATALOG_PAGE_SIZE = 48  # API-enforced maximum
CATALOG_CACHE_TTL = 120

_HEADERS = {
    "Accept": "application/json",
    "User-Agent": "Trittton/2.0 (UCSD course planning client)",
}

_catalog_cache: dict[str, tuple[float, list[dict]]] = {}
_catalog_cache_lock = threading.Lock()


class TssApiError(RuntimeError):
    """Raised when UCSD's public Class Planner API cannot satisfy a request."""


@dataclass(frozen=True)
class CatalogProgress:
    completed: int
    total: int
    courses_found: int


def is_tss_term(term: str) -> bool:
    """Return whether a UCSD term belongs to the TSS booking era.

    Main-campus course booking moved to TSS beginning Fall 2026.  Summer 2026
    remains in WebReg, so checking only the two-digit year is not sufficient.
    """
    match = re.fullmatch(r"(FA|WI|SP|SA|S1|S2|S3)(\d{2})", term.upper())
    if not match:
        return False
    prefix, short_year = match.groups()
    year = 2000 + int(short_year)
    return year > 2026 or (year == 2026 and prefix == "FA")


def _request_json(
    method: str,
    path: str,
    *,
    params: dict | None = None,
    payload: dict | None = None,
    timeout: int = 30,
) -> dict:
    try:
        response = requests.request(
            method,
            f"{CLASS_PLANNER_BASE}{path}",
            params=params,
            json=payload,
            headers=_HEADERS,
            timeout=timeout,
        )
        response.raise_for_status()
        data = response.json()
        if not isinstance(data, dict):
            raise TssApiError(f"Unexpected response shape from {path}")
        return data
    except (requests.RequestException, ValueError) as exc:
        raise TssApiError(f"TSS course service request failed for {path}: {exc}") from exc


def fetch_terms() -> list[dict]:
    """Return configured TSS catalog terms in Trittton's option shape."""
    payload = _request_json("GET", "/api/v1/planner/terms", timeout=15)
    terms: list[dict] = []
    for item in payload.get("terms", []):
        term_code = str(item.get("term_code") or "").strip().upper()
        if not term_code or not item.get("configured", True):
            continue
        terms.append({
            "value": term_code,
            "label": term_label(term_code, item.get("term_name")),
            "source": "tss",
            "course_count": item.get("course_count"),
            "section_count": item.get("section_count"),
            "last_updated": item.get("last_full_refresh_at"),
        })
    return terms


def term_label(term: str, supplied: str | None = None) -> str:
    if supplied and supplied.strip():
        return supplied.strip()
    match = re.fullmatch(r"(FA|WI|SP|SA|S1|S2|S3)(\d{2})", term.upper())
    if not match:
        return term
    names = {
        "FA": "Fall",
        "WI": "Winter",
        "SP": "Spring",
        "SA": "Summer (All)",
        "S1": "Summer I",
        "S2": "Summer II",
        "S3": "Special Summer",
    }
    prefix, year = match.groups()
    return f"{names[prefix]} 20{year}"


def _catalog_page(term: str, offset: int) -> dict:
    return _request_json(
        "GET",
        "/api/v1/catalog/courses",
        params={"term_code": term, "offset": offset, "limit": CATALOG_PAGE_SIZE},
        timeout=45,
    )


def fetch_catalog(
    term: str,
    *,
    refresh: bool = False,
    progress: Callable[[CatalogProgress], None] | None = None,
) -> list[dict]:
    """Fetch and normalize a complete TSS term catalog.

    Class Planner pages at 48 courses.  We fetch the first page to learn the
    total, then request the remaining cached pages with modest concurrency.
    """
    term = term.upper().strip()
    now = time.time()
    with _catalog_cache_lock:
        cached = _catalog_cache.get(term)
        if cached and not refresh and now - cached[0] < CATALOG_CACHE_TTL:
            return cached[1]

    first = _catalog_page(term, 0)
    total = int(first.get("total") or 0)
    raw_courses = list(first.get("courses") or [])
    completed = len(raw_courses)
    if progress:
        progress(CatalogProgress(completed, total, completed))

    offsets = list(range(CATALOG_PAGE_SIZE, total, CATALOG_PAGE_SIZE))
    pages: dict[int, list[dict]] = {}
    with ThreadPoolExecutor(max_workers=min(6, max(1, len(offsets)))) as pool:
        futures = {pool.submit(_catalog_page, term, offset): offset for offset in offsets}
        for future in as_completed(futures):
            offset = futures[future]
            page_courses = list(future.result().get("courses") or [])
            pages[offset] = page_courses
            completed += len(page_courses)
            if progress:
                progress(CatalogProgress(completed, total, completed))

    for offset in sorted(pages):
        raw_courses.extend(pages[offset])

    normalized = [normalize_course(course) for course in raw_courses]
    with _catalog_cache_lock:
        _catalog_cache[term] = (time.time(), normalized)
    return normalized


def search_course(term: str, course_code: str) -> dict | None:
    """Fetch one course from the TSS catalog and return Trittton's shape."""
    payload = _request_json(
        "GET",
        "/api/v1/catalog/courses",
        params={"term_code": term, "q": course_code, "limit": 10},
        timeout=20,
    )
    wanted = _canonical_course_code(course_code)
    for raw in payload.get("courses", []):
        normalized = normalize_course(raw)
        if _canonical_course_code(normalized["course_code"]) == wanted:
            return normalized
    return None


def section_status(term: str, course_code: str, section_id: str) -> dict | None:
    course = search_course(term, course_code)
    if not course:
        return None
    return next((section for section in course["sections"] if section["section_id"] == section_id), None)


def create_booking_handoff(term: str, section_ids: Iterable[str]) -> dict:
    """Resolve selected TSS section IDs into official per-course booking links."""
    cleaned = list(dict.fromkeys(str(section_id).strip() for section_id in section_ids if str(section_id).strip()))
    if not cleaned:
        raise TssApiError("At least one TSS section ID is required")
    if len(cleaned) > 100:
        raise TssApiError("Too many sections in one TSS handoff")

    encoded = _request_json(
        "POST",
        "/api/v1/schedules/encode",
        payload={"term_code": term.upper(), "section_ids": cleaned},
        timeout=20,
    )
    schedule_ref = str(encoded.get("schedule_ref") or "")
    if not schedule_ref:
        raise TssApiError("UCSD did not return a schedule reference")
    schedule = _request_json(
        "GET",
        f"/api/v1/schedules/{schedule_ref}",
        params={"context": "planner"},
        timeout=30,
    )

    courses = []
    for detail in (schedule.get("course_details") or {}).values():
        sections = detail.get("sections") or []
        courses.append({
            "course_code": _display_course_code(detail.get("subject_code"), detail.get("course_code")),
            "title": detail.get("course_title") or detail.get("class_name") or "Course",
            "instructor": detail.get("subtitle"),
            "module_id": detail.get("module_id"),
            "event_package_id": detail.get("event_package_id"),
            "tss_booking_url": detail.get("tss_booking_url"),
            "seat_freshness": detail.get("seat_freshness"),
            "sections": [{
                "section_id": section.get("section_id"),
                "section": section.get("section_code"),
                "type": _instruction_abbreviation(section.get("instruction_type")),
                "status": section.get("status"),
                "seats": section.get("seats"),
                "waitlist": section.get("waitlist"),
            } for section in sections],
        })

    return {
        "term": term.upper(),
        "schedule_ref": schedule_ref,
        "planner_url": f"{CLASS_PLANNER_BASE}/view/{schedule_ref}?mode=planner",
        "valid": bool(schedule.get("valid")),
        "issues": schedule.get("issues") or schedule.get("warnings") or [],
        "courses": courses,
        "tss_home_url": "https://sis.ucsd.edu/",
        "disclaimer": "Opening a TSS course page does not book a seat or join a waitlist. Confirm the term, sections, eligibility, and final action in TSS.",
    }


def normalize_course(raw: dict) -> dict:
    subject = str(raw.get("subject_code") or "").strip().upper()
    code = _strip_course_zeroes(str(raw.get("course_code") or "").strip().upper())
    units = _units_value(raw.get("units_display"))
    restrictions = "; ".join(str(value) for value in (raw.get("restrictions") or []) if value)
    open_seat_count = int(raw.get("open_seat_count") or 0)
    return {
        "subject": subject,
        "course_code": f"{subject} {code}".strip(),
        "title": raw.get("course_title") or raw.get("module_name") or raw.get("module_code") or "",
        "units": units,
        "restrictions": restrictions,
        "sections": [
            normalize_section(section, course_has_open_seats=open_seat_count > 0)
            for section in (raw.get("sections") or [])
        ],
        "source": "tss",
        "module_code": raw.get("module_code"),
        "academic_level": raw.get("academic_level"),
        "prerequisites": raw.get("prerequisites") or [],
        "availability_refresh_pending": bool(raw.get("availability_refresh_pending")),
        "open_seat_count": open_seat_count,
        "waitlist_available_count": int(raw.get("waitlist_available_count") or 0),
    }


def normalize_section(raw: dict, *, course_has_open_seats: bool = True) -> dict:
    class_meetings = [meeting for meeting in (raw.get("meetings") or []) if meeting.get("meeting_kind") == "class"]
    primary = class_meetings[0] if class_meetings else {}

    # TSS emits one meeting per weekday.  When time/location match, collapse them
    # back to the compact legacy form (TuTh, MWF) that Trittton's calendar uses.
    same_slot = [
        meeting for meeting in class_meetings
        if meeting.get("start_minutes") == primary.get("start_minutes")
        and meeting.get("end_minutes") == primary.get("end_minutes")
        and meeting.get("room_code") == primary.get("room_code")
    ]
    days = _compact_days(meeting.get("day_code") for meeting in same_slot)
    time_display = _compact_time(primary.get("start_time_display"), primary.get("end_time_display"))

    building = str(primary.get("building_code") or "")
    room_code = str(primary.get("room_code") or "")
    room = room_code
    if building and room_code.upper().startswith(f"{building.upper()} "):
        room = room_code[len(building):].strip()
    if primary.get("is_remote"):
        building, room = "RCLAS", "ONLINE"

    capacity = raw.get("capacity")
    status = str(raw.get("status") or "").strip().lower()
    seats = raw.get("seats_available")
    # The public feed's section-level number is only an enrollable-seat count
    # while the course aggregate reports open seats. For closed courses it can
    # look like occupancy (for example 337/338 or 30/30), even with status AC.
    # Treat the aggregate and waitlist-only state as authoritative so every
    # downstream view receives seats the student can actually book.
    if status == "waitlist_only" or not course_has_open_seats:
        seats = 0
    waitlist_enrolled = raw.get("waitlist_enrolled")
    waitlist_available = raw.get("waitlist_available")
    return {
        "section_id": str(raw.get("section_id") or ""),
        "section_ref": raw.get("section_ref"),
        "type": _instruction_abbreviation(raw.get("instruction_type_name")),
        "section": str(raw.get("section_code") or ""),
        "days": days,
        "time": time_display,
        "building": building,
        "room": room,
        "instructor": ", ".join(raw.get("instructors") or []) or "TBA",
        "available": str(seats if seats is not None else 0),
        "limit": str(capacity if capacity is not None else ""),
        "waitlisted": str(waitlist_enrolled if waitlist_enrolled is not None else 0),
        "waitlist_available": waitlist_available,
        "status": raw.get("status"),
        "event_package_ids": raw.get("event_package_ids") or [],
        "source": "tss",
    }


def _instruction_abbreviation(value: object) -> str:
    text = str(value or "").strip().lower()
    mapping = {
        "lecture": "LE",
        "discussion": "DI",
        "lab": "LA",
        "laboratory": "LA",
        "seminar": "SE",
        "independent study": "IN",
        "tutorial": "TU",
        "clinical": "CL",
        "studio": "ST",
    }
    return mapping.get(text, text[:2].upper() if text else "")


def _strip_course_zeroes(value: str) -> str:
    return re.sub(r"^0+(?=\d)", "", value) or "0"


def _display_course_code(subject: object, code: object) -> str:
    return f"{str(subject or '').upper()} {_strip_course_zeroes(str(code or '').upper())}".strip()


def _canonical_course_code(value: str) -> str:
    parts = value.upper().replace("-", " ").split()
    if len(parts) < 2:
        return value.upper().replace(" ", "")
    return f"{parts[0]}{_strip_course_zeroes(parts[1])}"


def _units_value(value: object) -> str:
    match = re.search(r"\d+(?:\.\d+)?", str(value or ""))
    return match.group(0) if match else ""


def _compact_days(day_codes: Iterable[object]) -> str:
    codes = {str(code or "").upper() for code in day_codes}
    labels = (("M", "M"), ("T", "Tu"), ("W", "W"), ("R", "Th"), ("F", "F"), ("S", "Sa"), ("U", "Su"))
    return "".join(label for code, label in labels if code in codes)


def _compact_time(start: object, end: object) -> str:
    if not start or not end:
        return ""
    clean = lambda value: re.sub(r"(?i)(am|pm)$", lambda match: match.group(1)[0].lower(), str(value).strip())
    return f"{clean(start)}-{clean(end)}"
