"""
Tandoor Recipe Manager Integration
Fetches recipes from Tandoor with structured ingredients in nested steps
"""
import httpx
from typing import List, Dict, Optional
from datetime import datetime


class TandoorIntegration:
    """Integration with Tandoor recipe manager"""

    def __init__(self, server_url: str, api_token: str):
        self.server_url = server_url.rstrip('/')
        self.api_token = api_token
        self.headers = {
            'Authorization': f'Bearer {api_token}',
            'Accept': 'application/json'
        }

    async def test_connection(self) -> dict:
        """Test connection to Tandoor"""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(
                    f"{self.server_url}/api/recipe/",
                    headers=self.headers,
                    params={'limit': 1}
                )
                response.raise_for_status()
                data = response.json()

                # Tandoor returns count in response
                count = data.get('count', len(data) if isinstance(data, list) else 0)

                return {
                    'success': True,
                    'total_recipes': count,
                    'provider': 'tandoor'
                }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'provider': 'tandoor'
            }

    async def fetch_recipes(self, limit: int = 500) -> List[Dict]:
        """
        Fetch recipes from Tandoor
        Tandoor returns structured ingredients in nested steps
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    f"{self.server_url}/api/recipe/",
                    headers=self.headers,
                    params={'limit': limit}
                )
                response.raise_for_status()
                data = response.json()

                # Handle both list and paginated responses
                recipes = data if isinstance(data, list) else data.get('results', [])

            return self._normalize_recipes(recipes)

        except Exception as e:
            print(f"Error fetching Tandoor recipes: {e}")
            return []

    def _normalize_recipes(self, recipes: List[Dict]) -> List[Dict]:
        """
        Convert Tandoor format to pantryPal standard

        Tandoor provides STRUCTURED ingredients in steps:
        - steps[].ingredients[].food.name
        - steps[].ingredients[].unit.name
        - steps[].ingredients[].amount
        """
        normalized = []

        for recipe in recipes:
            # Extract ingredients from Tandoor's nested structure
            ingredients = []
            seen_foods = set()  # Avoid duplicates

            for step in recipe.get('steps', []):
                for ing in step.get('ingredients', []):
                    food = ing.get('food', {})
                    food_name = food.get('name', '')

                    # Skip if already added (Tandoor can repeat ingredients)
                    if food_name and food_name not in seen_foods:
                        seen_foods.add(food_name)

                        unit = ing.get('unit', {})
                        unit_name = unit.get('name', '') if unit else ''
                        amount = ing.get('amount', 0)

                        # Build display string
                        display_parts = []
                        if amount:
                            display_parts.append(str(amount))
                        if unit_name:
                            display_parts.append(unit_name)
                        display_parts.append(food_name)
                        display = ' '.join(display_parts).strip()

                        ingredients.append({
                            'name': food_name,
                            'quantity': amount,
                            'unit': unit_name,
                            'display': display,
                            'note': ''
                        })

            # Get image URL
            image_url = None
            if recipe.get('image'):
                image_url = f"{self.server_url}/media/{recipe['image']}"

            # Extract keywords as tags
            tags = []
            for kw in recipe.get('keywords', []):
                if isinstance(kw, dict):
                    tags.append(kw.get('name', ''))
                else:
                    tags.append(str(kw))

            normalized.append({
                'external_id': str(recipe.get('id', '')),
                'provider': 'tandoor',
                'name': recipe.get('name', ''),
                'description': recipe.get('description', ''),
                'ingredients': ingredients,
                'instructions': self._extract_instructions(recipe.get('steps', [])),
                'prep_time': recipe.get('working_time', 0),
                'cook_time': recipe.get('waiting_time', 0),
                'total_time': recipe.get('working_time', 0) + recipe.get('waiting_time', 0),
                'servings': recipe.get('servings', 4),
                'difficulty': 'Medium',
                'cuisine': '',
                'image_url': image_url,
                'source_url': recipe.get('url', ''),
                'tags': tags,
                'category': [],
            })

        return normalized

    def _extract_instructions(self, steps: List[Dict]) -> List[Dict]:
        """Extract instructions from Tandoor steps"""
        instructions = []
        for idx, step in enumerate(steps, 1):
            instruction_text = step.get('instruction', '')
            step_name = step.get('name', '')

            if instruction_text:
                instructions.append({
                    'step': idx,
                    'text': instruction_text,
                    'title': step_name
                })

        return instructions
