"""Meal plan .ics output — pure helpers, no DB."""
from datetime import date, datetime

from app.services.mealplan_ics import SLOT_TIMES, build_ics, escape_text, fold_line

NOW = datetime(2026, 10, 9, 12, 0, 0)


def _entry(**kw):
    base = {
        "id": "abc-123",
        "plan_date": date(2026, 10, 13),
        "slot": "dinner",
        "title": "Chicken stir-fry",
        "servings": 4,
        "notes": None,
        "updated_at": datetime(2026, 10, 9, 9, 0, 0),
    }
    base.update(kw)
    return base


def _unfold(text: str) -> str:
    return text.replace("\r\n ", "")


def test_document_shape_and_crlf():
    out = build_ics([_entry()], now=NOW)
    assert out.startswith("BEGIN:VCALENDAR\r\n")
    assert out.endswith("END:VCALENDAR\r\n")
    assert "VERSION:2.0" in out and "PRODID:" in out
    # every line break is CRLF — a bare \n breaks strict parsers
    assert "\n" not in out.replace("\r\n", "")


def test_floating_local_time_and_duration():
    out = build_ics([_entry()], now=NOW)
    assert "DTSTART:20261013T183000" in out
    assert "DTEND:20261013T193000" in out
    # no Z and no TZID on the event times: floating on purpose
    assert "DTSTART;TZID" not in out
    assert "DTSTART:20261013T183000Z" not in out


def test_stable_uid_and_sequence_changes_on_edit():
    a = build_ics([_entry()], now=NOW)
    b = build_ics([_entry(updated_at=datetime(2026, 10, 10, 9, 0, 0))], now=NOW)
    assert "UID:abc-123@pantrypal" in a and "UID:abc-123@pantrypal" in b
    seq = lambda s: int([l for l in s.split("\r\n") if l.startswith("SEQUENCE:")][0].split(":")[1])
    assert seq(b) > seq(a)


def test_summary_is_slot_prefixed_and_escaped():
    out = _unfold(build_ics([_entry(title="Mac, cheese; and more")], now=NOW))
    assert "SUMMARY:Dinner: Mac\\, cheese\\; and more" in out


def test_description_includes_servings_and_notes():
    out = _unfold(build_ics([_entry(notes="Use the spinach\nfirst")], now=NOW))
    assert "DESCRIPTION:Serves 4\\nUse the spinach\\nfirst" in out


def test_meal_does_not_mark_you_busy():
    assert "TRANSP:TRANSPARENT" in build_ics([_entry()], now=NOW)


def test_unknown_slot_falls_back_to_dinner_time():
    out = build_ics([_entry(slot="brunch")], now=NOW)
    assert "DTSTART:20261013T183000" in out


def test_every_known_slot_has_a_time():
    for slot, ((h, m), minutes) in SLOT_TIMES.items():
        out = build_ics([_entry(slot=slot)], now=NOW)
        assert f"DTSTART:20261013T{h:02d}{m:02d}00" in out, slot
        assert minutes > 0


def test_refresh_hint_only_when_asked():
    assert "REFRESH-INTERVAL" not in build_ics([_entry()], now=NOW)
    out = build_ics([_entry()], now=NOW, refresh_hours=1)
    assert "REFRESH-INTERVAL;VALUE=DURATION:PT1H" in out
    assert "X-PUBLISHED-TTL:PT1H" in out


def test_empty_plan_is_still_a_valid_calendar():
    out = build_ics([], now=NOW)
    assert "BEGIN:VCALENDAR" in out and "BEGIN:VEVENT" not in out


def test_events_sorted_by_date_then_slot():
    es = [
        _entry(id="b", plan_date=date(2026, 10, 14)),
        _entry(id="a", plan_date=date(2026, 10, 13)),
    ]
    out = build_ics(es, now=NOW)
    assert out.index("UID:a@") < out.index("UID:b@")


def test_escape_text_backslash_first():
    assert escape_text("a\\b;c,d") == "a\\\\b\\;c\\,d"


def test_fold_line_respects_75_octets_and_utf8():
    line = "SUMMARY:" + ("é" * 60)  # 2 octets each -> well over 75 octets
    folded = fold_line(line)
    for part in folded.split("\r\n"):
        assert len(part.encode("utf-8")) <= 75
    # unfolding gives the original back, with no split character
    assert folded.replace("\r\n ", "") == line


def test_short_line_not_folded():
    assert fold_line("SUMMARY:short") == "SUMMARY:short"
