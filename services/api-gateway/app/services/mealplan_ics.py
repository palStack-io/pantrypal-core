"""
Meal plan -> iCalendar (.ics), RFC 5545.

Pure functions over plain dicts, no database and no framework, so the format can
be unit-tested and so the same file ports to core unchanged.

DECISIONS WORTH KNOWING

* FLOATING local times, no TZID/VTIMEZONE. "Dinner 18:30" is a wall-clock
  statement for the household, not an instant: floating times land at 18:30 in
  whatever zone the viewer's calendar is in, which is what a family wants, and
  it avoids shipping a VTIMEZONE block that has to be right for every zone.
* STABLE UID per entry (`<entry id>@pantrypal`). A subscribed calendar matches on
  UID, so an edited entry updates in place instead of duplicating. SEQUENCE is
  derived from `updated_at` so a change always compares as newer.
* A deleted entry simply vanishes from the feed; subscribed calendars drop
  events that are no longer present.
* Refresh hints (REFRESH-INTERVAL / X-PUBLISHED-TTL) are only hints. Apple honours
  them (about an hour); Google ignores them and polls on its own schedule, which
  can be up to a day. The UI says so rather than promising "live".
"""
from datetime import date, datetime, timedelta, timezone
from typing import Iterable, Optional

PRODID = "-//PalStack//PantryPal Meal Plan//EN"

# slot -> ((hour, minute), duration in minutes). Wall-clock defaults; a later
# per-pantry setting can override these without touching the format code.
SLOT_TIMES = {
    "breakfast": ((8, 0), 30),
    "lunch": ((12, 30), 45),
    "dinner": ((18, 30), 60),
    "snack": ((15, 30), 15),
}
SLOT_LABELS = {
    "breakfast": "Breakfast",
    "lunch": "Lunch",
    "dinner": "Dinner",
    "snack": "Snack",
}


def escape_text(value: str) -> str:
    """Escape a TEXT value (RFC 5545 section 3.3.11)."""
    return (
        (value or "")
        .replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
        .replace("\r", "\\n")
    )


def fold_line(line: str) -> str:
    """Fold a content line at 75 OCTETS (not characters), never inside a
    multi-byte UTF-8 sequence. Continuation lines start with one space."""
    raw = line.encode("utf-8")
    if len(raw) <= 75:
        return line
    parts = []
    limit = 75
    while raw:
        chunk = raw[:limit]
        # back up so we do not cut a multi-byte character in half
        while len(chunk) < len(raw) and (raw[len(chunk)] & 0xC0) == 0x80:
            chunk = chunk[:-1]
        parts.append(chunk.decode("utf-8"))
        raw = raw[len(chunk):]
        limit = 74  # continuation lines lose one octet to the leading space
    return "\r\n ".join(parts)


def _fmt_local(d: date, hour: int, minute: int) -> str:
    return f"{d.year:04d}{d.month:02d}{d.day:02d}T{hour:02d}{minute:02d}00"


def _fmt_utc(dt: datetime) -> str:
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.strftime("%Y%m%dT%H%M%SZ")


def _sequence(updated_at: Optional[datetime]) -> int:
    """Monotonic per-entry revision number: seconds since 2020-01-01."""
    if not updated_at:
        return 0
    base = datetime(2020, 1, 1)
    naive = updated_at.replace(tzinfo=None) if updated_at.tzinfo else updated_at
    return max(0, int((naive - base).total_seconds()))


def _description(entry: dict) -> str:
    lines = []
    if entry.get("servings"):
        lines.append(f"Serves {entry['servings']}")
    if entry.get("notes"):
        lines.append(str(entry["notes"]))
    if entry.get("url"):
        lines.append(str(entry["url"]))
    return "\n".join(lines)


def build_event(entry: dict, now: datetime) -> list:
    """One VEVENT as a list of unfolded content lines."""
    slot = entry.get("slot") or "dinner"
    (hour, minute), minutes = SLOT_TIMES.get(slot, SLOT_TIMES["dinner"])
    start = entry["plan_date"]
    start_dt = datetime(start.year, start.month, start.day, hour, minute)
    end_dt = start_dt + timedelta(minutes=minutes)
    label = SLOT_LABELS.get(slot, slot.title())
    title = entry.get("title") or "Meal"

    lines = [
        "BEGIN:VEVENT",
        f"UID:{entry['id']}@pantrypal",
        f"DTSTAMP:{_fmt_utc(now)}",
        f"DTSTART:{_fmt_local(start_dt.date(), start_dt.hour, start_dt.minute)}",
        f"DTEND:{_fmt_local(end_dt.date(), end_dt.hour, end_dt.minute)}",
        f"SUMMARY:{escape_text(f'{label}: {title}')}",
        f"SEQUENCE:{_sequence(entry.get('updated_at'))}",
        "TRANSP:TRANSPARENT",  # a meal should not mark you busy
        "CATEGORIES:Meal plan",
    ]
    description = _description(entry)
    if description:
        lines.append(f"DESCRIPTION:{escape_text(description)}")
    lines.append("END:VEVENT")
    return lines


def build_ics(
    entries: Iterable[dict],
    *,
    name: str = "PantryPal meal plan",
    now: Optional[datetime] = None,
    refresh_hours: Optional[int] = None,
) -> str:
    """Render entries as a complete VCALENDAR document (CRLF line endings).

    Each entry dict needs: id, plan_date (date), slot, title. Optional:
    servings, notes, url, updated_at (datetime).
    """
    now = now or datetime.utcnow()
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        f"PRODID:{PRODID}",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{escape_text(name)}",
    ]
    if refresh_hours:
        lines.append(f"REFRESH-INTERVAL;VALUE=DURATION:PT{int(refresh_hours)}H")
        lines.append(f"X-PUBLISHED-TTL:PT{int(refresh_hours)}H")

    for entry in sorted(entries, key=lambda e: (e["plan_date"], e.get("slot") or "", e["id"])):
        lines.extend(build_event(entry, now))

    lines.append("END:VCALENDAR")
    return "\r\n".join(fold_line(line) for line in lines) + "\r\n"
