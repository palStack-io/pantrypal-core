"""
MinIO Object Storage Service for PantryPal
Handles image storage for products, users, receipts, and recipes
"""
from minio import Minio
from minio.error import S3Error
from datetime import timedelta
from io import BytesIO
from PIL import Image
import os
import json
import httpx
from typing import Optional


class MinIOService:
    """MinIO object storage service for pantryPal"""

    def __init__(self):
        self.client = Minio(
            endpoint=os.getenv('MINIO_ENDPOINT', 'minio:9000'),
            access_key=os.getenv('MINIO_ACCESS_KEY', 'minioadmin'),
            secret_key=os.getenv('MINIO_SECRET_KEY', 'minioadmin123'),
            secure=os.getenv('MINIO_SECURE', 'false').lower() == 'true'
        )

        # Bucket names from environment
        self.bucket_products = os.getenv('MINIO_BUCKET_PRODUCTS', 'pantrypal-products')
        self.bucket_users = os.getenv('MINIO_BUCKET_USERS', 'pantrypal-users')
        self.bucket_receipts = os.getenv('MINIO_BUCKET_RECEIPTS', 'pantrypal-receipts')
        self.bucket_recipes = os.getenv('MINIO_BUCKET_RECIPES', 'pantrypal-recipes')

        # Initialize buckets
        self._ensure_buckets()

    def _ensure_buckets(self):
        """Create buckets if they don't exist"""
        buckets = [
            self.bucket_products,
            self.bucket_users,
            self.bucket_receipts,
            self.bucket_recipes
        ]

        for bucket in buckets:
            try:
                if not self.client.bucket_exists(bucket):
                    self.client.make_bucket(bucket)
                    print(f"✓ Created MinIO bucket: {bucket}")

                    # Make products bucket public (read-only)
                    if bucket == self.bucket_products:
                        self._set_public_read_policy(bucket)
            except S3Error as e:
                print(f"Error with bucket {bucket}: {e}")

    def _set_public_read_policy(self, bucket_name: str):
        """Set bucket policy to allow public read access"""
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket_name}/*"]
                }
            ]
        }

        try:
            self.client.set_bucket_policy(bucket_name, json.dumps(policy))
            print(f"✓ Set public read policy for {bucket_name}")
        except S3Error as e:
            print(f"Warning: Could not set public policy for {bucket_name}: {e}")

    def upload_product_image(
        self,
        barcode: str,
        image_data: bytes
    ) -> str:
        """
        Upload product image to shared products bucket
        Returns: object path
        """
        # Process image
        processed = self._process_image(image_data, max_size=800)

        # Generate path
        object_name = f"products/{barcode}.webp"

        # Upload
        self.client.put_object(
            bucket_name=self.bucket_products,
            object_name=object_name,
            data=BytesIO(processed),
            length=len(processed),
            content_type='image/webp',
            metadata={'barcode': barcode}
        )

        return object_name

    def upload_custom_image(
        self,
        user_id: str,
        item_id: str,
        image_data: bytes
    ) -> str:
        """Upload user custom image"""
        processed = self._process_image(image_data, max_size=1024)
        object_name = f"{user_id}/items/{item_id}.webp"

        self.client.put_object(
            bucket_name=self.bucket_users,
            object_name=object_name,
            data=BytesIO(processed),
            length=len(processed),
            content_type='image/webp',
            metadata={'user_id': user_id, 'item_id': item_id}
        )

        return object_name

    def upload_receipt(
        self,
        user_id: str,
        receipt_id: str,
        image_data: bytes
    ) -> str:
        """Upload receipt scan (Premium feature)"""
        processed = self._process_image(image_data, max_size=2000)
        object_name = f"{user_id}/{receipt_id}.webp"

        self.client.put_object(
            bucket_name=self.bucket_receipts,
            object_name=object_name,
            data=BytesIO(processed),
            length=len(processed),
            content_type='image/webp',
            metadata={'user_id': user_id, 'receipt_id': receipt_id}
        )

        return object_name

    def upload_recipe_image(
        self,
        user_id: str,
        recipe_id: str,
        image_data: bytes
    ) -> str:
        """
        Upload recipe image to MinIO
        Returns: object name
        """
        processed = self._process_image(image_data, max_size=800)
        object_name = f"{user_id}/{recipe_id}.webp"

        self.client.put_object(
            bucket_name=self.bucket_recipes,
            object_name=object_name,
            data=BytesIO(processed),
            length=len(processed),
            content_type='image/webp',
            metadata={'user_id': user_id, 'recipe_id': recipe_id}
        )

        return object_name

    async def download_recipe_image_from_url(
        self,
        user_id: str,
        recipe_id: str,
        source_url: str
    ) -> Optional[str]:
        """
        Download recipe image from Mealie/Tandoor and store in MinIO
        Returns: object name or None if failed
        """
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(source_url)
                if response.status_code == 200:
                    return self.upload_recipe_image(
                        user_id=user_id,
                        recipe_id=recipe_id,
                        image_data=response.content
                    )
                else:
                    print(f"Failed to download recipe image: HTTP {response.status_code}")
                    return None
        except Exception as e:
            print(f"Error downloading recipe image from {source_url}: {e}")
            return None

    def get_public_url(self, bucket_name: str, object_name: str) -> str:
        """Get public URL for object"""
        endpoint = os.getenv('MINIO_ENDPOINT', 'minio:9000')
        secure = os.getenv('MINIO_SECURE', 'false').lower() == 'true'
        protocol = 'https' if secure else 'http'
        return f"{protocol}://{endpoint}/{bucket_name}/{object_name}"

    def get_presigned_url(
        self,
        bucket_name: str,
        object_name: str,
        expires_seconds: int = 3600
    ) -> Optional[str]:
        """Get presigned URL with expiration"""
        try:
            url = self.client.presigned_get_object(
                bucket_name=bucket_name,
                object_name=object_name,
                expires=timedelta(seconds=expires_seconds)
            )
            return url
        except S3Error as e:
            print(f"Error generating presigned URL: {e}")
            return None

    def delete_object(self, bucket_name: str, object_name: str) -> bool:
        """Delete object from MinIO"""
        try:
            self.client.remove_object(bucket_name, object_name)
            return True
        except S3Error as e:
            print(f"Error deleting object: {e}")
            return False

    def object_exists(self, bucket_name: str, object_name: str) -> bool:
        """Check if object exists"""
        try:
            self.client.stat_object(bucket_name, object_name)
            return True
        except S3Error:
            return False

    def _process_image(self, image_data: bytes, max_size: int = 800) -> bytes:
        """
        Process image: resize, optimize, convert to WebP
        max_size: maximum dimension in pixels
        """
        img = Image.open(BytesIO(image_data))

        # Convert to RGB if needed
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            if img.mode in ('RGBA', 'LA'):
                background.paste(img, mask=img.split()[-1])
                img = background

        # Resize if too large
        if max(img.size) > max_size:
            ratio = max_size / max(img.size)
            new_size = tuple(int(dim * ratio) for dim in img.size)
            img = img.resize(new_size, Image.LANCZOS)

        # Convert to WebP
        output = BytesIO()
        img.save(output, format='WEBP', quality=85, method=6)
        output.seek(0)

        return output.read()


# Singleton instance
_minio_service = None


def get_minio_service() -> MinIOService:
    """Get MinIO service singleton"""
    global _minio_service
    if _minio_service is None:
        _minio_service = MinIOService()
    return _minio_service
