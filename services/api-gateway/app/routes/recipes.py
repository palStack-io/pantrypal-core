"""
Recipe API Routes
Handles recipe management, import, search, and matching
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import httpx

from ..database import get_db
from ..models import User, Recipe, RecipeIntegration
from ..auth import get_current_user
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
# Recipe Integration Endpoints
# ============================================

@router.post("/integration")
async def create_recipe_integration(
    integration_data: RecipeIntegrationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create or update recipe integration (Mealie/Tandoor)
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

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Connection test failed: {str(e)}")

    # Encrypt API token
    security = get_security_service()
    encrypted_token = security.encrypt_api_token(integration_data.api_token)

    # Check if integration already exists
    existing = db.query(RecipeIntegration).filter(
        RecipeIntegration.user_id == current_user.id
    ).first()

    if existing:
        # Update existing
        existing.provider = integration_data.provider
        existing.server_url = integration_data.server_url
        existing.api_token_encrypted = encrypted_token
        existing.import_images = integration_data.import_images
        existing.auto_sync = integration_data.auto_sync
        existing.enabled = True
        db.commit()
        return {"success": True, "message": "Integration updated", "total_recipes": test_result.get('total_recipes', 0)}
    else:
        # Create new
        new_integration = RecipeIntegration(
            user_id=current_user.id,
            provider=integration_data.provider,
            server_url=integration_data.server_url,
            api_token_encrypted=encrypted_token,
            enabled=True,
            import_images=integration_data.import_images,
            auto_sync=integration_data.auto_sync
        )
        db.add(new_integration)
        db.commit()
        return {"success": True, "message": "Integration created", "total_recipes": test_result.get('total_recipes', 0)}


@router.get("/integration")
async def get_recipe_integration(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current recipe integration settings
    """
    integration = db.query(RecipeIntegration).filter(
        RecipeIntegration.user_id == current_user.id
    ).first()

    if not integration:
        return {"configured": False}

    return {
        "configured": True,
        "provider": integration.provider,
        "server_url": integration.server_url,
        "enabled": integration.enabled,
        "import_images": integration.import_images,
        "auto_sync": integration.auto_sync,
        "last_sync": integration.last_sync.isoformat() if integration.last_sync else None,
        "total_recipes_imported": integration.total_recipes_imported
    }


@router.delete("/integration")
async def delete_recipe_integration(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete recipe integration (keeps imported recipes)
    """
    integration = db.query(RecipeIntegration).filter(
        RecipeIntegration.user_id == current_user.id
    ).first()

    if not integration:
        raise HTTPException(status_code=404, detail="No integration configured")

    db.delete(integration)
    db.commit()

    return {"success": True, "message": "Integration deleted. Imported recipes remain."}


# ============================================
# Recipe Import Endpoints
# ============================================

@router.post("/import")
async def import_recipes(
    import_request: RecipeImportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    minio: MinIOService = Depends(get_minio_service)
):
    """
    Import recipes from configured integration
    """
    # Get integration
    integration = db.query(RecipeIntegration).filter(
        RecipeIntegration.user_id == current_user.id,
        RecipeIntegration.enabled == True
    ).first()

    if not integration:
        raise HTTPException(status_code=400, detail="No recipe integration configured")

    # Decrypt API token
    security = get_security_service()
    api_token = security.decrypt_api_token(integration.api_token_encrypted)

    # Import recipes
    import_service = get_recipe_import_service(db, minio)

    stats = await import_service.import_recipes(
        user_id=current_user.id,
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
    Get user's recipes with pagination and sorting
    """
    query = db.query(Recipe).filter(Recipe.user_id == current_user.id)

    if favorite_only:
        query = query.filter(Recipe.favorite == True)

    # Apply sorting
    if sort_by == "match_percentage":
        query = query.order_by(Recipe.match_percentage.desc() if order == "desc" else Recipe.match_percentage.asc())
    elif sort_by == "name":
        query = query.order_by(Recipe.name.desc() if order == "desc" else Recipe.name.asc())
    elif sort_by == "created_at":
        query = query.order_by(Recipe.created_at.desc() if order == "desc" else Recipe.created_at.asc())
    elif sort_by == "last_cooked":
        query = query.order_by(Recipe.last_cooked.desc() if order == "desc" else Recipe.last_cooked.asc())

    total = query.count()
    recipes = query.offset(offset).limit(limit).all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "recipes": [recipe.to_dict() for recipe in recipes]
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
    recipes = matcher.get_recipe_suggestions(
        user_id=current_user.id,
        min_match_percentage=min_match,
        prioritize_expiring=True,
        limit=limit
    )

    return {
        "count": len(recipes),
        "recipes": [recipe.to_dict() for recipe in recipes]
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
    recipes = matcher.get_recipes_using_expiring(
        user_id=current_user.id,
        limit=limit
    )

    return {
        "count": len(recipes),
        "recipes": [recipe.to_dict() for recipe in recipes]
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
    recipes = matcher.search_recipes(
        user_id=current_user.id,
        query=q,
        limit=limit
    )

    return {
        "query": q,
        "count": len(recipes),
        "recipes": [recipe.to_dict() for recipe in recipes]
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
    recipes = matcher.get_favorites(user_id=current_user.id)

    return {
        "count": len(recipes),
        "recipes": [recipe.to_dict() for recipe in recipes]
    }


@router.get("/{recipe_id}")
async def get_recipe(
    recipe_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get single recipe by ID
    """
    recipe = db.query(Recipe).filter(
        Recipe.id == recipe_id,
        Recipe.user_id == current_user.id
    ).first()

    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    return recipe.to_dict()


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
    db: Session = Depends(get_db),
    minio: MinIOService = Depends(get_minio_service)
):
    """
    Update recipe notes
    """
    import_service = get_recipe_import_service(db, minio)
    recipe = import_service.update_recipe_notes(
        user_id=current_user.id,
        recipe_id=recipe_id,
        notes=notes_update.notes
    )

    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    return {"success": True, "message": "Notes updated"}


@router.post("/{recipe_id}/favorite")
async def toggle_favorite(
    recipe_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    minio: MinIOService = Depends(get_minio_service)
):
    """
    Toggle favorite status for a recipe
    """
    import_service = get_recipe_import_service(db, minio)
    new_status = import_service.toggle_favorite(
        user_id=current_user.id,
        recipe_id=recipe_id
    )

    if new_status is None:
        raise HTTPException(status_code=404, detail="Recipe not found")

    return {
        "success": True,
        "favorite": new_status,
        "message": "Added to favorites" if new_status else "Removed from favorites"
    }


@router.post("/{recipe_id}/cooked")
async def mark_cooked(
    recipe_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    minio: MinIOService = Depends(get_minio_service)
):
    """
    Mark recipe as cooked (increment counter)
    """
    import_service = get_recipe_import_service(db, minio)
    recipe = import_service.mark_cooked(
        user_id=current_user.id,
        recipe_id=recipe_id
    )

    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    return {
        "success": True,
        "times_cooked": recipe.times_cooked,
        "last_cooked": recipe.last_cooked.isoformat()
    }


@router.delete("/{recipe_id}")
async def delete_recipe(
    recipe_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    minio: MinIOService = Depends(get_minio_service)
):
    """
    Delete a recipe and its image
    """
    import_service = get_recipe_import_service(db, minio)
    deleted = await import_service.delete_recipe(
        user_id=current_user.id,
        recipe_id=recipe_id
    )

    if not deleted:
        raise HTTPException(status_code=404, detail="Recipe not found")

    return {"success": True, "message": "Recipe deleted"}
