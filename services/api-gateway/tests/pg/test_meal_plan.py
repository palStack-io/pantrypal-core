"""
Core meal plan: entries, the all-or-nothing bulk save, mark-cooked, plan -> shopping
list, and the .ics download.

Handlers are called directly (like the rest of tests/pg), so this pins the handlers'
own behavior rather than an HTTP stack. Core is single-tenant, so there is no
cross-tenant case; what matters is that it behaves as one shared household calendar.
"""
import asyncio
import uuid
from datetime import date, datetime

import pytest
from fastapi import HTTPException


def _run(coro):
    return asyncio.run(coro)


def _recipe(db, name="Stir-fry", servings=4):
    from app.models import Recipe
    r = Recipe(id=str(uuid.uuid4()), name=name, ingredients=[{"item": "chicken"}], servings=servings)
    db.add(r)
    db.flush()
    return r


def _body(**kw):
    from app.routes.meal_plan import EntryIn
    base = {"plan_date": date(2026, 10, 13), "slot": "dinner", "title": "Leftovers"}
    base.update(kw)
    return EntryIn(**base)


def _create(db, user, **kw):
    from app.routes.meal_plan import create_entry
    return _run(create_entry(_body(**kw), user, db))


# ── entries ────────────────────────────────────────────────────────────────

def test_recipe_entry_takes_title_and_servings_from_recipe(db, make_user):
    user = make_user(db)
    r = _recipe(db, name="Chicken stir-fry", servings=6)
    e = _create(db, user, recipe_id=r.id, title=None)
    assert e["title"] == "Chicken stir-fry" and e["servings"] == 6 and e["recipe_id"] == r.id


def test_entry_needs_a_recipe_or_a_title(db, make_user):
    with pytest.raises(HTTPException) as exc:
        _create(db, make_user(db), title=None)
    assert exc.value.status_code == 422


def test_unknown_recipe_is_404(db, make_user):
    with pytest.raises(HTTPException) as exc:
        _create(db, make_user(db), recipe_id=str(uuid.uuid4()), title=None)
    assert exc.value.status_code == 404


def test_the_calendar_is_shared_by_every_user(db, make_user):
    """Core is one household per install: what one user plans, another sees."""
    from app.routes.meal_plan import list_entries
    a, b = make_user(db), make_user(db)
    _create(db, a, title="Tacos")
    listed = _run(list_entries(date(2026, 10, 1), date(2026, 10, 31), b, db))
    assert [e["title"] for e in listed["entries"]] == ["Tacos"]


def test_list_is_limited_to_the_requested_range(db, make_user):
    from app.routes.meal_plan import list_entries
    user = make_user(db)
    _create(db, user, plan_date=date(2026, 10, 13), title="In range")
    _create(db, user, plan_date=date(2026, 12, 25), title="Out of range")
    listed = _run(list_entries(date(2026, 10, 1), date(2026, 10, 31), user, db))
    assert [e["title"] for e in listed["entries"]] == ["In range"]


def test_update_moves_an_entry_and_bumps_updated_at(db, make_user):
    from app.models import MealPlanEntry
    from app.routes.meal_plan import EntryPatch, update_entry
    user = make_user(db)
    e = _create(db, user)
    row = db.query(MealPlanEntry).filter_by(id=e["id"]).one()
    row.updated_at = datetime(2020, 1, 1)
    db.flush()
    out = _run(update_entry(e["id"], EntryPatch(plan_date=date(2026, 10, 15), slot="lunch"), user, db))
    assert out["plan_date"] == "2026-10-15" and out["slot"] == "lunch"
    db.refresh(row)
    assert row.updated_at > datetime(2020, 1, 1)  # calendars compare SEQUENCE off this


def test_blank_title_patch_is_rejected(db, make_user):
    from app.routes.meal_plan import EntryPatch, update_entry
    user = make_user(db)
    e = _create(db, user)
    with pytest.raises(HTTPException) as exc:
        _run(update_entry(e["id"], EntryPatch(title="  "), user, db))
    assert exc.value.status_code == 422


def test_missing_entry_is_404_for_patch_and_delete(db, make_user):
    from app.routes.meal_plan import EntryPatch, delete_entry, update_entry
    user = make_user(db)
    for call in (
        lambda: _run(update_entry(str(uuid.uuid4()), EntryPatch(title="x"), user, db)),
        lambda: _run(delete_entry(str(uuid.uuid4()), user, db)),
    ):
        with pytest.raises(HTTPException) as exc:
            call()
        assert exc.value.status_code == 404


def test_delete_removes_the_entry(db, make_user):
    from app.models import MealPlanEntry
    from app.routes.meal_plan import delete_entry
    user = make_user(db)
    e = _create(db, user)
    _run(delete_entry(e["id"], user, db))
    assert db.query(MealPlanEntry).filter_by(id=e["id"]).count() == 0


def test_bulk_is_all_or_nothing(db, make_user):
    from app.models import MealPlanEntry
    from app.routes.meal_plan import BulkIn, create_entries_bulk
    user = make_user(db)
    good = _body(title="Pasta")
    bad = _body(recipe_id=str(uuid.uuid4()), title=None)
    with pytest.raises(HTTPException):
        _run(create_entries_bulk(BulkIn(entries=[good, bad]), user, db))
    assert db.query(MealPlanEntry).count() == 0


def test_deleting_a_recipe_keeps_the_planned_meal(db, make_user):
    from app.models import MealPlanEntry
    user = make_user(db)
    r = _recipe(db, name="Chili")
    e = _create(db, user, recipe_id=r.id, title=None)
    db.delete(r)
    db.flush()
    row = db.query(MealPlanEntry).filter_by(id=e["id"]).one()
    db.refresh(row)
    assert row.recipe_id is None and row.title == "Chili"


def test_range_is_validated(db, make_user):
    from app.routes.meal_plan import list_entries
    user = make_user(db)
    for start, end in ((date(2026, 10, 10), date(2026, 10, 1)), (date(2026, 1, 1), date(2026, 12, 31))):
        with pytest.raises(HTTPException) as exc:
            _run(list_entries(start, end, user, db))
        assert exc.value.status_code == 400


# ── cooked ─────────────────────────────────────────────────────────────────

def test_mark_cooked_on_a_free_text_entry(db, make_user):
    from app.routes.meal_plan import mark_entry_cooked
    user = make_user(db)
    e = _create(db, user)
    assert _run(mark_entry_cooked(e["id"], user, db))["cooked_at"] is not None


def test_mark_cooked_on_a_recipe_entry_bumps_the_cook_count(db, make_user):
    from app.models import UserRecipePreference
    from app.routes.meal_plan import mark_entry_cooked
    user = make_user(db)
    r = _recipe(db)
    e = _create(db, user, recipe_id=r.id, title=None)
    _run(mark_entry_cooked(e["id"], user, db))
    pref = db.query(UserRecipePreference).filter_by(user_id=user.id, recipe_id=r.id).one()
    assert pref.times_cooked == 1


# ── plan -> shopping list ──────────────────────────────────────────────────

class _FakeClient:
    posted: list = []

    def __init__(self, *a, **k):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, json=None):
        _FakeClient.posted.append(json["name"])

        class R:
            status_code = 201
        return R()


def test_shopping_list_dedupes_ingredients_across_meals(db, make_user, monkeypatch):
    from app.models import UserRecipePreference
    from app.routes import meal_plan as mp
    from app.routes import recipes as recipe_routes
    user = make_user(db)
    r1, r2 = _recipe(db, "Curry"), _recipe(db, "Soup")
    for r, missing in ((r1, ["Onions", {"item": "rice"}]), (r2, ["onions", "Carrots"])):
        db.add(UserRecipePreference(id=str(uuid.uuid4()), user_id=user.id, recipe_id=r.id, missing_ingredients=missing))
    db.flush()
    _create(db, user, recipe_id=r1.id, title=None)
    _create(db, user, recipe_id=r2.id, title=None, plan_date=date(2026, 10, 14))

    async def fake_rematch(*a, **k):
        return {}
    monkeypatch.setattr(recipe_routes, "rematch_user", fake_rematch)
    monkeypatch.setattr(mp.httpx, "AsyncClient", _FakeClient)
    _FakeClient.posted = []

    out = _run(mp.plan_to_shopping_list(mp.RangeIn(start=date(2026, 10, 12), end=date(2026, 10, 18)), user, db))
    assert out == {"added": 3, "recipes": 2}
    assert sorted(n.lower() for n in _FakeClient.posted) == ["carrots", "onions", "rice"]


def test_shopping_list_skips_meals_already_cooked(db, make_user, monkeypatch):
    from app.models import UserRecipePreference
    from app.routes import meal_plan as mp
    from app.routes import recipes as recipe_routes
    user = make_user(db)
    r = _recipe(db)
    db.add(UserRecipePreference(id=str(uuid.uuid4()), user_id=user.id, recipe_id=r.id, missing_ingredients=["Flour"]))
    db.flush()
    e = _create(db, user, recipe_id=r.id, title=None)
    _run(mp.mark_entry_cooked(e["id"], user, db))

    async def fake_rematch(*a, **k):
        raise AssertionError("nothing to shop for, so no rematch")
    monkeypatch.setattr(recipe_routes, "rematch_user", fake_rematch)
    out = _run(mp.plan_to_shopping_list(mp.RangeIn(start=date(2026, 10, 12), end=date(2026, 10, 18)), user, db))
    assert out == {"added": 0, "recipes": 0}


def test_shopping_list_reports_an_unreachable_pantry(db, make_user, monkeypatch):
    from app.routes import meal_plan as mp
    from app.routes import recipes as recipe_routes
    user = make_user(db)
    r = _recipe(db)
    _create(db, user, recipe_id=r.id, title=None)

    async def down(*a, **k):
        raise recipe_routes.PantryItemsUnavailable()
    monkeypatch.setattr(recipe_routes, "rematch_user", down)
    with pytest.raises(HTTPException) as exc:
        _run(mp.plan_to_shopping_list(mp.RangeIn(start=date(2026, 10, 12), end=date(2026, 10, 18)), user, db))
    assert exc.value.status_code == 503


# ── export ─────────────────────────────────────────────────────────────────

def test_export_ics_is_a_calendar_attachment(db, make_user):
    from app.routes.meal_plan import export_ics
    user = make_user(db)
    _create(db, user, title="Tacos")
    resp = _run(export_ics(date(2026, 10, 1), date(2026, 10, 31), user, db))
    body = resp.body.decode()
    assert resp.headers["content-type"] == "text/calendar; charset=utf-8"  # one charset, not two
    assert "attachment" in resp.headers["content-disposition"]
    assert "SUMMARY:Dinner: Tacos" in body and "UID:" in body


def test_export_is_limited_to_the_requested_range(db, make_user):
    from app.routes.meal_plan import export_ics
    user = make_user(db)
    _create(db, user, plan_date=date(2026, 10, 13), title="In range")
    _create(db, user, plan_date=date(2026, 12, 25), title="Out of range")
    body = _run(export_ics(date(2026, 10, 1), date(2026, 10, 31), user, db)).body.decode()
    assert "In range" in body and "Out of range" not in body
