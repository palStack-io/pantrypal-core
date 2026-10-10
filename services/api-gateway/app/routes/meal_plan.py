"""
Meal plan routes: a household calendar of planned meals, built from the recipes
you already have, with a calendar download.

CORE IS SINGLE-TENANT, so the plan belongs to the install: every signed-in user
sees and edits the same calendar, as they do recipes. There is no pantry id to
scope by. (Premium's version of this file keys the same table by pantry and adds
suggestions, opt-in AI and a live subscribe feed; none of that exists here.)

Core has no tiers and no AI, so this file is only: entries, mark-cooked,
plan -> shopping list, and a one-off .ics download.
"""
import logging
import os
import uuid as _uuid
from datetime import date, datetime
from typing import List, Literal, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import MealPlanEntry, Recipe, User, UserRecipePreference
from ..services.mealplan_ics import build_ics

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/meal-plan", tags=["meal-plan"])

Slot = Literal["breakfast", "lunch", "dinner", "snack"]

MAX_RANGE_DAYS = 93
MAX_BULK = 100


# ============================================
# Request models
# ============================================

class EntryIn(BaseModel):
    plan_date: date
    slot: Slot
    recipe_id: Optional[str] = None
    title: Optional[str] = Field(default=None, max_length=255)
    servings: Optional[int] = Field(default=None, ge=1, le=99)
    notes: Optional[str] = Field(default=None, max_length=2000)


class EntryPatch(BaseModel):
    plan_date: Optional[date] = None
    slot: Optional[Slot] = None
    title: Optional[str] = Field(default=None, max_length=255)
    servings: Optional[int] = Field(default=None, ge=1, le=99)
    notes: Optional[str] = Field(default=None, max_length=2000)


class BulkIn(BaseModel):
    entries: List[EntryIn] = Field(min_length=1, max_length=MAX_BULK)


class RangeIn(BaseModel):
    start: date
    end: date


# ============================================
# Helpers
# ============================================

def _check_range(start: date, end: date) -> None:
    if end < start:
        raise HTTPException(status_code=400, detail="end must not be before start")
    if (end - start).days > MAX_RANGE_DAYS:
        raise HTTPException(status_code=400, detail=f"Range is limited to {MAX_RANGE_DAYS} days")


def _entry_dict(e: MealPlanEntry, recipe: Optional[Recipe] = None) -> dict:
    return {
        "id": e.id,
        "plan_date": e.plan_date.isoformat(),
        "slot": e.slot,
        "recipe_id": e.recipe_id,
        "title": e.title,
        "servings": e.servings,
        "notes": e.notes,
        "source": e.source,
        "cooked_at": e.cooked_at.isoformat() if e.cooked_at else None,
        "image_url": recipe.image_url if recipe else None,
        "total_time": recipe.total_time if recipe else None,
    }


def _entries_in_range(db: Session, start: date, end: date) -> List[MealPlanEntry]:
    return (
        db.query(MealPlanEntry)
        .filter(MealPlanEntry.plan_date >= start, MealPlanEntry.plan_date <= end)
        .order_by(MealPlanEntry.plan_date, MealPlanEntry.created_at)
        .all()
    )


def _recipes_by_id(db: Session, ids: set) -> dict:
    if not ids:
        return {}
    return {r.id: r for r in db.query(Recipe).filter(Recipe.id.in_(ids)).all()}


def _make_entry(db: Session, user: User, body: EntryIn) -> MealPlanEntry:
    title = (body.title or "").strip()
    recipe = None
    if body.recipe_id:
        recipe = db.query(Recipe).filter(Recipe.id == body.recipe_id).first()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        title = title or recipe.name
    if not title:
        raise HTTPException(status_code=422, detail="Pick a recipe or type a title")

    return MealPlanEntry(
        id=str(_uuid.uuid4()),
        plan_date=body.plan_date,
        slot=body.slot,
        recipe_id=recipe.id if recipe else None,
        title=title,
        servings=body.servings or (recipe.servings if recipe else None),
        notes=(body.notes or None),
        source="manual",
        created_by_user_id=user.id,
    )


def _entry_or_404(db: Session, entry_id: str) -> MealPlanEntry:
    e = db.query(MealPlanEntry).filter(MealPlanEntry.id == entry_id).first()
    if not e:
        raise HTTPException(status_code=404, detail="Meal plan entry not found")
    return e


# ============================================
# Calendar entries
# ============================================

@router.get("")
async def list_entries(
    start: date = Query(...),
    end: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _check_range(start, end)
    rows = _entries_in_range(db, start, end)
    recipes = _recipes_by_id(db, {e.recipe_id for e in rows if e.recipe_id})
    return {"entries": [_entry_dict(e, recipes.get(e.recipe_id)) for e in rows]}


@router.post("/entries", status_code=201)
async def create_entry(
    body: EntryIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    entry = _make_entry(db, current_user, body)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    recipes = _recipes_by_id(db, {entry.recipe_id} if entry.recipe_id else set())
    return _entry_dict(entry, recipes.get(entry.recipe_id))


@router.post("/entries/bulk", status_code=201)
async def create_entries_bulk(
    body: BulkIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """All-or-nothing: one bad recipe id rejects the whole batch."""
    made = [_make_entry(db, current_user, e) for e in body.entries]
    db.add_all(made)
    db.commit()
    recipes = _recipes_by_id(db, {e.recipe_id for e in made if e.recipe_id})
    return {"entries": [_entry_dict(e, recipes.get(e.recipe_id)) for e in made]}


@router.patch("/entries/{entry_id}")
async def update_entry(
    entry_id: str,
    body: EntryPatch,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    e = _entry_or_404(db, entry_id)
    data = body.model_dump(exclude_unset=True)
    if "title" in data:
        title = (data["title"] or "").strip()
        if not title:
            raise HTTPException(status_code=422, detail="Title cannot be empty")
        e.title = title
    for field in ("plan_date", "slot", "servings", "notes"):
        if field in data:
            setattr(e, field, data[field])
    e.updated_at = datetime.utcnow()  # calendars compare SEQUENCE off this
    db.commit()
    db.refresh(e)
    recipes = _recipes_by_id(db, {e.recipe_id} if e.recipe_id else set())
    return _entry_dict(e, recipes.get(e.recipe_id))


@router.delete("/entries/{entry_id}", status_code=204)
async def delete_entry(
    entry_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.delete(_entry_or_404(db, entry_id))
    db.commit()
    return Response(status_code=204)


@router.post("/entries/{entry_id}/cooked")
async def mark_entry_cooked(
    entry_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a planned meal cooked. A recipe-backed entry also goes through the
    existing 'mark recipe cooked' handler so the cook count stays in step."""
    e = _entry_or_404(db, entry_id)
    if e.recipe_id:
        from . import recipes as recipe_routes
        await recipe_routes.mark_cooked(e.recipe_id, current_user, db)
    e.cooked_at = datetime.utcnow()
    e.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(e)
    return _entry_dict(e)


# ============================================
# Shopping list
# ============================================

@router.post("/shopping-list")
async def plan_to_shopping_list(
    body: RangeIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add what the planned recipes are missing to the shopping list, once per
    ingredient however many meals need it. Missing ingredients come from the
    per-user match results, which are refreshed first."""
    _check_range(body.start, body.end)
    rows = [e for e in _entries_in_range(db, body.start, body.end) if e.recipe_id and not e.cooked_at]
    recipe_ids = {e.recipe_id for e in rows}
    if not recipe_ids:
        return {"added": 0, "recipes": 0}

    from . import recipes as recipe_routes
    try:
        await recipe_routes.rematch_user(db, current_user.id)
    except recipe_routes.PantryItemsUnavailable:
        raise HTTPException(status_code=503, detail="Couldn't read your pantry just now. Please try again.")

    prefs = db.query(UserRecipePreference).filter(
        UserRecipePreference.user_id == current_user.id,
        UserRecipePreference.recipe_id.in_(recipe_ids),
    ).all()

    missing: dict = {}  # lowercase name -> first-seen display name
    for pref in prefs:
        for ing in pref.missing_ingredients or []:
            name = ing if isinstance(ing, str) else (ing.get("item") or ing.get("name") or "")
            name = str(name).strip()
            if name:
                missing.setdefault(name.lower(), name)

    inventory_url = os.getenv("INVENTORY_SERVICE_URL", "http://inventory-service:8001")
    token = os.getenv("INTERNAL_SERVICE_TOKEN", "")
    headers = {"X-Internal-Token": token} if token else {}
    added = 0
    async with httpx.AsyncClient(headers=headers, timeout=5.0) as client:
        for name in missing.values():
            try:
                resp = await client.post(
                    f"{inventory_url}/shopping-list",
                    json={"name": name, "quantity": 1, "notes": "For your meal plan"},
                )
                if resp.status_code in (200, 201):
                    added += 1
            except Exception:
                logger.warning("Could not add %r to the shopping list", name)
    return {"added": added, "recipes": len(recipe_ids)}


# ============================================
# Calendar export
# ============================================

@router.get("/export.ics")
async def export_ics(
    start: date = Query(...),
    end: date = Query(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """One-off download. A snapshot: it does not update when the plan changes."""
    _check_range(start, end)
    entries = [{
        "id": e.id, "plan_date": e.plan_date, "slot": e.slot, "title": e.title,
        "servings": e.servings, "notes": e.notes, "updated_at": e.updated_at,
    } for e in _entries_in_range(db, start, end)]
    return Response(
        content=build_ics(entries, name="PantryPal meal plan"),
        media_type="text/calendar",  # Starlette appends the charset itself
        headers={"Content-Disposition": f'attachment; filename="meal-plan-{start.isoformat()}.ics"'},
    )
