"""
Image API Routes
Handles serving images from MinIO storage

Shared Household Model:
- Recipe images are shared (anyone can view/upload for shared recipes)
- Custom user images remain per-user
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy.orm import Session
from typing import Optional

from ..database import get_db
from ..models import ProductImage, UserImage, RecipeImage, Recipe, User
from ..minio_service import get_minio_service, MinIOService
from ..auth import get_current_user

router = APIRouter(prefix="/api/images", tags=["images"])


@router.get("/product/{barcode}")
async def get_product_image(
    barcode: str,
    minio: MinIOService = Depends(get_minio_service),
    db: Session = Depends(get_db)
):
    """
    Get product image by barcode
    Public endpoint (no auth required)
    """
    # Find image record
    product_image = db.query(ProductImage).filter(
        ProductImage.barcode == barcode
    ).first()

    if not product_image:
        raise HTTPException(status_code=404, detail="Product image not found")

    # Get presigned URL from MinIO
    url = minio.get_presigned_url(
        bucket_name=product_image.bucket_name,
        object_name=product_image.object_name,
        expires_seconds=3600  # 1 hour
    )

    if not url:
        raise HTTPException(status_code=500, detail="Failed to generate image URL")

    # Update access tracking
    product_image.last_accessed = db.func.now()
    product_image.access_count += 1
    db.commit()

    return {"image_url": url}


@router.get("/custom/{item_id}")
async def get_custom_image(
    item_id: str,
    current_user: User = Depends(get_current_user),
    minio: MinIOService = Depends(get_minio_service),
    db: Session = Depends(get_db)
):
    """
    Get user's custom item image
    Requires authentication - per-user images
    """
    # Find image record
    user_image = db.query(UserImage).filter(
        UserImage.item_id == item_id,
        UserImage.user_id == current_user.id
    ).first()

    if not user_image:
        raise HTTPException(status_code=404, detail="Custom image not found")

    # Get presigned URL from MinIO
    url = minio.get_presigned_url(
        bucket_name=user_image.bucket_name,
        object_name=user_image.object_name,
        expires_seconds=3600
    )

    if not url:
        raise HTTPException(status_code=500, detail="Failed to generate image URL")

    return {"image_url": url}


@router.get("/recipe/{recipe_id}")
async def get_recipe_image(
    recipe_id: str,
    current_user: User = Depends(get_current_user),
    minio: MinIOService = Depends(get_minio_service),
    db: Session = Depends(get_db)
):
    """
    Get recipe image
    Requires authentication - any user can access shared recipe images
    """
    # Find image record (no user_id filter - shared recipes)
    recipe_image = db.query(RecipeImage).filter(
        RecipeImage.recipe_id == recipe_id
    ).first()

    if not recipe_image:
        raise HTTPException(status_code=404, detail="Recipe image not found")

    # Get presigned URL from MinIO
    url = minio.get_presigned_url(
        bucket_name=recipe_image.bucket_name,
        object_name=recipe_image.object_name,
        expires_seconds=3600
    )

    if not url:
        raise HTTPException(status_code=500, detail="Failed to generate image URL")

    return {"image_url": url}


@router.post("/upload/custom")
async def upload_custom_image(
    item_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    minio: MinIOService = Depends(get_minio_service),
    db: Session = Depends(get_db)
):
    """
    Upload custom image for an inventory item
    Requires authentication - per-user images
    """
    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Read file data
    image_data = await file.read()

    # Upload to MinIO
    try:
        object_name = minio.upload_custom_image(
            user_id=current_user.id,
            item_id=item_id,
            image_data=image_data
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {e}")

    # Check if image record exists
    existing_image = db.query(UserImage).filter(
        UserImage.user_id == current_user.id,
        UserImage.item_id == item_id
    ).first()

    if existing_image:
        # Update existing record
        existing_image.object_name = object_name
        existing_image.uploaded_at = db.func.now()
    else:
        # Create new record
        user_image = UserImage(
            user_id=current_user.id,
            item_id=item_id,
            bucket_name=minio.bucket_users,
            object_name=object_name,
            mime_type='image/webp'
        )
        db.add(user_image)

    db.commit()

    return {
        "success": True,
        "message": "Image uploaded successfully",
        "image_url": f"/api/images/custom/{item_id}"
    }


@router.post("/upload/recipe")
async def upload_recipe_image(
    recipe_id: str,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    minio: MinIOService = Depends(get_minio_service),
    db: Session = Depends(get_db)
):
    """
    Upload custom image for a shared recipe
    Requires authentication - any user can upload for shared recipes
    """
    # Verify recipe exists
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    # Validate file type
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")

    # Read file data
    image_data = await file.read()

    # Upload to MinIO (use "shared" as user_id for shared recipes)
    try:
        object_name = minio.upload_recipe_image(
            user_id="shared",
            recipe_id=recipe_id,
            image_data=image_data
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload image: {e}")

    # Check if image record exists (no user_id filter - shared recipes)
    existing_image = db.query(RecipeImage).filter(
        RecipeImage.recipe_id == recipe_id
    ).first()

    if existing_image:
        # Update existing record
        existing_image.object_name = object_name
        existing_image.downloaded_at = db.func.now()
        existing_image.source = 'upload'
    else:
        # Create new record (no user_id - shared with recipe)
        recipe_image = RecipeImage(
            recipe_id=recipe_id,
            bucket_name=minio.bucket_recipes,
            object_name=object_name,
            source='upload',
            mime_type='image/webp'
        )
        db.add(recipe_image)

    # Update recipe's image_url
    recipe.image_url = f"/api/images/recipe/{recipe_id}"
    db.commit()

    return {
        "success": True,
        "message": "Recipe image uploaded successfully",
        "image_url": f"/api/images/recipe/{recipe_id}"
    }


@router.delete("/custom/{item_id}")
async def delete_custom_image(
    item_id: str,
    current_user: User = Depends(get_current_user),
    minio: MinIOService = Depends(get_minio_service),
    db: Session = Depends(get_db)
):
    """
    Delete user's custom item image
    Requires authentication - per-user images
    """
    # Find image record
    user_image = db.query(UserImage).filter(
        UserImage.item_id == item_id,
        UserImage.user_id == current_user.id
    ).first()

    if not user_image:
        raise HTTPException(status_code=404, detail="Custom image not found")

    # Delete from MinIO
    deleted = minio.delete_object(
        bucket_name=user_image.bucket_name,
        object_name=user_image.object_name
    )

    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete image from storage")

    # Delete database record
    db.delete(user_image)
    db.commit()

    return {"success": True, "message": "Image deleted successfully"}


@router.delete("/recipe/{recipe_id}")
async def delete_recipe_image(
    recipe_id: str,
    current_user: User = Depends(get_current_user),
    minio: MinIOService = Depends(get_minio_service),
    db: Session = Depends(get_db)
):
    """
    Delete recipe image
    Requires authentication - any user can delete shared recipe images
    """
    # Find image record (no user_id filter - shared recipes)
    recipe_image = db.query(RecipeImage).filter(
        RecipeImage.recipe_id == recipe_id
    ).first()

    if not recipe_image:
        raise HTTPException(status_code=404, detail="Recipe image not found")

    # Delete from MinIO
    deleted = minio.delete_object(
        bucket_name=recipe_image.bucket_name,
        object_name=recipe_image.object_name
    )

    if not deleted:
        raise HTTPException(status_code=500, detail="Failed to delete image from storage")

    # Delete database record
    db.delete(recipe_image)

    # Update recipe to remove image_url reference
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if recipe:
        recipe.image_url = None

    db.commit()

    return {"success": True, "message": "Recipe image deleted successfully"}
