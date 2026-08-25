"""
Recipe Matcher Service
Matches recipes against user's pantry inventory
Calculates match percentages and identifies expiring items

Shared Household Model:
- Recipes are shared across all users
- Match results stored in UserRecipePreference (per-user)
- Query methods return (Recipe, UserRecipePreference) tuples
"""
import json
import math
import re
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy.orm import Session

from ..models import Recipe, UserRecipePreference
from ..services.ingredient_normalize import singularize_word as _shared_singularize_word
from . import data, units


class RecipeMatcher:
    """Service for matching recipes to pantry inventory"""

    def __init__(self, db: Session):
        self.db = db
        self._rules_cache = None

    MATCHING_RULES_CONFIG_KEY = "recipe_matching_rules"

    # Stateless data tables / unit machinery live in sibling modules; rebound
    # here as class attributes so ``self._STAPLES`` / ``RecipeMatcher._STAPLES``
    # (and the unit tables) still resolve exactly as before.
    _STAPLES = data._STAPLES
    _LOW_WEIGHT_HEADS = data._LOW_WEIGHT_HEADS
    _NOISE_WORDS = data._NOISE_WORDS
    _ALIASES = data._ALIASES
    _IRREGULAR_PLURALS = data._IRREGULAR_PLURALS
    _UNIT_ALIASES = units._UNIT_ALIASES
    _UNIT_TO_BASE = units._UNIT_TO_BASE
    _NUMBER_WORDS = units._NUMBER_WORDS

    def default_matching_config(self) -> Dict:
        """Return the built-in rule dictionary admins can extend at runtime."""
        return {
            "aliases": dict(self._ALIASES),
            "staples": sorted(self._STAPLES),
            "low_weight_heads": sorted(self._LOW_WEIGHT_HEADS),
            "transformative_heads": sorted(self._TRANSFORMATIVE_HEADS),
            "substitutions": {k: list(v) for k, v in self._SUBSTITUTIONS.items()},
        }

    def _matching_rules(self) -> Dict:
        if self._rules_cache is not None:
            return self._rules_cache

        rules = self.default_matching_config()
        try:
            from ..services.config_service import get_config
            raw = get_config(self.MATCHING_RULES_CONFIG_KEY)
            if raw:
                rules = self.merge_matching_config(rules, json.loads(raw))
        except Exception:
            # Matching must remain available even if runtime config is invalid
            # or the config table is temporarily unavailable.
            pass

        self._rules_cache = rules
        return rules

    @classmethod
    def merge_matching_config(cls, base: Dict, override: Optional[Dict]) -> Dict:
        """Merge admin rules into defaults without dropping built-in safety rules."""
        merged = {
            "aliases": dict(base.get("aliases") or {}),
            "staples": list(base.get("staples") or []),
            "low_weight_heads": list(base.get("low_weight_heads") or []),
            "transformative_heads": list(base.get("transformative_heads") or []),
            "substitutions": {
                str(k).lower().strip(): [str(v).lower().strip() for v in values if str(v).strip()]
                for k, values in (base.get("substitutions") or {}).items()
                if isinstance(values, list)
            },
        }

        if not isinstance(override, dict):
            return cls._dedupe_matching_config(merged)

        aliases = override.get("aliases")
        if isinstance(aliases, dict):
            for alias, canonical in aliases.items():
                alias_key = str(alias).lower().strip()
                canonical_value = str(canonical).lower().strip()
                if alias_key and canonical_value:
                    merged["aliases"][alias_key] = canonical_value

        for key in ("staples", "low_weight_heads", "transformative_heads"):
            values = override.get(key)
            if isinstance(values, list):
                merged[key].extend(str(value).lower().strip() for value in values if str(value).strip())

        substitutions = override.get("substitutions")
        if isinstance(substitutions, dict):
            for ingredient, options in substitutions.items():
                if not isinstance(options, list):
                    continue
                ingredient_key = str(ingredient).lower().strip()
                if not ingredient_key:
                    continue
                merged["substitutions"].setdefault(ingredient_key, [])
                merged["substitutions"][ingredient_key].extend(
                    str(option).lower().strip() for option in options if str(option).strip()
                )

        return cls._dedupe_matching_config(merged)

    @staticmethod
    def _dedupe_matching_config(config: Dict) -> Dict:
        for key in ("staples", "low_weight_heads", "transformative_heads"):
            config[key] = sorted(set(config.get(key) or []))
        config["aliases"] = dict(sorted((config.get("aliases") or {}).items()))
        config["substitutions"] = {
            ingredient: sorted(set(options))
            for ingredient, options in sorted((config.get("substitutions") or {}).items())
            if options
        }
        return config

    def _aliases(self) -> Dict[str, str]:
        return self._matching_rules().get("aliases") or {}

    def _staples(self) -> Set[str]:
        return set(self._matching_rules().get("staples") or [])

    def _low_weight_heads(self) -> Set[str]:
        return set(self._matching_rules().get("low_weight_heads") or [])

    def _transformative_heads(self) -> Set[str]:
        return set(self._matching_rules().get("transformative_heads") or [])

    def _substitutions(self) -> Dict[str, List[str]]:
        return self._matching_rules().get("substitutions") or {}

    def _get_or_create_preference(self, user_id: str, recipe_id: str) -> UserRecipePreference:
        """Get or create user preference record for a recipe"""
        pref = self.db.query(UserRecipePreference).filter(
            UserRecipePreference.user_id == user_id,
            UserRecipePreference.recipe_id == recipe_id
        ).first()

        if not pref:
            pref = UserRecipePreference(
                user_id=user_id,
                recipe_id=recipe_id
            )
            self.db.add(pref)
            self.db.flush()

        return pref

    async def calculate_matches(
        self,
        user_id: str,
        pantry_items: List[Dict],
        expiring_days: int = 7
    ) -> Dict:
        """
        Calculate match percentages for all recipes visible to the household
        Stores results in UserRecipePreference for the specific user

        Args:
            user_id: User ID (for storing preferences)
            pantry_items: List of pantry items from inventory service
            expiring_days: Days threshold for expiring items

        Returns:
            Statistics about matching
        """
        recipes = self.db.query(Recipe).all()

        # Prepare pantry data. The old matcher only kept a set of normalized
        # names; the structured index preserves IDs, quantities, categories,
        # notes, and expiry so scoring can be explainable and quantity-aware.
        pantry_index = self._build_pantry_index(pantry_items, expiring_days)

        stats = {
            'total_recipes': len(recipes),
            'recipes_updated': 0,
            'recipes_with_matches': 0,
            'recipes_using_expiring': 0
        }

        # Calculate matches for each recipe
        for recipe in recipes:
            match_result = self._match_recipe(
                recipe=recipe,
                pantry_ingredients=pantry_index,
                expiring_items=set()
            )

            # Store match result in UserRecipePreference
            updated = self._update_user_preference(user_id, recipe.id, match_result)

            if updated:
                stats['recipes_updated'] += 1

            if match_result['match_percentage'] > 0:
                stats['recipes_with_matches'] += 1

            if match_result['uses_expiring_items']:
                stats['recipes_using_expiring'] += 1

        self.db.commit()

        return stats

    def _match_recipe(
        self,
        recipe: Recipe,
        pantry_ingredients: Any,
        expiring_items: Set[str]
    ) -> Dict:
        """
        Match a single recipe against pantry

        Returns:
            Dict with match_percentage, available, missing, expiring counts
        """
        recipe_ingredients = recipe.ingredients or []

        if not recipe_ingredients:
            return {
                'match_percentage': 0,
                'available_count': 0,
                'missing_count': 0,
                'expiring_count': 0,
                'missing_ingredients': [],
                'expiring_ingredients': [],
                'uses_expiring_items': False
            }

        return self._match_ingredients(recipe_ingredients, pantry_ingredients, expiring_items)

    async def match_recipe_async(
        self,
        recipe: Recipe,
        user_id: str,
        pantry_items: List[Dict],
        expiring_days: int = 7,
    ) -> Dict:
        """Match a single recipe against freshly-fetched pantry items without
        persisting. Used by GET /recipes/{id}/shopping-gaps to freshen a
        recipe's missing-ingredient list when no UserRecipePreference exists
        yet. Callers that want persistence use calculate_matches instead."""
        pantry_index = self._build_pantry_index(pantry_items, expiring_days)
        return self._match_recipe(recipe, pantry_index, set())

    def _candidate_lookup_names(self, pantry_names: List[str]) -> List[str]:
        """Expand pantry names with recipe-side names that can be substituted."""
        lookup_names = set(pantry_names)
        pantry_set = set(pantry_names)
        for recipe_name, options in self._substitutions().items():
            if any(self._fuzzy_match_normalized(option, pantry_set) for option in options):
                lookup_names.add(recipe_name)
        return sorted(lookup_names)

    def _update_user_preference(self, user_id: str, recipe_id: str, match_result: Dict) -> bool:
        """
        Update UserRecipePreference with match results

        Returns:
            True if updated
        """
        pref = self._get_or_create_preference(user_id, recipe_id)

        pref.match_percentage = Decimal(str(match_result['match_percentage']))
        pref.available_ingredient_count = match_result['available_count']
        pref.missing_ingredient_count = match_result['missing_count']
        pref.expiring_ingredient_count = match_result['expiring_count']
        pref.missing_ingredients = match_result['missing_ingredients']
        pref.expiring_ingredients = match_result['expiring_ingredients']
        pref.ingredient_matches = match_result.get('ingredient_matches', [])
        pref.ignored_ingredient_count = match_result.get('ignored_count', 0)
        pref.weighted_available = Decimal(str(match_result.get('weighted_available', 0)))
        pref.weighted_total = Decimal(str(match_result.get('weighted_total', 0)))
        pref.uses_expiring_items = match_result['uses_expiring_items']
        pref.updated_at = datetime.utcnow()

        return True

    def _normalize_pantry_items(self, pantry_items: List[Dict]) -> Set[str]:
        """
        Normalize pantry items to ingredient names

        Returns:
            Set of lowercase normalized ingredient names
        """
        ingredients = set()

        for item in pantry_items:
            name = item.get('product_name', '') or item.get('name', '')
            if name:
                normalized = self._normalize_ingredient_name(name)
                ingredients.add(normalized)

        return ingredients

    def _get_expiring_items(
        self,
        pantry_items: List[Dict],
        days_threshold: int
    ) -> Set[str]:
        """
        Get items expiring within threshold

        Returns:
            Set of normalized names for expiring items
        """
        expiring = set()
        now = datetime.utcnow()
        threshold_date = now + timedelta(days=days_threshold)

        for item in pantry_items:
            expiry_str = item.get('expiry_date')
            if not expiry_str:
                continue

            try:
                # Parse expiry date (ISO format: YYYY-MM-DD)
                expiry_date = datetime.fromisoformat(expiry_str.replace('Z', ''))

                if expiry_date <= threshold_date:
                    name = item.get('product_name', '') or item.get('name', '')
                    if name:
                        normalized = self._normalize_ingredient_name(name)
                        expiring.add(normalized)

            except (ValueError, AttributeError):
                continue

        return expiring

    def _unwrap_pantry_items(self, pantry_items: Any) -> List[Dict]:
        """Accept both inventory-service shapes: raw list or paginated object."""
        if isinstance(pantry_items, dict):
            items = pantry_items.get("items", [])
            return items if isinstance(items, list) else []
        return pantry_items if isinstance(pantry_items, list) else []

    def _build_pantry_index(self, pantry_items: Any, expiring_days: int = 7) -> List[Dict]:
        """Build structured pantry candidates without losing match metadata."""
        candidates = []
        now = datetime.utcnow()
        threshold_date = now + timedelta(days=expiring_days)

        for item in self._unwrap_pantry_items(pantry_items):
            name = item.get('product_name', '') or item.get('name', '')
            if not name:
                continue

            normalized = self._normalize_ingredient_name(name)
            expiry_date = self._parse_date(item.get('expiry_date'))
            notes = item.get('notes') or ''
            package_qty = self._to_float(item.get('package_quantity'))
            package_unit = self._canonical_unit(item.get('package_unit'))
            if package_qty is None or package_unit is None:
                package_qty, package_unit = self._extract_package_size(notes)

            candidates.append({
                'id': item.get('id'),
                'name': name,
                'normalized': normalized,
                'tokens': set(normalized.split()),
                'head': normalized.split()[-1] if normalized.split() else '',
                'brand': item.get('brand'),
                'category': item.get('category'),
                'quantity': self._to_float(item.get('quantity')),
                'unit': self._canonical_unit(item.get('unit')),
                'package_quantity': package_qty,
                'package_unit': package_unit,
                'expiry_date': expiry_date,
                'expiring': bool(expiry_date and expiry_date <= threshold_date),
                'raw': item,
            })

        return candidates

    def _legacy_candidates(self, pantry_ingredients: Set[str], expiring_items: Set[str]) -> List[Dict]:
        return [
            {
                'id': None,
                'name': name,
                'normalized': name,
                'tokens': set(name.split()),
                'head': name.split()[-1] if name.split() else '',
                'brand': None,
                'category': None,
                'quantity': None,
                'unit': None,
                'package_quantity': None,
                'package_unit': None,
                'expiry_date': None,
                'expiring': name in expiring_items,
                'raw': {},
            }
            for name in pantry_ingredients
        ]

    def _coerce_pantry_index(self, pantry_ingredients: Any, expiring_items: Set[str]) -> List[Dict]:
        if isinstance(pantry_ingredients, set):
            return self._legacy_candidates(pantry_ingredients, expiring_items)
        if isinstance(pantry_ingredients, list):
            return pantry_ingredients
        return []

    def _match_ingredients(
        self,
        ingredients: List[Dict],
        pantry_ingredients: Any,
        expiring_items: Set[str]
    ) -> Dict:
        pantry_index = self._coerce_pantry_index(pantry_ingredients, expiring_items)
        pantry_names = {p['normalized'] for p in pantry_index}

        available_count = 0
        missing_ingredients = []
        expiring_ingredients = []
        ingredient_matches = []
        weighted_available = 0.0
        weighted_total = 0.0
        ignored_count = 0

        for ingredient in ingredients:
            parsed = self._parse_recipe_ingredient(ingredient)
            weight = parsed['weight']
            match = self._best_pantry_match(parsed, pantry_index, pantry_names)
            status = match['status']

            if status == 'ignored':
                ignored_count += 1
            else:
                weighted_total += weight
                weighted_available += weight * match['score']

            if status in {'available', 'partial', 'substitute'}:
                available_count += 1
                pantry_item = match.get('pantry_item') or {}
                if pantry_item.get('expiring'):
                    expiring_ingredients.append(self._ingredient_payload(
                        parsed,
                        pantry_item=pantry_item,
                        status=status,
                        reason=match['reason']
                    ))
            elif status == 'missing':
                missing_ingredients.append(self._ingredient_payload(
                    parsed,
                    status=status,
                    reason=match['reason']
                ))

            ingredient_matches.append(self._ingredient_payload(
                parsed,
                pantry_item=match.get('pantry_item'),
                status=status,
                reason=match['reason'],
                score=match['score'],
                weight=weight,
            ))

        match_percentage = (weighted_available / weighted_total) * 100 if weighted_total else 0

        return {
            'match_percentage': round(match_percentage, 2),
            'available_count': available_count,
            'missing_count': len(missing_ingredients),
            'expiring_count': len(expiring_ingredients),
            'ignored_count': ignored_count,
            'weighted_available': round(weighted_available, 3),
            'weighted_total': round(weighted_total, 3),
            'missing_ingredients': missing_ingredients,
            'expiring_ingredients': expiring_ingredients,
            'ingredient_matches': ingredient_matches,
            'uses_expiring_items': len(expiring_ingredients) > 0
        }

    def _ingredient_payload(
        self,
        parsed: Dict,
        pantry_item: Optional[Dict] = None,
        status: str = 'missing',
        reason: Optional[str] = None,
        score: Optional[float] = None,
        weight: Optional[float] = None,
    ) -> Dict:
        payload = {
            'name': parsed['raw_name'],
            'canonical_name': parsed['canonical_name'],
            'quantity': parsed['quantity'],
            'unit': parsed['unit'],
            'status': status,
            'reason': reason,
        }
        if score is not None:
            payload['score'] = score
        if weight is not None:
            payload['weight'] = weight
        if pantry_item:
            payload['pantry_item_id'] = pantry_item.get('id')
            payload['pantry_item_name'] = pantry_item.get('name')
            payload['pantry_item_category'] = pantry_item.get('category')
            payload['expiry_date'] = pantry_item.get('expiry_date').isoformat() if pantry_item.get('expiry_date') else None
        return payload

    def _parse_recipe_ingredient(self, ingredient: Dict) -> Dict:
        if not isinstance(ingredient, dict):
            ingredient = {'item': str(ingredient)}
        raw_name = ingredient.get('item') or ingredient.get('name') or ''
        quantity = self._to_float(ingredient.get('quantity'))
        unit = self._canonical_unit(ingredient.get('unit'))
        if quantity is not None and quantity <= 0:
            quantity = None

        if quantity is None:
            quantity, parsed_unit = self._extract_quantity_unit(raw_name)
            unit = unit or parsed_unit

        canonical_name = self._normalize_ingredient_name(raw_name)
        head = canonical_name.split()[-1] if canonical_name.split() else ''
        optional = self._looks_optional(raw_name, ingredient)
        staple = canonical_name in self._staples()
        weight = self._ingredient_weight(canonical_name, head, optional, staple)

        return {
            'raw': ingredient,
            'raw_name': raw_name,
            'canonical_name': canonical_name,
            'tokens': set(canonical_name.split()),
            'head': head,
            'quantity': quantity,
            'unit': unit,
            'optional': optional,
            'staple': staple,
            'weight': weight,
        }

    def _ingredient_weight(self, canonical_name: str, head: str, optional: bool, staple: bool) -> float:
        if optional:
            return 0.0
        if staple:
            return 0.0
        if head in self._low_weight_heads():
            return 0.35
        if len(canonical_name.split()) == 1 and head in {'cilantro', 'parsley', 'basil', 'thyme', 'oregano'}:
            return 0.45
        return 1.0

    def _looks_optional(self, raw_name: str, ingredient: Dict) -> bool:
        if ingredient.get('optional') is True:
            return True
        text = f"{raw_name} {ingredient.get('notes') or ''}".lower()
        return bool(re.search(r'\b(optional|for garnish|to serve|for serving|if desired)\b', text))

    def _best_pantry_match(self, parsed: Dict, pantry_index: List[Dict], pantry_names: Set[str]) -> Dict:
        if parsed['weight'] == 0:
            return {'status': 'ignored', 'score': 0.0, 'reason': 'optional or household staple'}

        matched_name = self._fuzzy_match_ingredient(parsed['raw_name'].lower(), pantry_names)
        substitute = False
        if not matched_name:
            matched_name = self._substitute_match(parsed['canonical_name'], pantry_names)
            substitute = bool(matched_name)
        if not matched_name:
            return {'status': 'missing', 'score': 0.0, 'reason': 'no pantry item matched'}

        candidates = [p for p in pantry_index if p['normalized'] == matched_name]
        if not candidates:
            return {'status': 'missing', 'score': 0.0, 'reason': 'matched name had no pantry candidate'}

        candidates.sort(key=lambda p: (p.get('expiring', False), self._quantity_score(parsed, p)[0]), reverse=True)
        pantry_item = candidates[0]
        qty_score, qty_reason = self._quantity_score(parsed, pantry_item)

        status = 'substitute' if substitute else 'available'
        if qty_score < 1.0 and not substitute:
            status = 'partial'
        if substitute:
            qty_reason = f"substitution matched; {qty_reason}"
            qty_score = min(qty_score, 0.75)

        return {
            'status': status,
            'score': qty_score,
            'reason': qty_reason,
            'pantry_item': pantry_item,
        }

    def _quantity_score(self, parsed: Dict, pantry_item: Dict) -> Tuple[float, str]:
        required_qty = parsed.get('quantity')
        required_unit = parsed.get('unit')
        pantry_qty = pantry_item.get('quantity')

        if required_qty is None:
            return 1.0, 'name matched; recipe quantity unknown'
        if pantry_qty is None:
            return 1.0, 'name matched; pantry quantity unknown'

        package_qty = pantry_item.get('package_quantity')
        package_unit = pantry_item.get('package_unit')

        if package_qty and package_unit:
            effective_required_unit = required_unit
            if not effective_required_unit and package_unit in {'count', 'dozen'}:
                effective_required_unit = 'count'
            required_base = self._to_base_quantity(required_qty, effective_required_unit) if effective_required_unit else None
            package_base = self._to_base_quantity(package_qty, package_unit)
            if required_base and package_base and required_base[0] == package_base[0]:
                available = pantry_qty * package_base[1]
                required = required_base[1]
                if available >= required:
                    return 1.0, 'name and package quantity matched'
                if available > 0:
                    return max(0.1, available / required), 'matched but pantry package quantity may be short'
                return 0.5, 'matched but package quantity is unclear'

        if not required_unit or required_unit == 'count':
            # A bare count/unitless requirement can't be confidently satisfied by
            # a pantry item stocked by a different dimension (mass/volume) — you
            # can't derive a discrete count from "500 g". Mirror the package path
            # above, which already rejects this mismatch, instead of blindly
            # comparing the count against a weight/volume magnitude.
            pantry_unit = self._canonical_unit(pantry_item.get('unit'))
            pantry_base = self._to_base_quantity(pantry_qty, pantry_unit) if pantry_unit else None
            if pantry_base and pantry_base[0] != 'count':
                return 0.75, 'name matched; count vs weight/volume needs confirmation'
            if pantry_qty >= required_qty:
                return 1.0, 'name and count matched'
            return max(0.1, pantry_qty / required_qty), 'matched but count is short'

        return 0.75, 'name matched; unit quantity needs confirmation'

    def _to_float(self, value: Any) -> Optional[float]:
        return units.to_float(value)

    def _parse_date(self, value: Any) -> Optional[datetime]:
        return units.parse_date(value)

    def _canonical_unit(self, unit: Any) -> Optional[str]:
        return units.canonical_unit(unit)

    def _extract_quantity_unit(self, text: str) -> Tuple[Optional[float], Optional[str]]:
        return units.extract_quantity_unit(text)

    def _extract_package_size(self, notes: str) -> Tuple[Optional[float], Optional[str]]:
        return units.extract_package_size(notes)

    def _parse_fraction(self, value: str) -> Optional[float]:
        return units.parse_fraction(value)

    def _to_base_quantity(self, quantity: float, unit: str) -> Optional[Tuple[str, float]]:
        return units.to_base_quantity(quantity, unit)

    def normalize_ingredients_for_storage(self, ingredients: List[Dict]) -> List[Dict]:
        """Persistable canonical ingredient records for matching/indexing."""
        normalized = []
        for ingredient in ingredients or []:
            parsed = self._parse_recipe_ingredient(ingredient)
            if not parsed['canonical_name']:
                continue
            normalized.append({
                'raw_name': parsed['raw_name'],
                'canonical_name': parsed['canonical_name'],
                'tokens': sorted(parsed['tokens']),
                'head': parsed['head'],
                'quantity': parsed['quantity'],
                'unit': parsed['unit'],
                'optional': parsed['optional'],
                'staple': parsed['staple'],
                'weight': parsed['weight'],
            })
        return normalized

    def normalized_names_for_storage(self, ingredients: List[Dict]) -> List[str]:
        return sorted({
            item['canonical_name']
            for item in self.normalize_ingredients_for_storage(ingredients)
            if item.get('canonical_name')
        })

    def match_ingredients_to_pantry(
        self,
        ingredients: List[Dict],
        pantry_items: Optional[Any] = None,
    ) -> List[Dict]:
        """Return pantry item IDs and conservative deduction counts for cooking."""
        if pantry_items is None:
            return []

        pantry_index = self._build_pantry_index(pantry_items)
        pantry_names = {p['normalized'] for p in pantry_index}
        matched = []

        for ingredient in ingredients or []:
            parsed = self._parse_recipe_ingredient(ingredient)
            result = self._best_pantry_match(parsed, pantry_index, pantry_names)
            pantry_item = result.get('pantry_item')
            if not pantry_item or result['status'] not in {'available', 'partial', 'substitute'}:
                continue
            matched.append({
                'pantry_item_id': pantry_item.get('id'),
                'pantry_item_name': pantry_item.get('name'),
                'ingredient_name': parsed['raw_name'],
                'quantity': self._deduction_quantity(parsed, pantry_item),
                'status': result['status'],
                'reason': result['reason'],
            })

        return matched

    def _deduction_quantity(self, parsed: Dict, pantry_item: Dict) -> int:
        """Conservative inventory decrement for count/package-based pantry rows."""
        required_qty = parsed.get('quantity')
        if required_qty is None or required_qty <= 0:
            return 1

        required_unit = parsed.get('unit')
        package_qty = pantry_item.get('package_quantity')
        package_unit = pantry_item.get('package_unit')

        if package_qty and package_unit:
            effective_required_unit = required_unit
            if not effective_required_unit and package_unit in {'count', 'dozen'}:
                effective_required_unit = 'count'
            required_base = self._to_base_quantity(required_qty, effective_required_unit) if effective_required_unit else None
            package_base = self._to_base_quantity(package_qty, package_unit)
            if required_base and package_base and required_base[0] == package_base[0] and package_base[1] > 0:
                return max(1, math.ceil(required_base[1] / package_base[1]))

        if not required_unit or required_unit == 'count':
            return max(1, math.ceil(required_qty))

        return 1

    @staticmethod
    def _singularize_word(word: str) -> str:
        return _shared_singularize_word(word)

    def _normalize_ingredient_name(self, name: str) -> str:
        """
        Normalize an ingredient line or pantry item name down to its core
        identity for matching. Scraped ingredient lines are full sentences,
        not clean short phrases like pantry item names, so this strips
        quantities ("1/2", "4"), measurement/container units, prep and
        descriptor words, singularizes each remaining token individually
        (an interior plural like "onions" in "4 large onions, halved" never
        reaches an end-of-string-only singularizer), and canonicalizes
        common synonyms.

        Examples:
            "Fresh Tomatoes" -> "tomato"
            "Whole Milk (2%)" -> "milk"
            "4 large onions, halved, peeled, and chopped" -> "onion"
            "1/2 cup chopped scallions" -> "green onion"
        """
        normalized = name.lower().strip()

        # Remove parentheses content ("(about 2 lbs)", "(optional)")
        normalized = re.sub(r'\([^)]*\)', '', normalized)

        # Tokenize (drops commas/other punctuation), drop anything with a
        # digit (quantities and quantity-units: "4", "1/2", "½", "2-3",
        # "6.7-ounce"), singularize each word, then drop noise words —
        # checking noise membership before AND after singularization, since
        # singularizing first mangles noise words themselves ("plus" →
        # "plu", which the noise list wouldn't catch). The accented range
        # keeps words like "jalapeño" as one token instead of splitting at
        # the non-ASCII letter.
        words = re.findall(r"[a-z0-9à-öø-ÿ'/½⅓⅔¼¾⅛.-]+", normalized)
        non_numeric = []
        for w in words:
            if re.search(r"[\d½⅓⅔¼¾⅛]", w):
                continue
            if w in self._NOISE_WORDS:
                continue
            non_numeric.append(self._singularize_word(w))

        kept = [w for w in non_numeric if w not in self._NOISE_WORDS]
        if not kept:
            # Everything was noise-stripped (e.g. "1 tsp ground cloves" —
            # the spice collides with the garlic-clove unit word). Degrade
            # to the un-stripped tokens rather than matching nothing.
            kept = non_numeric

        result = ' '.join(kept).strip()

        # Canonicalize synonyms — longest alias first so "garbanzo bean"
        # wins over bare "garbanzo".
        aliases = self._aliases()
        for alias in sorted(aliases, key=len, reverse=True):
            result = re.sub(rf'\b{re.escape(alias)}\b', aliases[alias], result)

        return result.strip()

    def _substitute_match(self, canonical_name: str, pantry_ingredients: Set[str]) -> Optional[str]:
        for option in self._substitutions().get(canonical_name, []):
            matched = self._fuzzy_match_normalized(option, pantry_ingredients)
            if matched:
                return matched
        return None

    # Head nouns that name a TRANSFORMED product, not a form/cut of the
    # modifier: "peanut butter" is not butter, "coconut milk" is not milk,
    # "chicken broth" is not chicken, "red wine vinegar" is not red wine.
    # When a multi-word ingredient ends in one of these, a pantry item only
    # counts if it covers the whole phrase — unlike non-transformative heads
    # ("chicken breast", "goat cheese crumbles"), where matching the base
    # ingredient generously is what users expect.
    _TRANSFORMATIVE_HEADS = frozenset("""
        butter milk oil vinegar broth stock sauce paste powder extract
        juice syrup wine flour cream jam jelly
    """.split())

    _SUBSTITUTIONS = {
        'chicken stock': ['chicken broth'],
        'chicken broth': ['chicken stock'],
        'vegetable stock': ['vegetable broth'],
        'vegetable broth': ['vegetable stock'],
        'beef stock': ['beef broth'],
        'beef broth': ['beef stock'],
        'shallot': ['onion'],
        'sour cream': ['greek yogurt'],
        'greek yogurt': ['sour cream'],
    }

    @staticmethod
    def _contains_word_boundary(haystack: str, needle: str) -> bool:
        """Whether `needle` appears in `haystack` as whole word(s), not as a
        substring fragment inside a longer word. Plain `in` would match
        "oat" inside "goat cheese" or "egg" inside "eggplant" — real,
        demonstrated false positives, not hypothetical ones."""
        if not needle:
            return False
        return re.search(r'\b' + re.escape(needle) + r'\b', haystack) is not None

    def _fuzzy_match_ingredient(
        self,
        ingredient_name: str,
        pantry_ingredients: Set[str]
    ) -> Optional[str]:
        """
        Fuzzy match ingredient against pantry items.

        Scraped ingredient lines pack multiple clauses into one string —
        comma-separated prep/alternatives ("sun-dried tomatoes, packed in
        oil"), and "X or Y" substitution pairs ("avocado oil or olive oil",
        where either alone should count as a match, but combined into one
        phrase they match neither). Splits on both and tries each fragment,
        plus the first comma-clause specifically (an ingredient's identity
        lives before its first comma; matching the full string instead lets
        a trailing word like "oil" become the head noun and mis-trigger the
        transformative-head rule against a word that isn't the ingredient),
        plus the whole line as a last resort (trailing clauses sometimes
        carry the usable name — "Hot sauce, preferably Sriracha").

        Returns:
            Matched pantry ingredient name or None
        """
        first_clause = ingredient_name.split(',', 1)[0]
        candidates = [first_clause]

        for clause in ingredient_name.split(','):
            for fragment in re.split(r'\bor\b', clause):
                fragment = fragment.strip()
                if fragment and fragment not in candidates:
                    candidates.append(fragment)

        if ingredient_name not in candidates:
            candidates.append(ingredient_name)

        for candidate in candidates:
            matched = self._fuzzy_match_normalized(
                self._normalize_ingredient_name(candidate), pantry_ingredients
            )
            if matched:
                return matched
        return None

    def _fuzzy_match_normalized(
        self,
        normalized_ingredient: str,
        pantry_ingredients: Set[str]
    ) -> Optional[str]:
        # Exact match
        if normalized_ingredient in pantry_ingredients:
            return normalized_ingredient

        ingredient_tokens = normalized_ingredient.split()
        ingredient_words = set(ingredient_tokens)
        ingredient_head = ingredient_tokens[-1] if ingredient_tokens else ''
        strict = len(ingredient_tokens) > 1 and ingredient_head in self._transformative_heads()

        if strict:
            # Transformative-head ingredient ("peanut butter", "chicken
            # broth"): the pantry item must cover the ingredient's core
            # identity — its last two tokens (head noun + the word right
            # before it, which is what actually changes the product:
            # "peanut" butter, "chicken" broth) — not the base word alone,
            # so pantry "butter" does not satisfy "peanut butter". Only the
            # core, not the WHOLE phrase: a recipe is typically more
            # descriptive than a pantry item ("Thai red curry paste" should
            # still satisfy a pantry item just called "Curry Paste" — "thai"
            # and "red" are variety/style words, not a different product,
            # unlike "peanut" in front of "butter").
            core = set(ingredient_tokens[-2:])
            for pantry_item in pantry_ingredients:
                pantry_words = set(pantry_item.split())
                if core <= pantry_words:
                    return pantry_item
            return None

        # Partial match (ingredient contains pantry item), word-boundary aware
        for pantry_item in pantry_ingredients:
            if self._contains_word_boundary(normalized_ingredient, pantry_item):
                return pantry_item

        # Reverse partial match (pantry item contains ingredient), word-boundary aware
        for pantry_item in pantry_ingredients:
            if self._contains_word_boundary(pantry_item, normalized_ingredient):
                return pantry_item

        # Word-set match: every word of the pantry item present in the
        # ingredient, in any order ("cheese, goat" vs "goat cheese"), AND
        # the ingredient's head noun covered by the pantry item. The old
        # rule — 50% of *ingredient* words overlapping — let "vegetable
        # oil" match a pantry item "olive oil" because they share "oil".
        for pantry_item in pantry_ingredients:
            pantry_words = set(pantry_item.split())
            if pantry_words and pantry_words <= ingredient_words and ingredient_head in pantry_words:
                return pantry_item

        return None

    def get_recipe_suggestions(
        self,
        user_id: str,
        min_match_percentage: float = 50.0,
        prioritize_expiring: bool = True,
        limit: int = 20
    ) -> List[Tuple[Recipe, Optional[UserRecipePreference]]]:
        """
        Get recipe suggestions based on pantry matches

        Args:
            user_id: User ID
            min_match_percentage: Minimum match % to include
            prioritize_expiring: Show recipes using expiring items first
            limit: Maximum recipes to return

        Returns:
            List of (Recipe, UserRecipePreference) tuples
        """
        # Join Recipe with UserRecipePreference for this user
        query = self.db.query(Recipe, UserRecipePreference).outerjoin(
            UserRecipePreference,
            (Recipe.id == UserRecipePreference.recipe_id) &
            (UserRecipePreference.user_id == user_id)
        ).filter(
            UserRecipePreference.match_percentage >= min_match_percentage
        )

        if prioritize_expiring:
            query = query.order_by(
                UserRecipePreference.uses_expiring_items.desc(),
                UserRecipePreference.match_percentage.desc()
            )
        else:
            query = query.order_by(UserRecipePreference.match_percentage.desc())

        return query.limit(limit).all()

    def get_recipes_using_expiring(
        self,
        user_id: str,
        limit: int = 10
    ) -> List[Tuple[Recipe, Optional[UserRecipePreference]]]:
        """
        Get recipes that use items expiring soon

        Returns:
            List of (Recipe, UserRecipePreference) tuples
        """
        return self.db.query(Recipe, UserRecipePreference).outerjoin(
            UserRecipePreference,
            (Recipe.id == UserRecipePreference.recipe_id) &
            (UserRecipePreference.user_id == user_id)
        ).filter(
            UserRecipePreference.uses_expiring_items == True
        ).order_by(
            UserRecipePreference.expiring_ingredient_count.desc(),
            UserRecipePreference.match_percentage.desc()
        ).limit(limit).all()

    def search_recipes(
        self,
        user_id: str,
        query: str,
        limit: int = 20
    ) -> List[Tuple[Recipe, Optional[UserRecipePreference]]]:
        """
        Search recipes by name, description, or ingredients (shared across household)

        Args:
            user_id: User ID (for preferences)
            query: Search query string
            limit: Maximum results

        Returns:
            List of (Recipe, UserRecipePreference) tuples
        """
        search_term = f"%{query.lower()}%"

        return self.db.query(Recipe, UserRecipePreference).outerjoin(
            UserRecipePreference,
            (Recipe.id == UserRecipePreference.recipe_id) &
            (UserRecipePreference.user_id == user_id)
        ).filter(
            (
                Recipe.name.ilike(search_term) |
                Recipe.description.ilike(search_term) |
                Recipe.cuisine.ilike(search_term)
            )
        ).order_by(
            UserRecipePreference.match_percentage.desc().nullslast()
        ).limit(limit).all()

    def get_favorites(self, user_id: str) -> List[Tuple[Recipe, UserRecipePreference]]:
        """Get user's favorite recipes (per-user preferences)"""
        return self.db.query(Recipe, UserRecipePreference).join(
            UserRecipePreference,
            (Recipe.id == UserRecipePreference.recipe_id) &
            (UserRecipePreference.user_id == user_id)
        ).filter(
            UserRecipePreference.favorite == True
        ).order_by(UserRecipePreference.updated_at.desc()).all()


def get_recipe_matcher(db: Session) -> RecipeMatcher:
    """Factory function for RecipeMatcher"""
    return RecipeMatcher(db=db)
