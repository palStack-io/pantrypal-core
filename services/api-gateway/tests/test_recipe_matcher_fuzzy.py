"""
Tests for RecipeMatcher's ingredient normalization and fuzzy matching —
the pure-logic core that decides whether a pantry item counts toward a
recipe's match percentage. All methods under test take no DB.

Run with:
    cd services/api-gateway
    DATABASE_URL="postgresql://test:test@localhost:5432/test" \
      python -m pytest tests/test_recipe_matcher_fuzzy.py -v -p no:asyncio
"""
import sys
import os
from unittest.mock import MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.recipe_matcher import RecipeMatcher


def _matcher():
    return RecipeMatcher(db=MagicMock())


def _match(ingredient_line, pantry_names):
    m = _matcher()
    pantry = {m._normalize_ingredient_name(p) for p in pantry_names}
    return m._fuzzy_match_ingredient(ingredient_line.lower(), pantry)


# ── normalization ────────────────────────────────────────────────────────────

def test_normalize_strips_quantities_units_and_prep_words():
    m = _matcher()
    assert m._normalize_ingredient_name("4 large onions, halved, peeled, and chopped") == "onion"
    assert m._normalize_ingredient_name("1/2 cup white sugar") == "white sugar"
    assert m._normalize_ingredient_name("2 tbsp finely chopped fresh cilantro") == "cilantro"
    assert m._normalize_ingredient_name("3 cloves garlic, minced") == "garlic"


def test_normalize_handles_interior_plurals():
    # Old code singularized only the tail of the whole string, so a plural
    # buried mid-sentence stayed plural and never matched.
    m = _matcher()
    assert "onion" in m._normalize_ingredient_name("2 onions, sliced into rings")


def test_normalize_aliases_apply_to_both_sides():
    m = _matcher()
    assert m._normalize_ingredient_name("3 scallions") == "green onion"
    assert m._normalize_ingredient_name("Green Onions") == "green onion"
    assert m._normalize_ingredient_name("1 aubergine") == "eggplant"


def test_runtime_aliases_extend_normalization_rules():
    m = _matcher()
    m._rules_cache = m.merge_matching_config(
        m.default_matching_config(),
        {"aliases": {"besan": "chickpea flour"}},
    )

    assert m._normalize_ingredient_name("1 cup besan") == "chickpea flour"


def test_normalize_all_noise_falls_back_instead_of_empty():
    # "cloves" the spice collides with the garlic-clove unit word — must not
    # normalize to empty string.
    m = _matcher()
    assert m._normalize_ingredient_name("1 tsp ground cloves") != ""


# ── fuzzy matching: true positives ──────────────────────────────────────────

def test_matches_core_ingredient_inside_scraped_sentence():
    assert _match("4 large onions, halved, peeled, and chopped", ["Onions"]) is not None
    assert _match("1/4 tsp salt", ["Salt"]) is not None
    assert _match("4 oz crumbled goat cheese", ["Goat Cheese"]) is not None
    assert _match("2 boneless skinless chicken breasts", ["Chicken Breast"]) is not None


def test_matches_synonyms_across_naming_conventions():
    assert _match("2 chopped scallions", ["Green Onions"]) is not None
    assert _match("1 cup chickpeas, drained", ["Garbanzo Beans"]) is not None


def test_matches_reordered_multiword_pantry_item():
    # Word-set rule: all pantry words present, any order.
    assert _match("cheese, goat, crumbled", ["Goat Cheese"]) is not None


# ── fuzzy matching: false positives that must NOT match ─────────────────────

def test_no_substring_false_positives():
    # These all failed before the word-boundary fix.
    assert _match("4 oz crumbled goat cheese", ["Oats"]) is None
    assert _match("1 large eggplant, sliced", ["Eggs"]) is None
    assert _match("4 hamburger buns", ["Ham"]) is None
    assert _match("1 cup peanut butter", ["Peas"]) is None


def test_different_oils_do_not_cross_match():
    # Old 50%-overlap rule matched these because they share the word "oil".
    assert _match("1/4 cup vegetable oil", ["Olive Oil"]) is None
    assert _match("2 tbsp olive oil", ["Olive Oil"]) is not None


def test_red_wine_vinegar_is_not_red_wine():
    assert _match("1/2 cup red wine vinegar", ["Red Wine"]) is None
    assert _match("1/2 cup red wine vinegar", ["Red Wine Vinegar"]) is not None


def test_transformative_heads_require_full_phrase():
    # Derived products are not their base ingredient.
    assert _match("1 cup peanut butter", ["Butter"]) is None
    assert _match("1 can coconut milk", ["Milk"]) is None
    assert _match("4 cups chicken broth", ["Chicken"]) is None
    assert _match("2 tbsp lemon juice", ["Lemons"]) is None
    # ...but the actual product in the pantry still matches.
    assert _match("1 cup peanut butter", ["Peanut Butter"]) is not None
    assert _match("4 cups chicken broth", ["Chicken Broth"]) is not None


def test_first_clause_is_the_identity_not_trailing_prep():
    # "packed in oil" made 'oil' the head noun of the whole line, which
    # mis-triggered the transformative-head rule against a word that isn't
    # the ingredient. The first comma-clause is the identity.
    assert _match("One 6.7-ounce jar sun-dried tomatoes, packed in oil*", ["Sun-Dried Tomatoes"]) is not None


def test_trailing_clause_alternate_names_still_match():
    # ...but trailing clauses can carry the usable name, so the full line
    # gets a second pass.
    assert _match("Hot sauce, preferably Sriracha", ["Sriracha"]) is not None
    assert _match("Hot sauce, preferably Sriracha", ["Hot Sauce"]) is not None


def test_or_alternatives_match_either_pantry_item():
    # "avocado oil or olive oil" combined into one phrase matches neither
    # pantry item under the strict transformative-head rule — each
    # alternative needs to be tried on its own.
    assert _match("2 tablespoons avocado oil or extra-virgin olive oil", ["Avocado Oil"]) is not None
    assert _match("2 tablespoons avocado oil or extra-virgin olive oil", ["Olive Oil"]) is not None


def test_or_alternative_in_trailing_clause():
    assert _match(
        "Optional (for additional creaminess): half-and-half, or regular or light coconut milk",
        ["Coconut Milk"],
    ) is not None


def test_irregular_plural_leaf_leaves():
    assert _match("1 bay leaf", ["Bay Leaves"]) is not None


def test_transformative_head_ignores_leading_variety_descriptors():
    # "Thai red curry paste" should still satisfy a pantry item just called
    # "Curry Paste" — thai/red are variety/style words, not a different
    # product, unlike "peanut" in front of "butter". The strict rule checks
    # the ingredient's core (last two tokens), not the whole phrase.
    assert _match("1-3 tablespoons Thai red curry paste", ["Curry Paste"]) is not None
    assert _match("1 cup peanut butter", ["Butter"]) is None


def test_non_transformative_heads_match_base_ingredient():
    # Cuts/forms of the base ingredient SHOULD match generously.
    assert _match("2 chicken breasts, halved", ["Chicken"]) is not None
    assert _match("2 cups all-purpose flour", ["Flour"]) is not None
    assert _match("3 tbsp unsalted butter", ["Butter"]) is not None


# ── _match_recipe reads both 'item' and 'name' ingredient keys ──────────────

def test_match_recipe_reads_item_key():
    # IngredientIn schema (URL import / AI drafts / manual create) uses 'item'.
    m = _matcher()
    recipe = MagicMock()
    recipe.ingredients = [{"item": "2 cups flour", "quantity": 2, "unit": "cup"}]
    result = m._match_recipe(recipe, {"flour"}, set())
    assert result["match_percentage"] == 100.0


def test_match_recipe_reads_name_key():
    # Mealie/Tandoor imports use 'name'.
    m = _matcher()
    recipe = MagicMock()
    recipe.ingredients = [{"name": "flour", "quantity": 2, "unit": "cup"}]
    result = m._match_recipe(recipe, {"flour"}, set())
    assert result["match_percentage"] == 100.0


# ── structured weighted matching ────────────────────────────────────────────

def test_staples_do_not_penalize_recipe_readiness():
    m = _matcher()
    recipe = MagicMock()
    recipe.ingredients = [
        {"item": "2 chicken breasts", "quantity": 2, "unit": None},
        {"item": "1 tsp salt"},
        {"item": "1/2 tsp black pepper"},
    ]
    pantry_items = [{"id": 7, "name": "Chicken Breast", "quantity": 2}]

    result = m._match_recipe(recipe, m._build_pantry_index(pantry_items), set())

    assert result["match_percentage"] == 100.0
    assert result["ignored_count"] == 2
    assert result["available_count"] == 1


def test_package_notes_with_different_dimension_match_but_need_confirmation():
    m = _matcher()
    recipe = MagicMock()
    recipe.ingredients = [{"item": "2 cups rice", "quantity": 2, "unit": "cup"}]
    pantry_items = [{"id": 5, "name": "Jasmine Rice", "quantity": 1, "notes": "5lb bag"}]

    result = m._match_recipe(recipe, m._build_pantry_index(pantry_items), set())

    assert result["match_percentage"] == 75.0
    assert result["ingredient_matches"][0]["pantry_item_id"] == 5
    assert result["ingredient_matches"][0]["status"] == "partial"
    assert result["ingredient_matches"][0]["reason"] == "name matched; unit quantity needs confirmation"


def test_package_notes_with_same_dimension_satisfy_recipe_quantity():
    m = _matcher()
    recipe = MagicMock()
    recipe.ingredients = [{"item": "14 oz diced tomatoes", "quantity": 14, "unit": "oz"}]
    pantry_items = [{"id": 6, "name": "Diced Tomatoes", "quantity": 1, "notes": "14.5oz can"}]

    result = m._match_recipe(recipe, m._build_pantry_index(pantry_items), set())

    assert result["match_percentage"] == 100.0
    assert result["ingredient_matches"][0]["status"] == "available"
    assert result["ingredient_matches"][0]["reason"] == "name and package quantity matched"


def test_explicit_package_fields_satisfy_recipe_quantity():
    m = _matcher()
    recipe = MagicMock()
    recipe.ingredients = [{"item": "14 oz diced tomatoes", "quantity": 14, "unit": "oz"}]
    pantry_items = [{
        "id": 16,
        "name": "Diced Tomatoes",
        "quantity": 1,
        "package_quantity": 14.5,
        "package_unit": "oz",
    }]

    result = m._match_recipe(recipe, m._build_pantry_index(pantry_items), set())

    assert result["match_percentage"] == 100.0
    assert result["ingredient_matches"][0]["pantry_item_id"] == 16
    assert result["ingredient_matches"][0]["status"] == "available"


def test_dozen_package_unit_counts_as_twelve_items():
    m = _matcher()
    recipe = MagicMock()
    recipe.ingredients = [{"item": "12 eggs", "quantity": 12, "unit": None}]
    pantry_items = [{
        "id": 17,
        "name": "Eggs",
        "quantity": 1,
        "package_quantity": 1,
        "package_unit": "dozen",
    }]

    result = m._match_recipe(recipe, m._build_pantry_index(pantry_items), set())

    assert result["match_percentage"] == 100.0
    assert result["ingredient_matches"][0]["status"] == "available"


def test_substitution_match_is_scored_and_labeled():
    m = _matcher()
    recipe = MagicMock()
    recipe.ingredients = [{"item": "1 cup chicken stock", "quantity": 1, "unit": "cup"}]
    pantry_items = [{"id": 19, "name": "Chicken Broth", "quantity": 1}]

    result = m._match_recipe(recipe, m._build_pantry_index(pantry_items), set())

    assert result["match_percentage"] == 75.0
    assert result["available_count"] == 1
    assert result["ingredient_matches"][0]["status"] == "substitute"
    assert result["ingredient_matches"][0]["pantry_item_id"] == 19
    assert result["ingredient_matches"][0]["reason"].startswith("substitution matched")


def test_candidate_lookup_names_include_recipe_side_substitutions():
    m = _matcher()

    assert "chicken stock" in m._candidate_lookup_names(["chicken broth"])


def test_short_count_match_is_partial_not_full():
    m = _matcher()
    recipe = MagicMock()
    recipe.ingredients = [{"item": "12 eggs", "quantity": 12, "unit": None}]
    pantry_items = [{"id": 9, "name": "Eggs", "quantity": 1}]

    result = m._match_recipe(recipe, m._build_pantry_index(pantry_items), set())

    assert result["available_count"] == 1
    assert result["ingredient_matches"][0]["status"] == "partial"
    assert result["match_percentage"] < 100.0


def test_structured_match_returns_expiring_item_details():
    m = _matcher()
    recipe = MagicMock()
    recipe.ingredients = [{"item": "butter", "quantity": None, "unit": None}]
    pantry_items = [{"id": 3, "name": "Butter", "quantity": 1, "expiry_date": "2000-01-01"}]

    result = m._match_recipe(recipe, m._build_pantry_index(pantry_items), set())

    assert result["uses_expiring_items"] is True
    assert result["expiring_ingredients"][0]["pantry_item_id"] == 3


def test_match_ingredients_to_pantry_returns_ids_for_cook_deduction():
    m = _matcher()
    matched = m.match_ingredients_to_pantry(
        [{"item": "2 chicken breasts", "quantity": 2}],
        pantry_items=[{"id": 11, "name": "Chicken Breast", "quantity": 2}],
    )

    assert matched == [{
        "pantry_item_id": 11,
        "pantry_item_name": "Chicken Breast",
        "ingredient_name": "2 chicken breasts",
        "quantity": 2,
        "status": "available",
        "reason": "name and count matched",
    }]


def test_normalize_ingredients_for_storage_is_json_friendly():
    m = _matcher()
    normalized = m.normalize_ingredients_for_storage([
        {"item": "2 cups chopped scallions", "quantity": 2, "unit": "cup"},
        {"item": "salt, to taste"},
    ])

    assert normalized[0]["canonical_name"] == "green onion"
    assert normalized[0]["tokens"] == ["green", "onion"]
    assert normalized[0]["quantity"] == 2.0
    assert normalized[0]["unit"] == "cup"
    assert normalized[1]["staple"] is True


def test_normalized_names_for_storage_dedupes_names():
    m = _matcher()
    names = m.normalized_names_for_storage([
        {"item": "2 scallions"},
        {"item": "green onions"},
    ])

    assert names == ["green onion"]


def test_quantity_parser_handles_mixed_written_and_range_amounts():
    m = _matcher()

    assert m._extract_quantity_unit("1 1/2 cups flour") == (1.5, "cup")
    assert m._extract_quantity_unit("1½ cups milk") == (1.5, "cup")
    assert m._extract_quantity_unit("one large onion") == (1.0, None)
    assert m._extract_quantity_unit("1-2 cups stock") == (1.0, "cup")


def test_zero_recipe_quantity_from_import_is_treated_as_unknown():
    m = _matcher()
    parsed = m._parse_recipe_ingredient({"name": "Flour", "quantity": 0, "unit": ""})

    assert parsed["quantity"] is None


def test_fluid_ounce_package_quantity_matches_volume_recipe():
    m = _matcher()
    recipe = MagicMock()
    recipe.ingredients = [{"item": "8 fl oz milk", "quantity": None, "unit": None}]
    pantry_items = [{"id": 21, "name": "Milk", "quantity": 1, "package_quantity": 1, "package_unit": "cup"}]

    result = m._match_recipe(recipe, m._build_pantry_index(pantry_items), set())

    assert result["match_percentage"] == 100.0
    assert result["ingredient_matches"][0]["reason"] == "name and package quantity matched"


def test_cook_deduction_uses_count_quantity_when_safe():
    m = _matcher()
    matched = m.match_ingredients_to_pantry(
        [{"item": "2 onions", "quantity": 2}],
        pantry_items=[{"id": 22, "name": "Onions", "quantity": 5}],
    )

    assert matched[0]["quantity"] == 2


def test_cook_deduction_uses_package_count_when_safe():
    m = _matcher()
    matched = m.match_ingredients_to_pantry(
        [{"item": "12 eggs", "quantity": 12}],
        pantry_items=[{
            "id": 23,
            "name": "Eggs",
            "quantity": 2,
            "package_quantity": 1,
            "package_unit": "dozen",
        }],
    )

    assert matched[0]["quantity"] == 1


import asyncio


def test_match_recipe_async_flags_absent_ingredient_as_missing():
    m = RecipeMatcher(db=MagicMock())
    recipe = MagicMock()
    recipe.ingredients = [{"item": "all-purpose flour", "quantity": 2, "unit": "cup"}]
    pantry_items = [{"name": "white sugar", "quantity": 1}]

    result = asyncio.run(m.match_recipe_async(recipe, "user-1", pantry_items))

    assert result["match_percentage"] == 0
    assert result["missing_ingredients"], "flour should be reported missing"


def test_match_recipe_async_counts_present_ingredient():
    m = RecipeMatcher(db=MagicMock())
    recipe = MagicMock()
    recipe.ingredients = [{"item": "white sugar", "quantity": 1, "unit": "cup"}]
    pantry_items = [{"name": "white sugar", "quantity": 5, "unit": "cup"}]

    result = asyncio.run(m.match_recipe_async(recipe, "user-1", pantry_items))

    assert result["match_percentage"] > 0
