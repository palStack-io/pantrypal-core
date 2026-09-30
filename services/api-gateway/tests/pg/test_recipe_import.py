"""
Mealie/Tandoor import — the defects core shares with premium (found 2026-09-30):

1. A failed insert left the session needing a rollback, so every later recipe in
   the batch failed too.
2. Each failure's str(e) — the full INSERT and its parameters — went back to the
   browser.
3. POST /api/recipes/import answered {"success": true} however many recipes failed.
4. Imported recipes showed 0% match until the user pressed "Match Pantry".
"""
import asyncio

import pytest

_DEFAULT = object()


def _recipe(slug, name=_DEFAULT):
    return {
        "provider": "mealie",
        "external_id": slug,
        "name": slug.replace("-", " ").title() if name is _DEFAULT else name,
        "description": "",
        "ingredients": [{"name": "garlic", "quantity": 1, "unit": "clove"}],
        "instructions": ["Cook it."],
    }


@pytest.fixture
def fake_mealie(monkeypatch):
    from app import recipe_import_service as ris

    batch = {"recipes": []}

    class _FakeMealie:
        def __init__(self, server_url, api_token):
            pass

        async def fetch_recipes(self, limit=500):
            return batch["recipes"][:limit]

    monkeypatch.setattr(ris, "MealieIntegration", _FakeMealie)
    return batch


def _run_import(db, user):
    from app.recipe_import_service import RecipeImportService
    svc = RecipeImportService(db=db, storage_service=None)
    return asyncio.run(svc.import_recipes(
        imported_by_user_id=user.id, provider="mealie", server_url="http://mealie",
        api_token="t", import_images=False,
    ))


def test_one_bad_recipe_does_not_fail_the_rest_of_the_batch(db, make_user, fake_mealie):
    # name=None violates recipes.name NOT NULL — a real per-row database failure.
    fake_mealie["recipes"] = [_recipe("broken", name=None), _recipe("blt-pizza"), _recipe("tuna-nicoise")]

    stats = _run_import(db, make_user(db))

    assert stats["failed"] == 1
    assert stats["imported"] == 2, stats["errors"]


def test_import_errors_do_not_leak_sql(db, make_user, fake_mealie):
    fake_mealie["recipes"] = [_recipe("broken", name=None)]

    stats = _run_import(db, make_user(db))

    blob = repr(stats["errors"])
    assert stats["failed"] == 1
    assert "INSERT" not in blob and "SQL" not in blob and "psycopg2" not in blob


# ---- the route -------------------------------------------------------------

def _stats(**kw):
    base = {"total_fetched": 0, "imported": 0, "updated": 0, "failed": 0,
            "skipped": 0, "images_downloaded": 0, "errors": []}
    base.update(kw)
    return base


@pytest.fixture
def route(db, monkeypatch):
    """The import route with a configured Mealie, a preset importer result, and a recorded re-match."""
    from app.models import RecipeIntegration
    from app.routes import recipes as route_mod

    db.add(RecipeIntegration(provider="mealie", server_url="http://mealie", api_token_encrypted="x",
                             enabled=True, import_images=False))
    db.flush()

    state = {"stats": _stats(), "rematched": []}

    class _Security:
        def decrypt_api_token(self, token):
            return "tok"

    class _Svc:
        async def import_recipes(self, **kw):
            return state["stats"]

    async def _rematch(db, user_id, expiring_days=7):
        state["rematched"].append(user_id)
        return {}

    monkeypatch.setattr(route_mod, "get_security_service", lambda: _Security())
    monkeypatch.setattr(route_mod, "get_recipe_import_service", lambda db, storage: _Svc())
    monkeypatch.setattr(route_mod, "rematch_user", _rematch)

    def call(user):
        return asyncio.run(route_mod.import_recipes(
            import_request=route_mod.RecipeImportRequest(limit=500), provider=None,
            current_user=user, db=db, storage=None))

    state["call"] = call
    return state


def test_import_route_reports_failure_when_any_recipe_failed(db, make_user, route):
    route["stats"] = _stats(total_fetched=13, failed=13)

    res = route["call"](make_user(db))

    assert res["success"] is False


def test_import_route_reports_success_when_nothing_failed(db, make_user, route):
    route["stats"] = _stats(total_fetched=2, imported=2)

    assert route["call"](make_user(db))["success"] is True


def test_import_route_rematches_so_new_recipes_have_scores(db, make_user, route):
    route["stats"] = _stats(total_fetched=2, imported=2)
    user = make_user(db)

    route["call"](user)

    assert route["rematched"] == [user.id]
