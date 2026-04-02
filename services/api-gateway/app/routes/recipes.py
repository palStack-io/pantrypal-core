"""
Recipe API Routes
Handles recipe management, import, search, and matching

Shared Household Model:
- Recipes are shared across all users (any user can view/delete)
- Integration configuration is admin-only (one per provider for the household)
- User preferences (favorites, notes, times_cooked) are per-user
- Recipe matching stores results in UserRecipePreference
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc
from typing import List, Optional
from pydantic import BaseModel
import httpx

from ..database import get_db
from ..models import User, Recipe, RecipeIntegration, UserRecipePreference
from ..auth import get_current_user, require_admin
from ..minio_service import get_minio_service, MinIOService
from ..recipe_import_service import get_recipe_import_service, RecipeImportService
from ..recipe_matcher import get_recipe_matcher, RecipeMatcher
from ..mealie_integration import MealieIntegration
from ..tandoor_integration import TandoorIntegration
from ..security import get_security_service


router = APIRouter(prefix="/api/recipes", tags=["recipes"])


# ============================================
# Pydantic Models
# ============================================

class RecipeIntegrationCreate(BaseModel):
    provider: str  # 'mealie' or 'tandoor'
    server_url: str
    api_token: str
    import_images: bool = True
    auto_sync: bool = False


class RecipeIntegrationUpdate(BaseModel):
    server_url: Optional[str] = None
    api_token: Optional[str] = None
    enabled: Optional[bool] = None
    import_images: Optional[bool] = None
    auto_sync: Optional[bool] = None


class RecipeImportRequest(BaseModel):
    limit: int = 500


class RecipeNotesUpdate(BaseModel):
    notes: str


class MatchRecipesRequest(BaseModel):
    expiring_days: int = 7


# ============================================
# Helper Functions
# ============================================

def get_user_preference(db: Session, user_id: str, recipe_id: str) -> Optional[UserRecipePreference]:
    """Get user's preference for a recipe, or None if not exists"""
    return db.query(UserRecipePreference).filter(
        UserRecipePreference.user_id == user_id,
        UserRecipePreference.recipe_id == recipe_id
    ).first()


def get_or_create_user_preference(db: Session, user_id: str, recipe_id: str) -> UserRecipePreference:
    """Get or create user's preference for a recipe"""
    pref = get_user_preference(db, user_id, recipe_id)
    if not pref:
        pref = UserRecipePreference(
            user_id=user_id,
            recipe_id=recipe_id
        )
        db.add(pref)
        db.flush()
    return pref


# ============================================
# Recipe Integration Endpoints (Admin Only for POST/DELETE)
# ============================================

@router.post("/integration")
async def create_recipe_integration(
    integration_data: RecipeIntegrationCreate,
    current_user: User = Depends(require_admin),  # Admin only
    db: Session = Depends(get_db)
):
    """
    Create or update recipe integration (Mealie/Tandoor)
    Admin only - one integration per provider for the household
    """
    # Validate provider
    if integration_data.provider not in ['mealie', 'tandoor']:
        raise HTTPException(status_code=400, detail="Provider must be 'mealie' or 'tandoor'")

    # Test connection first
    try:
        if integration_data.provider == 'mealie':
            integration = MealieIntegration(integration_data.server_url, integration_data.api_token)
            test_result = await integration.test_connection()
        else:  # tandoor
            integration = TandoorIntegration(integration_data.server_url, integration_data.api_token)
            test_result = await integration.test_connection()

        if not test_result.get('success'):
            raise HTTPException(
                status_code=400,
                detail=f"Failed to connect: {test_result.get('error', 'Unknown error')}"
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Connection test failed: {str(e)}")

    # Encrypt API token
    security = get_security_service()
    encrypted_token = security.encrypt_api_token(integration_data.api_token)

    # Check if integration for this provider already exists
    existing = db.query(RecipeIntegration).filter(
        RecipeIntegration.provider == integration_data.provider
    ).first()

    if existing:
        # Update existing
        existing.server_url = integration_data.server_url
        existing.api_token_encrypted = encrypted_token
        existing.import_images = integration_data.import_images
        existing.auto_sync = integration_data.auto_sync
        existing.enabled = True
        existing.configured_by_user_id = current_user.id
        db.commit()
        return {"success": True, "message": "Integration updated", "total_recipes": test_result.get('total_recipes', 0)}
    else:
        # Create new
        new_integration = RecipeIntegration(
            provider=integration_data.provider,
            server_url=integration_data.server_url,
            api_token_encrypted=encrypted_token,
            enabled=True,
            import_images=integration_data.import_images,
            auto_sync=integration_data.auto_sync,
            configured_by_user_id=current_user.id
        )
        db.add(new_integration)
        db.commit()
        return {"success": True, "message": "Integration created", "total_recipes": test_result.get('total_recipes', 0)}


@router.get("/integration")
async def get_recipe_integration(
    current_user: User = Depends(get_current_user),  # Any authenticated user can view
    db: Session = Depends(get_db)
):
    """
    Get current recipe integration settings
    Any authenticated user can view (read-only)
    """
    # Get all enabled integrations (there's one per provider)
    integrations = db.query(RecipeIntegration).filter(
        RecipeIntegration.enabled == True
    ).all()

    if not integrations:
        return {"configured": False, "integrations": []}

    # Return list of integrations (could be mealie and/or tandoor)
    integration_list = []
    for integration in integrations:
        integration_list.append({
            "provider": integration.provider,
            "server_url": integration.server_url,
            "enabled": integration.enabled,
            "import_images": integration.import_images,
            "auto_sync": integration.auto_sync,
            "last_sync": integration.last_sync.isoformat() if integration.last_sync else None,
            "total_recipes_imported": integration.total_recipes_imported
        })

    return {
        "configured": True,
        "integrations": integration_list,
        # For backwards compatibility, also return first integration's data at top level
        "provider": integrations[0].provider if integrations else None,
        "server_url": integrations[0].server_url if integrations else None,
        "enabled": integrations[0].enabled if integrations else False,
        "import_images": integrations[0].import_images if integrations else True,
        "auto_sync": integrations[0].auto_sync if integrations else False,
        "last_sync": integrations[0].last_sync.isoformat() if integrations and integrations[0].last_sync else None,
        "total_recipes_imported": integrations[0].total_recipes_imported if integrations else 0
    }


@router.delete("/integration")
async def delete_recipe_integration(
    provider: Optional[str] = Query(None, description="Provider to delete (mealie/tandoor). If not specified, deletes all."),
    current_user: User = Depends(require_admin),  # Admin only
    db: Session = Depends(get_db)
):
    """
    Delete recipe integration (keeps imported recipes)
    Admin only
    """
    if provider:
        # Delete specific provider
        integration = db.query(RecipeIntegration).filter(
            RecipeIntegration.provider == provider
        ).first()

        if not integration:
            raise HTTPException(status_code=404, detail=f"No {provider} integration configured")

        db.delete(integration)
    else:
        # Delete all integrations
        integrations = db.query(RecipeIntegration).all()
        if not integrations:
            raise HTTPException(status_code=404, detail="No integration configured")

        for integration in integrations:
            db.delete(integration)

    db.commit()
    return {"success": True, "message": "Integration deleted. Imported recipes remain."}


# ============================================
# Recipe Import Endpoints
# ============================================

@router.post("/import")
async def import_recipes(
    import_request: RecipeImportRequest,
    provider: Optional[str] = Query(None, description="Provider to import from (mealie/tandoor)"),
    current_user: User = Depends(get_current_user),  # Any user can import
    db: Session = Depends(get_db),
    minio: MinIOService = Depends(get_minio_service)
):
    """
    Import recipes from configured integration
    Any user can import - recipes become shared across household
    """
    # Get integration (optionally filtered by provider)
    query = db.query(RecipeIntegration).filter(RecipeIntegration.enabled == True)
    if provider:
        query = query.filter(RecipeIntegration.provider == provider)
    integration = query.first()

    if not integration:
        raise HTTPException(status_code=400, detail="No recipe integration configured")

    # Decrypt API token
    security = get_security_service()
    api_token = security.decrypt_api_token(integration.api_token_encrypted)

    # Import recipes
    import_service = get_recipe_import_service(db, minio)

    stats = await import_service.import_recipes(
        imported_by_user_id=current_user.id,  # Track who imported for audit
        provider=integration.provider,
        server_url=integration.server_url,
        api_token=api_token,
        import_images=integration.import_images,
        limit=import_request.limit
    )

    return {
        "success": True,
        "message": "Import completed",
        **stats
    }


# ============================================
# Recipe Query Endpoints
# ============================================

@router.get("/")
async def get_recipes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    sort_by: str = Query("match_percentage", regex="^(match_percentage|name|created_at|last_cooked)$"),
    order: str = Query("desc", regex="^(asc|desc)$"),
    favorite_only: bool = Query(False)
):
    """
    Get all shared recipes with pagination and sorting
    User preferences (favorites, match%) are per-user
    """
    # Query all recipes with LEFT JOIN to user preferences
    from sqlalchemy.orm import aliased

    # Build base query
    query = db.query(Recipe, UserRecipePreference).outerjoin(
        UserRecipePreference,
        (Recipe.id == UserRecipePreference.recipe_id) &
        (UserRecipePreference.user_id == current_user.id)
    )

    if favorite_only:
        query = query.filter(UserRecipePreference.favorite == True)

    # Apply sorting
    order_func = desc if order == "desc" else asc
    if sort_by == "match_percentage":
        query = query.order_by(order_func(UserRecipePreference.match_percentage))
    elif sort_by == "name":
        query = query.order_by(order_func(Recipe.name))
    elif sort_by == "created_at":
        query = query.order_by(order_func(Recipe.created_at))
    elif sort_by == "last_cooked":
        query = query.order_by(order_func(UserRecipePreference.last_cooked))

    # Get total count (without pagination)
    total = db.query(Recipe).count()
    if favorite_only:
        total = query.count()

    # Apply pagination
    results = query.offset(offset).limit(limit).all()

    # Convert to dict with user preferences
    recipes = []
    for recipe, user_pref in results:
        recipes.append(recipe.to_dict(user_prefs=user_pref))

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "recipes": recipes
    }


@router.get("/suggestions")
async def get_recipe_suggestions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    min_match: float = Query(50.0, ge=0, le=100),
    limit: int = Query(20, ge=1, le=100)
):
    """
    Get recipe suggestions based on pantry matches
    """
    matcher = get_recipe_matcher(db)
    results = matcher.get_recipe_suggestions(
        user_id=current_user.id,
        min_match_percentage=min_match,
        prioritize_expiring=True,
        limit=limit
    )

    return {
        "count": len(results),
        "recipes": [recipe.to_dict(user_prefs=pref) for recipe, pref in results]
    }


@router.get("/expiring")
async def get_recipes_using_expiring(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(10, ge=1, le=50)
):
    """
    Get recipes that use items expiring soon
    """
    matcher = get_recipe_matcher(db)
    results = matcher.get_recipes_using_expiring(
        user_id=current_user.id,
        limit=limit
    )

    return {
        "count": len(results),
        "recipes": [recipe.to_dict(user_prefs=pref) for recipe, pref in results]
    }


@router.get("/search")
async def search_recipes(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = Query(20, ge=1, le=100)
):
    """
    Search recipes by name, description, or cuisine
    """
    matcher = get_recipe_matcher(db)
    results = matcher.search_recipes(
        user_id=current_user.id,
        query=q,
        limit=limit
    )

    return {
        "query": q,
        "count": len(results),
        "recipes": [recipe.to_dict(user_prefs=pref) for recipe, pref in results]
    }


@router.get("/favorites")
async def get_favorite_recipes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get user's favorite recipes
    """
    matcher = get_recipe_matcher(db)
    results = matcher.get_favorites(user_id=current_user.id)

    return {
        "count": len(results),
        "recipes": [recipe.to_dict(user_prefs=pref) for recipe, pref in results]
    }


@router.get("/{recipe_id}")
async def get_recipe(
    recipe_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get single recipe by ID (shared recipe, with user's preferences)
    """
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()

    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Get user's preferences for this recipe
    user_pref = get_user_preference(db, current_user.id, recipe_id)

    return recipe.to_dict(user_prefs=user_pref)


# ============================================
# Recipe Matching Endpoints
# ============================================

@router.post("/match")
async def match_recipes_to_pantry(
    match_request: MatchRecipesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Calculate match percentages for all recipes based on current pantry
    Results stored in UserRecipePreference for the current user
    """
    import os
    inventory_url = os.getenv("INVENTORY_SERVICE_URL", "http://inventory-service:8001")

    # Fetch pantry items from inventory service
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{inventory_url}/items",
                headers={"X-User-ID": current_user.id}
            )
            response.raise_for_status()
            pantry_items = response.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch pantry: {str(e)}")

    # Run matcher
    matcher = get_recipe_matcher(db)
    stats = await matcher.calculate_matches(
        user_id=current_user.id,
        pantry_items=pantry_items,
        expiring_days=match_request.expiring_days
    )

    return {
        "success": True,
        "message": "Recipe matching completed",
        **stats
    }


# ============================================
# Recipe Management Endpoints
# ============================================

@router.patch("/{recipe_id}/notes")
async def update_recipe_notes(
    recipe_id: str,
    notes_update: RecipeNotesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update user's notes for a recipe (stored in UserRecipePreference)
    """
    # Verify recipe exists
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Get or create user preference
    pref = get_or_create_user_preference(db, current_user.id, recipe_id)
    pref.notes = notes_update.notes
    db.commit()

    return {"success": True, "message": "Notes updated"}


@router.post("/{recipe_id}/favorite")
async def toggle_favorite(
    recipe_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Toggle favorite status for a recipe (stored in UserRecipePreference)
    """
    # Verify recipe exists
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Get or create user preference
    pref = get_or_create_user_preference(db, current_user.id, recipe_id)
    pref.favorite = not (pref.favorite or False)
    db.commit()

    return {
        "success": True,
        "favorite": pref.favorite,
        "message": "Added to favorites" if pref.favorite else "Removed from favorites"
    }


@router.post("/{recipe_id}/cooked")
async def mark_cooked(
    recipe_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark recipe as cooked (stored in UserRecipePreference)
    """
    from datetime import datetime

    # Verify recipe exists
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Get or create user preference
    pref = get_or_create_user_preference(db, current_user.id, recipe_id)
    pref.times_cooked = (pref.times_cooked or 0) + 1
    pref.last_cooked = datetime.utcnow()
    db.commit()

    return {
        "success": True,
        "times_cooked": pref.times_cooked,
        "last_cooked": pref.last_cooked.isoformat()
    }


@router.delete("/{recipe_id}")
async def delete_recipe(
    recipe_id: str,
    current_user: User = Depends(get_current_user),  # Any user can delete shared recipes
    db: Session = Depends(get_db),
    minio: MinIOService = Depends(get_minio_service)
):
    """
    Delete a shared recipe and its image
    Any authenticated user can delete (collaborative household model)
    """
    import_service = get_recipe_import_service(db, minio)
    deleted = await import_service.delete_recipe(recipe_id=recipe_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Recipe not found")

    return {"success": True, "message": "Recipe deleted"}
