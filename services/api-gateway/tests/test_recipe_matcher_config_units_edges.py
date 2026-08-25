"""
Additive regression net for RecipeMatcher, hardening it before an upcoming
refactor. Covers the gaps NOT already exercised by
test_recipe_matcher_fuzzy.py / test_community_recipe_matching.py:

  1. Runtime config merge + dedupe (admin overrides) WITHOUT mutating the
     shared default dicts (ingredient_normalize.ALIASES or the caller's base).
  2. Unit conversion tables (_to_base_quantity / _canonical_unit) and
     cross-dimension rejection (a VOLUME recipe must not full-match a WEIGHT
     pantry item).
  3. Optional / staple weighting — an absent optional ingredient must not tank
     the match the way an absent required one does.
  4. Malformed / edge inputs degrade gracefully (no crash, sensible score).

These assert INTENDED behavior. Gap 2 originally surfaced a genuine
cross-dimension bug (a bare-count recipe full-matching a weight-only pantry
item); that has since been FIXED in `_quantity_score`, so
`test_count_recipe_not_full_matched_by_weight_pantry` now passes normally.

Run with:
    cd services/api-gateway
    DATABASE_URL="postgresql://test:test@localhost:5432/test" \
      python -m pytest tests/test_recipe_matcher_config_units_edges.py -v -p no:asyncio
"""
import os
import sys
from unittest.mock import MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.recipe_matcher import RecipeMatcher
from app.services import ingredient_normalize


def _matcher():
    return RecipeMatcher(db=MagicMock())


def _match(ingredients, pantry_items):
    """Drive the public _match_recipe path like the existing tests do."""
    m = _matcher()
    recipe = MagicMock()
    recipe.ingredients = ingredients
    return m._match_recipe(recipe, m._build_pantry_index(pantry_items), set())


# ── Gap 1: config merge + dedupe, no mutation of shared state ────────────────

def test_merge_adds_admin_alias_without_dropping_builtins():
    m = _matcher()
    merged = RecipeMatcher.merge_matching_config(
        m.default_matching_config(),
        {"aliases": {"besan": "chickpea flour"}},
    )
    # New admin alias present...
    assert merged["aliases"]["besan"] == "chickpea flour"
    # ...and a built-in alias survives the merge.
    assert merged["aliases"]["scallion"] == "green onion"


def test_merge_does_not_mutate_shared_module_aliases():
    # The refactor plan warns against in-place mutation of the shared
    # ingredient_normalize.ALIASES dict. default_matching_config() copies it,
    # so a merge that adds an alias must leave the module-level dict untouched.
    m = _matcher()
    before = dict(ingredient_normalize.ALIASES)

    RecipeMatcher.merge_matching_config(
        m.default_matching_config(),
        {"aliases": {"besan": "chickpea flour"}},
    )

    assert ingredient_normalize.ALIASES == before
    assert "besan" not in ingredient_normalize.ALIASES


def test_merge_does_not_mutate_the_caller_base_dict():
    # Guards the exact regression the refactor risks: if merge ever stops
    # copying (dict(base.get("aliases")) -> base.get("aliases")), the caller's
    # base dict would start growing across calls. The module-level check above
    # would NOT catch that; this one does.
    m = _matcher()
    base = m.default_matching_config()
    base_staples_len = len(base["staples"])

    RecipeMatcher.merge_matching_config(
        base,
        {"aliases": {"besan": "chickpea flour"}, "staples": ["marmite"]},
    )

    assert "besan" not in base["aliases"]
    assert len(base["staples"]) == base_staples_len


def test_merge_extends_staples_and_substitution_options():
    m = _matcher()
    merged = RecipeMatcher.merge_matching_config(
        m.default_matching_config(),
        {
            "staples": ["marmite"],
            "transformative_heads": ["glaze"],
            "substitutions": {"shallot": ["leek"]},
        },
    )
    assert "marmite" in merged["staples"]
    assert "glaze" in merged["transformative_heads"]
    # Built-in 'shallot': ['onion'] plus the new 'leek', sorted+deduped.
    assert merged["substitutions"]["shallot"] == ["leek", "onion"]


def test_merge_ignores_non_dict_override():
    m = _matcher()
    base = m.default_matching_config()
    merged = RecipeMatcher.merge_matching_config(base, None)
    # Still a well-formed, deduped config identical in content to defaults.
    assert merged["aliases"]["scallion"] == "green onion"
    assert merged["staples"] == sorted(set(base["staples"]))


def test_dedupe_removes_duplicate_list_and_substitution_entries():
    deduped = RecipeMatcher._dedupe_matching_config({
        "staples": ["salt", "salt", "water"],
        "low_weight_heads": ["oil", "oil"],
        "transformative_heads": ["broth", "broth", "stock"],
        "aliases": {"b": "y", "a": "x"},
        "substitutions": {"shallot": ["onion", "onion", "leek"]},
    })
    assert deduped["staples"] == ["salt", "water"]
    assert deduped["low_weight_heads"] == ["oil"]
    assert deduped["transformative_heads"] == ["broth", "stock"]
    assert deduped["substitutions"]["shallot"] == ["leek", "onion"]
    # Aliases are sorted by key.
    assert list(deduped["aliases"].keys()) == ["a", "b"]


def test_runtime_substitution_extends_recipe_side_lookup_names():
    # A merged-in substitution should be honored by _candidate_lookup_names.
    m = _matcher()
    m._rules_cache = RecipeMatcher.merge_matching_config(
        m.default_matching_config(),
        {"substitutions": {"paneer": ["halloumi"]}},
    )
    assert "paneer" in m._candidate_lookup_names(["halloumi"])


# ── Gap 2: unit conversion + cross-dimension rejection ───────────────────────

def test_to_base_quantity_weight_conversions():
    m = _matcher()
    assert m._to_base_quantity(1, "g") == ("mass", 1.0)
    assert m._to_base_quantity(1, "kg") == ("mass", 1000.0)
    assert m._to_base_quantity(1, "oz") == ("mass", 28.3495)
    assert m._to_base_quantity(1, "lb") == ("mass", 453.592)
    # A kilogram is a thousand grams once both are in the mass base.
    assert m._to_base_quantity(1, "kg")[1] == m._to_base_quantity(1000, "g")[1]


def test_to_base_quantity_volume_conversions():
    m = _matcher()
    assert m._to_base_quantity(1, "ml") == ("volume", 1.0)
    assert m._to_base_quantity(1, "l") == ("volume", 1000.0)
    assert m._to_base_quantity(1, "tsp") == ("volume", 4.92892)
    assert m._to_base_quantity(1, "tbsp") == ("volume", 14.7868)
    assert m._to_base_quantity(1, "cup") == ("volume", 236.588)
    assert m._to_base_quantity(1, "fl_oz") == ("volume", 29.5735)


def test_to_base_quantity_dimensions_are_incommensurable():
    m = _matcher()
    # Volume and mass live in different dimensions — the tag is what the
    # package-matching path uses to refuse a cross-dimension full match.
    assert m._to_base_quantity(1, "cup")[0] != m._to_base_quantity(1, "g")[0]
    assert m._to_base_quantity(1, "count")[0] == "count"
    assert m._to_base_quantity(1, "dozen") == ("count", 12.0)
    assert m._to_base_quantity(1, "bogus") is None


def test_canonical_unit_normalizes_aliases_and_spacing():
    m = _matcher()
    assert m._canonical_unit("kilograms") == "kg"
    assert m._canonical_unit("Tablespoons") == "tbsp"
    assert m._canonical_unit("fl oz") == "fl_oz"
    assert m._canonical_unit("cups") == "cup"
    assert m._canonical_unit("cans") == "count"
    assert m._canonical_unit(None) is None
    assert m._canonical_unit("nonsense-unit") is None


def test_volume_recipe_not_full_matched_by_weight_package():
    # A recipe asking for 2 CUPS (volume) must not be satisfied outright by a
    # pantry package measured in GRAMS (mass). The package path checks the
    # dimension tag and refuses — degrading to a "needs confirmation" partial.
    result = _match(
        [{"item": "2 cups rice", "quantity": 2, "unit": "cup"}],
        [{"id": 1, "name": "Rice", "quantity": 1, "package_quantity": 500, "package_unit": "g"}],
    )
    assert result["match_percentage"] == 75.0
    assert result["ingredient_matches"][0]["status"] == "partial"


def test_volume_recipe_not_full_matched_by_plain_weight_pantry():
    # Same rejection through the plain-quantity path: pantry unit 'g' is not a
    # volume, so a volume recipe stays a partial, never a full match.
    result = _match(
        [{"item": "2 cups rice", "quantity": 2, "unit": "cup"}],
        [{"id": 1, "name": "Rice", "quantity": 500, "unit": "g"}],
    )
    assert result["match_percentage"] == 75.0
    assert result["ingredient_matches"][0]["status"] == "partial"


def test_volume_package_satisfies_volume_recipe():
    # Positive control: same dimension (volume -> volume) DOES full-match.
    # 1 litre package = 1000 ml >= 2 cups (473 ml).
    result = _match(
        [{"item": "2 cups rice", "quantity": 2, "unit": "cup"}],
        [{"id": 1, "name": "Rice", "quantity": 1, "package_quantity": 1, "package_unit": "l"}],
    )
    assert result["match_percentage"] == 100.0
    assert result["ingredient_matches"][0]["status"] == "available"


def test_count_recipe_not_full_matched_by_weight_pantry():
    # Fixed 2026-07-31: _quantity_score's count path now checks the pantry unit's
    # dimension (like the package path), so a bare-count recipe ("2 onions") is
    # NOT confidently full-matched by a weight-only pantry row (500 g) — you can't
    # derive a count from a mass. It reads as partial / needs-confirmation.
    result = _match(
        [{"item": "2 onions", "quantity": 2}],
        [{"id": 1, "name": "Onions", "quantity": 500, "unit": "g"}],
    )
    assert result["match_percentage"] < 100.0


# ── Gap 3: optional / staple weighting ───────────────────────────────────────

def test_ingredient_weight_scales_by_importance():
    m = _matcher()
    assert m._ingredient_weight("cilantro", "cilantro", optional=True, staple=False) == 0.0
    assert m._ingredient_weight("salt", "salt", optional=False, staple=True) == 0.0
    assert m._ingredient_weight("olive oil", "oil", optional=False, staple=False) == 0.35
    assert m._ingredient_weight("cilantro", "cilantro", optional=False, staple=False) == 0.45
    assert m._ingredient_weight("flour", "flour", optional=False, staple=False) == 1.0


def test_looks_optional_detects_flags_and_phrases():
    m = _matcher()
    assert m._looks_optional("cilantro, for garnish", {}) is True
    assert m._looks_optional("chopped nuts (optional)", {}) is True
    assert m._looks_optional("anything", {"optional": True}) is True
    assert m._looks_optional("2 cups all-purpose flour", {}) is False


def test_absent_optional_ingredient_does_not_tank_match():
    # An absent OPTIONAL ingredient is ignored (weight 0), so a recipe whose
    # only real requirement is on hand still reads 100% ready.
    result = _match(
        [
            {"item": "2 chicken breasts", "quantity": 2},
            {"item": "cilantro, for garnish"},
        ],
        [{"id": 1, "name": "Chicken Breast", "quantity": 2}],
    )
    assert result["match_percentage"] == 100.0
    assert result["ignored_count"] == 1


def test_absent_required_ingredient_does_lower_match():
    # Contrast: the SAME ingredient, not marked optional, is a real herb
    # requirement (weight 0.45) and drags the percentage below 100.
    result = _match(
        [
            {"item": "2 chicken breasts", "quantity": 2},
            {"item": "cilantro"},
        ],
        [{"id": 1, "name": "Chicken Breast", "quantity": 2}],
    )
    assert result["match_percentage"] < 100.0
    assert result["missing_count"] == 1


# ── Gap 4: malformed / edge inputs degrade gracefully ────────────────────────

def test_empty_pantry_yields_zero_match():
    result = _match([{"item": "2 cups flour", "quantity": 2, "unit": "cup"}], [])
    assert result["match_percentage"] == 0
    assert result["missing_count"] == 1


def test_ingredient_missing_both_item_and_name_keys_does_not_crash():
    # A nameless ingredient normalizes to '' and cannot match anything; it is
    # scored as a missing required item (no crash, sensible non-100 result).
    result = _match(
        [{"quantity": 2}],
        [{"id": 1, "name": "Flour", "quantity": 1}],
    )
    assert result["match_percentage"] == 0
    assert result["missing_count"] == 1


def test_pantry_item_without_name_is_skipped():
    # A pantry row with no product_name/name is dropped from the index, so a
    # real recipe ingredient simply finds nothing — 0%, no crash.
    result = _match(
        [{"item": "flour", "quantity": 1}],
        [{"id": 1, "quantity": 1}],
    )
    assert result["match_percentage"] == 0


def test_none_quantities_on_both_sides_still_name_match():
    # None recipe quantity and None pantry quantity fall back to a name match
    # rather than raising.
    result = _match(
        [{"item": "flour", "quantity": None, "unit": None}],
        [{"id": 1, "name": "Flour", "quantity": None}],
    )
    assert result["match_percentage"] == 100.0
    assert result["ingredient_matches"][0]["status"] == "available"


def test_empty_ingredient_list_returns_zero_via_match_recipe():
    m = _matcher()
    recipe = MagicMock()
    recipe.ingredients = []
    result = m._match_recipe(recipe, m._build_pantry_index([{"name": "Flour", "quantity": 1}]), set())
    assert result["match_percentage"] == 0
    assert result["available_count"] == 0
    assert result["missing_count"] == 0
