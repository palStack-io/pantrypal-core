"""
Local file storage service for PantryPal Open Source.

Routes and recipe importers use this interface to store images without S3.
Objects are stored under LOCAL_STORAGE_PATH, defaulting to /app/data/storage.
"""
from io import BytesIO
from pathlib import Path
from PIL import Image
import os
import httpx
from typing import Optional


class LocalStorageService:
    """Filesystem-backed storage service with the legacy storage interface."""

    def __init__(self):
        self.root = Path(os.getenv('LOCAL_STORAGE_PATH', '/app/data/storage')).resolve()
        self.bucket_products = 'products'
        self.bucket_users = 'users'
        self.bucket_recipes = 'recipes'
        self._ensure_buckets()

    def _ensure_buckets(self):
        for bucket in [
            self.bucket_products,
            self.bucket_users,
            self.bucket_recipes,
        ]:
            (self.root / bucket).mkdir(parents=True, exist_ok=True)

    def _path_for(self, bucket_name: str, object_name: str) -> Path:
        candidate = (self.root / bucket_name / object_name).resolve()
        bucket_root = (self.root / bucket_name).resolve()
        if not str(candidate).startswith(str(bucket_root)):
            raise ValueError("Invalid storage object path")
        return candidate

    def upload_product_image(self, barcode: str, image_data: bytes) -> str:
        processed = self._process_image(image_data, max_size=800)
        object_name = f"products/{barcode}.webp"
        self._write_object(self.bucket_products, object_name, processed)
        return object_name

    def upload_custom_image(self, user_id: str, item_id: str, image_data: bytes) -> str:
        processed = self._process_image(image_data, max_size=1024)
        object_name = f"{user_id}/items/{item_id}.webp"
        self._write_object(self.bucket_users, object_name, processed)
        return object_name

    def upload_recipe_image(self, user_id: str, recipe_id: str, image_data: bytes) -> str:
        processed = self._process_image(image_data, max_size=800)
        object_name = f"{user_id}/{recipe_id}.webp"
        self._write_object(self.bucket_recipes, object_name, processed)
        return object_name

    async def download_recipe_image_from_url(
        self,
        user_id: str,
        recipe_id: str,
        source_url: str,
        auth_headers: Optional[dict] = None
    ) -> Optional[str]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(source_url, headers=auth_headers or {})
                if response.status_code == 200:
                    return self.upload_recipe_image(
                        user_id=user_id,
                        recipe_id=recipe_id,
                        image_data=response.content
                    )
                print(f"Failed to download recipe image: HTTP {response.status_code}")
                return None
        except Exception as e:
            print(f"Error downloading recipe image from {source_url}: {e}")
            return None

    def get_public_url(self, bucket_name: str, object_name: str) -> str:
        return f"/api/images/file/{bucket_name}/{object_name}"

    def get_presigned_url(
        self,
        bucket_name: str,
        object_name: str,
        expires_seconds: int = 3600
    ) -> Optional[str]:
        if self.object_exists(bucket_name, object_name):
            return self.get_public_url(bucket_name, object_name)
        return None

    def get_object_bytes(self, bucket_name: str, object_name: str) -> bytes:
        path = self._path_for(bucket_name, object_name)
        return path.read_bytes()

    def delete_object(self, bucket_name: str, object_name: str) -> bool:
        try:
            path = self._path_for(bucket_name, object_name)
            if path.exists():
                path.unlink()
            return True
        except Exception as e:
            print(f"Error deleting object {bucket_name}/{object_name}: {e}")
            return False

    def object_exists(self, bucket_name: str, object_name: str) -> bool:
        try:
            return self._path_for(bucket_name, object_name).is_file()
        except Exception:
            return False

    def _write_object(self, bucket_name: str, object_name: str, data: bytes) -> None:
        path = self._path_for(bucket_name, object_name)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def _process_image(self, image_data: bytes, max_size: int = 1024) -> bytes:
        img = Image.open(BytesIO(image_data))
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            if img.mode in ('RGBA', 'LA'):
                background.paste(img, mask=img.split()[-1])
                img = background
        if max(img.size) > max_size:
            ratio = max_size / max(img.size)
            new_size = tuple(int(dim * ratio) for dim in img.size)
            img = img.resize(new_size, Image.LANCZOS)
        output = BytesIO()
        img.save(output, format='WEBP', quality=85, method=6)
        output.seek(0)
        return output.read()


_local_storage_service = None


def get_local_storage_service() -> LocalStorageService:
    """Get local storage service singleton."""
    global _local_storage_service
    if _local_storage_service is None:
        _local_storage_service = LocalStorageService()
    return _local_storage_service
