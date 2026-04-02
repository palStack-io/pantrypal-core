"""
Mealie Recipe Manager Integration
Fetches recipes from Mealie with structured ingredients (no parsing needed!)
"""
import httpx
from typing import List, Dict, Optional
from datetime import datetime
import re


class MealieIntegration:
    """Integration with Mealie recipe manager"""

    def __init__(self, server_url: str, api_token: str):
        self.server_url = server_url.rstrip('/')
        self.api_token = api_token
        self.headers = {
            'Authorization': f'Bearer {api_token}',
            'Accept': 'application/json'
        }

    async def test_connection(self) -> dict:
        """Test connection to Mealie"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.server_url}/api/recipes",
                    headers=self.headers,
                    params={'perPage': 1}
                )
                response.raise_for_status()
                data = response.json()

                return {
                    'success': True,
                    'total_recipes': data.get('total', 0),
                    'provider': 'mealie'
                }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'provider': 'mealie'
            }

    async def fetch_recipe_by_slug(self, slug: str) -> Optional[Dict]:
        """Fetch a single recipe by slug/ID with full details"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.server_url}/api/recipes/{slug}",
                    headers=self.headers
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            print(f"Error fetching recipe {slug}: {e}")
            return None

    async def fetch_recipes(self, limit: int = 500) -> List[Dict]:
        """
        Fetch all recipes from Mealie with full details
        Mealie returns structured ingredients - no parsing needed!
        """
        all_recipes = []
        page = 1
        per_page = 50  # Fetch in batches

        async with httpx.AsyncClient(timeout=30.0) as client:
            while len(all_recipes) < limit:
                try:
                    response = await client.get(
                        f"{self.server_url}/api/recipes",
                        headers=self.headers,
                        params={
                            'page': page,
                            'perPage': per_page,
                            'orderBy': 'created_at',
                            'orderDirection': 'desc'
                        }
                    )
                    response.raise_for_status()
                    data = response.json()

                    recipe_summaries = data.get('items', [])
                    if not recipe_summaries:
                        break

                    # Fetch full details for each recipe
                    for summary in recipe_summaries:
                        if len(all_recipes) >= limit:
                            break

                        slug = summary.get('slug') or summary.get('id')
                        if slug:
                            full_recipe = await self.fetch_recipe_by_slug(slug)
                            if full_recipe:
                                all_recipes.append(full_recipe)

                    # Check if we've fetched all
                    if len(all_recipes) >= data.get('total', 0):
                        break

                    page += 1

                except Exception as e:
                    print(f"Error fetching Mealie recipes page {page}: {e}")
                    break

        return self._normalize_recipes(all_recipes[:limit])

    def _normalize_recipes(self, recipes: List[Dict]) -> List[Dict]:
        """
        Convert Mealie format to pantryPal standard format

        Mealie provides STRUCTURED ingredients:
        - recipeIngredient[].quantity (number)
        - recipeIngredient[].unit.name (string)
        - recipeIngredient[].food.name (string)
        """
        normalized = []

        for recipe in recipes:
            # Extract ingredients - handle both structured and unstructured formats
            ingredients = []
            for ing in recipe.get('recipeIngredient', []):
                # Skip if it's explicitly a section header (title exists, isFood explicitly False with no display)
                if ing.get('title') and ing.get('isFood') == False and not ing.get('display'):
                    continue

                # Get ingredient components
                food = ing.get('food', {})
                food_name = food.get('name', '') if food else ''
                unit = ing.get('unit', {})
                unit_name = unit.get('name', '') if unit else ''

                # Determine ingredient name:
                # 1. Try structured food.name (if available)
                # 2. Fall back to display (full text)
                # 3. Fall back to note
                ingredient_name = food_name or ing.get('display', '') or ing.get('note', '')

                if ingredient_name:
                    ingredients.append({
                        'name': ingredient_name,
                        'quantity': ing.get('quantity', 0),
                        'unit': unit_name,
                        'display': ing.get('display', ''),
                        'note': ing.get('note', '')
                    })

            # Parse times
            total_time = self._parse_time(recipe.get('totalTime', ''))

            # Get image URL
            image_url = None
            if recipe.get('id'):
                # Mealie image URL pattern
                image_url = f"{self.server_url}/api/media/recipes/{recipe['id']}/images/original.webp"

            # Parse instructions
            instructions = []
            for idx, step in enumerate(recipe.get('recipeInstructions', []), 1):
                if isinstance(step, dict):
                    instructions.append({
                        'step': idx,
                        'text': step.get('text', ''),
                        'title': step.get('title', '')
                    })
                elif isinstance(step, str):
                    instructions.append({
                        'step': idx,
                        'text': step,
                        'title': ''
                    })

            normalized.append({
                'external_id': recipe.get('slug', recipe.get('id', '')),
                'provider': 'mealie',
                'name': recipe.get('name', ''),
                'description': recipe.get('description', ''),
                'ingredients': ingredients,
                'instructions': instructions,
                'prep_time': self._parse_time(recipe.get('prepTime', '')),
                'cook_time': self._parse_time(recipe.get('cookTime', '')),
                'total_time': total_time,
                'servings': self._parse_servings(recipe.get('recipeYield', '4')),
                'difficulty': 'Medium',  # Extract from extras if available
                'cuisine': recipe.get('recipeCuisine', ''),
                'image_url': image_url,
                'source_url': recipe.get('orgURL', ''),
                'tags': [tag.get('name', tag) if isinstance(tag, dict) else tag for tag in recipe.get('tags', [])],
                'category': recipe.get('recipeCategory', []) if isinstance(recipe.get('recipeCategory'), list) else [recipe.get('recipeCategory', '')],
            })

        return normalized

    def _parse_time(self, time_str: str) -> int:
        """
        Parse Mealie time format to minutes
        Handles: "25 min", "PT25M" (ISO 8601), "1h 30m"
        """
        if not time_str:
            return 0

        # ISO 8601 format (PT25M, PT1H30M)
        if 'PT' in time_str.upper():
            hours = re.search(r'(\d+)H', time_str, re.IGNORECASE)
            minutes = re.search(r'(\d+)M', time_str, re.IGNORECASE)
            total = 0
            if hours:
                total += int(hours.group(1)) * 60
            if minutes:
                total += int(minutes.group(1))
            return total

        # Simple format ("25 min", "1 hour 30 minutes")
        total = 0
        hours = re.search(r'(\d+)\s*h(?:our)?', time_str, re.IGNORECASE)
        minutes = re.search(r'(\d+)\s*m(?:in)?', time_str, re.IGNORECASE)

        if hours:
            total += int(hours.group(1)) * 60
        if minutes:
            total += int(minutes.group(1))

        # If no explicit time found, try to extract first number
        if total == 0:
            match = re.search(r'(\d+)', time_str)
            if match:
                total = int(match.group(1))

        return total

    def _parse_servings(self, yield_str: str) -> int:
        """Extract serving count from string"""
        if not yield_str:
            return 4

        match = re.search(r'(\d+)', str(yield_str))
        return int(match.group(1)) if match else 4
