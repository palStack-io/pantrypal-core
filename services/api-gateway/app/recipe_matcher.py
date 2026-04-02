"""
Recipe Matcher Service
Matches recipes against user's pantry inventory
Calculates match percentages and identifies expiring items

Shared Household Model:
- Recipes are shared across all users
- Match results stored in UserRecipePreference (per-user)
- Query methods return (Recipe, UserRecipePreference) tuples
"""
from sqlalchemy.orm import Session
from typing import List, Dict, Optional, Set, Tuple
from datetime import datetime, timedelta
from decimal import Decimal
import re

from .models import Recipe, UserRecipePreference


class RecipeMatcher:
    """Service for matching recipes to pantry inventory"""

    def __init__(self, db: Session):
        self.db = db

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
        Calculate match percentages for all recipes (shared across household)
        Stores results in UserRecipePreference for the specific user

        Args:
            user_id: User ID (for storing preferences)
            pantry_items: List of pantry items from inventory service
            expiring_days: Days threshold for expiring items

        Returns:
            Statistics about matching
        """
        # Get all recipes (shared across household - no user_id filter)
        recipes = self.db.query(Recipe).all()

        # Prepare pantry data
        pantry_ingredients = self._normalize_pantry_items(pantry_items)
        expiring_soon = self._get_expiring_items(pantry_items, expiring_days)

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
                pantry_ingredients=pantry_ingredients,
                expiring_items=expiring_soon
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
        pantry_ingredients: Set[str],
        expiring_items: Set[str]
    ) -> Dict:
        """
        Match a single recipe against pantry

        Returns:
            Dict with match_percentage, available, missing, expiring counts
        """
        recipe_ingredients = recipe.ingredients or []

        total_ingredients = len(recipe_ingredients)
        if total_ingredients == 0:
            return {
                'match_percentage': 0,
                'available_count': 0,
                'missing_count': 0,
                'expiring_count': 0,
                'missing_ingredients': [],
                'expiring_ingredients': [],
                'uses_expiring_items': False
            }

        available_count = 0
        missing_ingredients = []
        expiring_ingredients = []

        for ingredient in recipe_ingredients:
            ingredient_name = ingredient.get('name', '').lower()

            # Fuzzy match against pantry
            matched = self._fuzzy_match_ingredient(
                ingredient_name,
                pantry_ingredients
            )

            if matched:
                available_count += 1

                # Check if expiring soon
                if matched in expiring_items:
                    expiring_ingredients.append({
                        'name': ingredient.get('name'),
                        'quantity': ingredient.get('quantity'),
                        'unit': ingredient.get('unit')
                    })
            else:
                missing_ingredients.append({
                    'name': ingredient.get('name'),
                    'quantity': ingredient.get('quantity'),
                    'unit': ingredient.get('unit')
                })

        match_percentage = (available_count / total_ingredients) * 100

        return {
            'match_percentage': round(match_percentage, 2),
            'available_count': available_count,
            'missing_count': len(missing_ingredients),
            'expiring_count': len(expiring_ingredients),
            'missing_ingredients': missing_ingredients,
            'expiring_ingredients': expiring_ingredients,
            'uses_expiring_items': len(expiring_ingredients) > 0
        }

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

    def _normalize_ingredient_name(self, name: str) -> str:
        """
        Normalize ingredient name for matching

        Examples:
            "Fresh Tomatoes" -> "tomato"
            "Whole Milk (2%)" -> "milk"
            "Extra Virgin Olive Oil" -> "olive oil"
        """
        # Lowercase
        normalized = name.lower().strip()

        # Remove brand/descriptor words
        remove_words = [
            'fresh', 'organic', 'whole', 'extra', 'virgin', 'raw',
            'free-range', 'grass-fed', 'wild-caught', 'canned', 'dried',
            'frozen', 'chopped', 'sliced', 'diced', 'minced', 'crushed',
            'unsalted', 'salted', 'sweetened', 'unsweetened', 'low-fat',
            'fat-free', 'reduced', 'light', 'heavy', 'pure', 'natural'
        ]

        for word in remove_words:
            normalized = re.sub(rf'\b{word}\b', '', normalized)

        # Remove parentheses content
        normalized = re.sub(r'\([^)]*\)', '', normalized)

        # Remove extra whitespace
        normalized = ' '.join(normalized.split())

        # Singularize (simple approach)
        if normalized.endswith('ies'):
            normalized = normalized[:-3] + 'y'
        elif normalized.endswith('es'):
            normalized = normalized[:-2]
        elif normalized.endswith('s') and len(normalized) > 3:
            normalized = normalized[:-1]

        return normalized.strip()

    def _fuzzy_match_ingredient(
        self,
        ingredient_name: str,
        pantry_ingredients: Set[str]
    ) -> Optional[str]:
        """
        Fuzzy match ingredient against pantry items

        Returns:
            Matched pantry ingredient name or None
        """
        normalized_ingredient = self._normalize_ingredient_name(ingredient_name)

        # Exact match
        if normalized_ingredient in pantry_ingredients:
            return normalized_ingredient

        # Partial match (ingredient contains pantry item)
        for pantry_item in pantry_ingredients:
            if pantry_item in normalized_ingredient:
                return pantry_item

        # Reverse partial match (pantry item contains ingredient)
        for pantry_item in pantry_ingredients:
            if normalized_ingredient in pantry_item:
                return pantry_item

        # Word overlap match
        ingredient_words = set(normalized_ingredient.split())
        for pantry_item in pantry_ingredients:
            pantry_words = set(pantry_item.split())

            # If 50%+ words match, consider it a match
            if len(ingredient_words) > 0:
                overlap = len(ingredient_words & pantry_words)
                if overlap / len(ingredient_words) >= 0.5:
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
