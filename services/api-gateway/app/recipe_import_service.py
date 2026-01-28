"""
Recipe Import Service
Handles bulk import of recipes from Mealie/Tandoor into PantryPal database
"""
from sqlalchemy.orm import Session
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import asyncio

from .models import Recipe, RecipeImage, RecipeIntegration, User
from .database import SessionLocal
from .minio_service import MinIOService
from .mealie_integration import MealieIntegration
from .tandoor_integration import TandoorIntegration


class RecipeImportService:
    """Service for importing recipes from external sources"""

    def __init__(self, db: Session, minio_service: MinIOService):
        self.db = db
        self.minio = minio_service

    async def import_recipes(
        self,
        user_id: str,
        provider: str,
        server_url: str,
        api_token: str,
        import_images: bool = True,
        limit: int = 500
    ) -> Dict:
        """
        Import recipes from Mealie or Tandoor

        Args:
            user_id: User importing recipes
            provider: 'mealie' or 'tandoor'
            server_url: Recipe manager server URL
            api_token: API token for authentication
            import_images: Whether to download and store images
            limit: Maximum recipes to import

        Returns:
            Statistics: imported, updated, failed counts
        """
        stats = {
            'total_fetched': 0,
            'imported': 0,
            'updated': 0,
            'failed': 0,
            'skipped': 0,
            'images_downloaded': 0,
            'errors': []
        }

        try:
            # Fetch recipes from provider
            if provider == 'mealie':
                integration = MealieIntegration(server_url, api_token)
                recipes = await integration.fetch_recipes(limit=limit)
            elif provider == 'tandoor':
                integration = TandoorIntegration(server_url, api_token)
                recipes = await integration.fetch_recipes(limit=limit)
            else:
                return {
                    **stats,
                    'failed': 1,
                    'errors': [f'Unknown provider: {provider}']
                }

            stats['total_fetched'] = len(recipes)

            # Import each recipe
            for recipe_data in recipes:
                try:
                    result = await self._import_recipe(
                        user_id=user_id,
                        recipe_data=recipe_data,
                        import_images=import_images
                    )

                    if result['status'] == 'imported':
                        stats['imported'] += 1
                    elif result['status'] == 'updated':
                        stats['updated'] += 1
                    elif result['status'] == 'skipped':
                        stats['skipped'] += 1

                    if result.get('image_downloaded'):
                        stats['images_downloaded'] += 1

                except Exception as e:
                    stats['failed'] += 1
                    stats['errors'].append({
                        'recipe': recipe_data.get('name', 'Unknown'),
                        'error': str(e)
                    })

            # Update integration record
            self._update_integration_stats(user_id, provider, stats)

            return stats

        except Exception as e:
            stats['failed'] = stats['total_fetched']
            stats['errors'].append({
                'general': str(e)
            })
            return stats

    async def _import_recipe(
        self,
        user_id: str,
        recipe_data: Dict,
        import_images: bool
    ) -> Dict:
        """
        Import a single recipe

        Returns:
            Dict with status and image_downloaded flag
        """
        result = {
            'status': 'skipped',
            'image_downloaded': False
        }

        # Check for existing recipe
        existing = self._find_existing_recipe(
            user_id=user_id,
            provider=recipe_data['provider'],
            external_id=recipe_data['external_id']
        )

        if existing:
            # Update existing recipe
            updated = self._update_recipe(existing, recipe_data)
            if updated:
                result['status'] = 'updated'
        else:
            # Create new recipe
            recipe = Recipe(
                user_id=user_id,
                external_provider=recipe_data['provider'],
                external_id=recipe_data['external_id'],
                external_url=recipe_data.get('source_url'),
                name=recipe_data['name'],
                description=recipe_data.get('description', ''),
                ingredients=recipe_data['ingredients'],
                instructions=recipe_data.get('instructions', []),
                prep_time=recipe_data.get('prep_time', 0),
                cook_time=recipe_data.get('cook_time', 0),
                total_time=recipe_data.get('total_time', 0),
                servings=recipe_data.get('servings', 4),
                difficulty=recipe_data.get('difficulty', 'Medium'),
                cuisine=recipe_data.get('cuisine', ''),
                tags=recipe_data.get('tags', []),
                category=recipe_data.get('category', []),
                imported_at=datetime.utcnow(),
                last_synced=datetime.utcnow()
            )

            self.db.add(recipe)
            self.db.flush()  # Get recipe ID

            # Download and store image if requested
            if import_images and recipe_data.get('image_url'):
                image_downloaded = await self._download_recipe_image(
                    user_id=user_id,
                    recipe_id=recipe.id,
                    source_url=recipe_data['image_url'],
                    provider=recipe_data['provider']
                )

                if image_downloaded:
                    result['image_downloaded'] = True
                    # Update recipe with API image URL
                    recipe.image_url = f"/api/images/recipe/{recipe.id}"

            self.db.commit()
            result['status'] = 'imported'

        return result

    def _update_recipe(self, recipe: Recipe, recipe_data: Dict) -> bool:
        """
        Update existing recipe with new data

        Returns:
            True if updated, False if no changes
        """
        updated = False

        # Update recipe data
        if recipe.name != recipe_data['name']:
            recipe.name = recipe_data['name']
            updated = True

        if recipe.description != recipe_data.get('description', ''):
            recipe.description = recipe_data.get('description', '')
            updated = True

        # Always update ingredients and instructions (they might have changed)
        recipe.ingredients = recipe_data['ingredients']
        recipe.instructions = recipe_data.get('instructions', [])
        updated = True

        # Update metadata
        recipe.prep_time = recipe_data.get('prep_time', 0)
        recipe.cook_time = recipe_data.get('cook_time', 0)
        recipe.total_time = recipe_data.get('total_time', 0)
        recipe.servings = recipe_data.get('servings', 4)
        recipe.tags = recipe_data.get('tags', [])
        recipe.category = recipe_data.get('category', [])

        if updated:
            recipe.last_synced = datetime.utcnow()
            recipe.updated_at = datetime.utcnow()
            self.db.commit()

        return updated

    def _find_existing_recipe(
        self,
        user_id: str,
        provider: str,
        external_id: str
    ) -> Optional[Recipe]:
        """
        Find existing recipe by user + provider + external_id
        """
        return self.db.query(Recipe).filter(
            Recipe.user_id == user_id,
            Recipe.external_provider == provider,
            Recipe.external_id == external_id
        ).first()

    async def _download_recipe_image(
        self,
        user_id: str,
        recipe_id: str,
        source_url: str,
        provider: str
    ) -> bool:
        """
        Download recipe image from Mealie/Tandoor and store in MinIO

        Returns:
            True if successful, False otherwise
        """
        try:
            # Download and upload to MinIO
            object_name = await self.minio.download_recipe_image_from_url(
                user_id=user_id,
                recipe_id=recipe_id,
                source_url=source_url
            )

            if not object_name:
                return False

            # Check if image record already exists
            existing_image = self.db.query(RecipeImage).filter(
                RecipeImage.recipe_id == recipe_id
            ).first()

            if existing_image:
                # Update existing record
                existing_image.object_name = object_name
                existing_image.source = provider
                existing_image.original_url = source_url
                existing_image.downloaded_at = datetime.utcnow()
            else:
                # Create new image record
                recipe_image = RecipeImage(
                    recipe_id=recipe_id,
                    user_id=user_id,
                    bucket_name=self.minio.bucket_recipes,
                    object_name=object_name,
                    source=provider,
                    original_url=source_url,
                    mime_type='image/webp',
                    downloaded_at=datetime.utcnow()
                )
                self.db.add(recipe_image)

            self.db.commit()
            return True

        except Exception as e:
            print(f"Failed to download recipe image from {source_url}: {e}")
            return False

    def _update_integration_stats(
        self,
        user_id: str,
        provider: str,
        stats: Dict
    ):
        """Update RecipeIntegration record with import statistics"""
        integration = self.db.query(RecipeIntegration).filter(
            RecipeIntegration.user_id == user_id,
            RecipeIntegration.provider == provider
        ).first()

        if integration:
            integration.last_sync = datetime.utcnow()
            integration.total_recipes_imported = stats['imported'] + stats['updated']
            self.db.commit()

    async def delete_recipe(self, user_id: str, recipe_id: str) -> bool:
        """
        Delete a recipe and its associated image

        Returns:
            True if deleted, False if not found
        """
        recipe = self.db.query(Recipe).filter(
            Recipe.id == recipe_id,
            Recipe.user_id == user_id
        ).first()

        if not recipe:
            return False

        # Delete image from MinIO
        recipe_image = self.db.query(RecipeImage).filter(
            RecipeImage.recipe_id == recipe_id
        ).first()

        if recipe_image:
            self.minio.delete_object(
                bucket_name=recipe_image.bucket_name,
                object_name=recipe_image.object_name
            )

        # Delete recipe (cascade will delete image record)
        self.db.delete(recipe)
        self.db.commit()

        return True

    def update_recipe_notes(
        self,
        user_id: str,
        recipe_id: str,
        notes: str
    ) -> Optional[Recipe]:
        """Update user notes for a recipe"""
        recipe = self.db.query(Recipe).filter(
            Recipe.id == recipe_id,
            Recipe.user_id == user_id
        ).first()

        if recipe:
            recipe.notes = notes
            recipe.updated_at = datetime.utcnow()
            self.db.commit()

        return recipe

    def toggle_favorite(
        self,
        user_id: str,
        recipe_id: str
    ) -> Optional[bool]:
        """
        Toggle favorite status for a recipe

        Returns:
            New favorite status, or None if recipe not found
        """
        recipe = self.db.query(Recipe).filter(
            Recipe.id == recipe_id,
            Recipe.user_id == user_id
        ).first()

        if recipe:
            recipe.favorite = not recipe.favorite
            recipe.updated_at = datetime.utcnow()
            self.db.commit()
            return recipe.favorite

        return None

    def mark_cooked(self, user_id: str, recipe_id: str) -> Optional[Recipe]:
        """Mark a recipe as cooked (increment counter)"""
        recipe = self.db.query(Recipe).filter(
            Recipe.id == recipe_id,
            Recipe.user_id == user_id
        ).first()

        if recipe:
            recipe.times_cooked += 1
            recipe.last_cooked = datetime.utcnow()
            recipe.updated_at = datetime.utcnow()
            self.db.commit()

        return recipe


def get_recipe_import_service(db: Session, minio_service: MinIOService) -> RecipeImportService:
    """Factory function for RecipeImportService"""
    return RecipeImportService(db=db, minio_service=minio_service)
