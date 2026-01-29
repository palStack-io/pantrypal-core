"""
SQLAlchemy ORM Models for PantryPal
PostgreSQL database models with full offline recipe support
"""
from sqlalchemy import (
    Column, Integer, String, DateTime, Boolean, Date, Text,
    ForeignKey, DECIMAL, JSON, UniqueConstraint, Index
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

Base = declarative_base()


def generate_uuid():
    """Generate UUID as string"""
    return str(uuid.uuid4())


# ============================================
# USER MANAGEMENT
# ============================================

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True)
    full_name = Column(String(255))

    is_active = Column(Boolean, default=True, nullable=False)
    is_admin = Column(Boolean, default=False, nullable=False)
    is_demo = Column(Boolean, default=False, nullable=False)  # Demo accounts have restrictions
    email_verified = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime)

    # Relationships
    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    oidc_connections = relationship("OIDCConnection", back_populates="user", cascade="all, delete-orphan")
    user_images = relationship("UserImage", back_populates="user", cascade="all, delete-orphan")
    recipe_preferences = relationship("UserRecipePreference", back_populates="user", cascade="all, delete-orphan")
    imported_recipes = relationship("Recipe", back_populates="imported_by_user", foreign_keys="Recipe.imported_by_user_id")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_token = Column(String(255), unique=True, nullable=False, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    last_used_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    ip_address = Column(String(45))
    user_agent = Column(Text)

    # Relationships
    user = relationship("User", back_populates="sessions")


class APIKey(Base):
    __tablename__ = "api_keys"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    key_hash = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_used_at = Column(DateTime)
    expires_at = Column(DateTime)
    is_active = Column(Boolean, default=True, nullable=False)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False, nullable=False)


class OIDCConnection(Base):
    __tablename__ = "oidc_connections"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String(50), default="oidc", nullable=False)
    provider_user_id = Column(String(255), nullable=False)
    email = Column(String(255))

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_login_at = Column(DateTime)

    # Relationships
    user = relationship("User", back_populates="oidc_connections")

    __table_args__ = (
        UniqueConstraint('provider', 'provider_user_id', name='uq_provider_user'),
    )


# ============================================
# IMAGE STORAGE (MinIO References)
# ============================================

class ProductImage(Base):
    """Shared product images from Open Food Facts, UPCitemDB, etc."""
    __tablename__ = "product_images"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    barcode = Column(String(100), unique=True, nullable=False, index=True)

    # MinIO storage
    bucket_name = Column(String(100), default="pantrypal-products", nullable=False)
    object_name = Column(String(500), nullable=False)

    # Metadata
    file_size = Column(Integer)
    width = Column(Integer)
    height = Column(Integer)
    mime_type = Column(String(100), default="image/webp")

    # Source
    source = Column(String(50))  # 'openfoodfacts', 'upcitemdb'
    original_url = Column(String(500))

    # Usage tracking
    downloaded_at = Column(DateTime, default=datetime.utcnow)
    last_accessed = Column(DateTime)
    access_count = Column(Integer, default=0)


class UserImage(Base):
    """User custom images (personal uploads)"""
    __tablename__ = "user_images"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    item_id = Column(String(36))  # Reference to inventory item (external system)

    # MinIO storage
    bucket_name = Column(String(100), default="pantrypal-users", nullable=False)
    object_name = Column(String(500), nullable=False)

    # Metadata
    file_size = Column(Integer)
    width = Column(Integer)
    height = Column(Integer)
    mime_type = Column(String(100), default="image/webp")

    uploaded_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="user_images")

    __table_args__ = (
        UniqueConstraint('user_id', 'item_id', name='uq_user_item'),
        Index('idx_user_images_user', 'user_id'),
        Index('idx_user_images_item', 'item_id'),
    )


class RecipeImage(Base):
    """Recipe images stored in MinIO (shared with recipes)"""
    __tablename__ = "recipe_images"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    recipe_id = Column(String(36), ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)

    # MinIO storage
    bucket_name = Column(String(100), default="pantrypal-recipes", nullable=False)
    object_name = Column(String(500), nullable=False)

    # Metadata
    file_size = Column(Integer)
    width = Column(Integer)
    height = Column(Integer)
    mime_type = Column(String(100), default="image/webp")

    # Source tracking
    source = Column(String(50))  # 'mealie', 'tandoor', 'upload'
    original_url = Column(String(500))

    downloaded_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('recipe_id', name='uq_recipe_image'),
        Index('idx_recipe_images_recipe', 'recipe_id'),
    )


# ============================================
# RECIPE INTEGRATION
# ============================================

class RecipeIntegration(Base):
    """Household-level recipe integration settings (Mealie/Tandoor) - one per provider"""
    __tablename__ = "recipe_integrations"

    id = Column(String(36), primary_key=True, default=generate_uuid)

    provider = Column(String(50), unique=True, nullable=False)  # 'mealie', 'tandoor' - one integration per provider
    server_url = Column(String(255))
    api_token_encrypted = Column(Text)
    enabled = Column(Boolean, default=True)

    # Import settings
    auto_sync = Column(Boolean, default=False)
    sync_frequency = Column(Integer, default=86400)  # seconds (24 hours)
    import_images = Column(Boolean, default=True)

    # Sync tracking
    last_sync = Column(DateTime)
    total_recipes_imported = Column(Integer, default=0)

    # Audit: who configured this integration
    configured_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Recipe(Base):
    """Shared recipes for the household (any user can view/delete)"""
    __tablename__ = "recipes"

    id = Column(String(36), primary_key=True, default=generate_uuid)

    # Audit: who imported this recipe (nullable for audit purposes)
    imported_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # External source tracking (optional)
    external_provider = Column(String(50))  # 'mealie', 'tandoor', 'manual', null
    external_id = Column(String(255))
    external_url = Column(String(500))

    # Recipe data (shared across household)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    ingredients = Column(JSON, nullable=False)  # List of ingredient dicts
    instructions = Column(JSON)  # List of instruction dicts

    # Metadata
    prep_time = Column(Integer)  # minutes
    cook_time = Column(Integer)  # minutes
    total_time = Column(Integer)  # minutes
    servings = Column(Integer, default=4)
    difficulty = Column(String(50))  # 'Easy', 'Medium', 'Hard'
    cuisine = Column(String(100))
    tags = Column(JSON)  # List of tags
    category = Column(JSON)  # List of categories

    # Images (stored in MinIO)
    image_url = Column(String(500))  # API URL: /api/images/recipe/{recipe_id}
    image_bucket = Column(String(100))
    image_object_name = Column(String(500))

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    imported_at = Column(DateTime)
    last_synced = Column(DateTime)

    # Relationships
    imported_by_user = relationship("User", back_populates="imported_recipes", foreign_keys=[imported_by_user_id])
    user_preferences = relationship("UserRecipePreference", back_populates="recipe", cascade="all, delete-orphan")

    __table_args__ = (
        # Unique constraint: one recipe per external_provider + external_id combination
        UniqueConstraint('external_provider', 'external_id', name='uq_external_recipe'),
        Index('idx_recipes_external', 'external_provider', 'external_id'),
        Index('idx_recipes_name', 'name'),
    )

    def to_dict(self, user_prefs=None):
        """Convert recipe to dictionary, optionally with user preferences"""
        result = {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'ingredients': self.ingredients,
            'instructions': self.instructions,
            'prep_time': self.prep_time,
            'cook_time': self.cook_time,
            'total_time': self.total_time,
            'servings': self.servings,
            'difficulty': self.difficulty,
            'cuisine': self.cuisine,
            'tags': self.tags,
            'category': self.category,
            'image_url': self.image_url,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'imported_at': self.imported_at.isoformat() if self.imported_at else None,
            'external_provider': self.external_provider,
            'external_url': self.external_url,
            'imported_by_user_id': self.imported_by_user_id,
            # Default values for user-specific fields (will be overridden if user_prefs provided)
            'match_percentage': 0,
            'uses_expiring_items': False,
            'expiring_ingredient_count': 0,
            'available_ingredient_count': 0,
            'missing_ingredient_count': 0,
            'missing_ingredients': [],
            'expiring_ingredients': [],
            'notes': None,
            'favorite': False,
            'times_cooked': 0,
            'last_cooked': None,
        }

        # Override with user-specific preferences if provided
        if user_prefs:
            result['match_percentage'] = float(user_prefs.match_percentage) if user_prefs.match_percentage else 0
            result['uses_expiring_items'] = user_prefs.uses_expiring_items or False
            result['expiring_ingredient_count'] = user_prefs.expiring_ingredient_count or 0
            result['available_ingredient_count'] = user_prefs.available_ingredient_count or 0
            result['missing_ingredient_count'] = user_prefs.missing_ingredient_count or 0
            result['missing_ingredients'] = user_prefs.missing_ingredients or []
            result['expiring_ingredients'] = user_prefs.expiring_ingredients or []
            result['notes'] = user_prefs.notes
            result['favorite'] = user_prefs.favorite or False
            result['times_cooked'] = user_prefs.times_cooked or 0
            result['last_cooked'] = user_prefs.last_cooked.isoformat() if user_prefs.last_cooked else None

        return result


class UserRecipePreference(Base):
    """User-specific preferences for shared recipes"""
    __tablename__ = "user_recipe_preferences"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    recipe_id = Column(String(36), ForeignKey("recipes.id", ondelete="CASCADE"), nullable=False)

    # User-specific preferences
    favorite = Column(Boolean, default=False)
    notes = Column(Text)
    times_cooked = Column(Integer, default=0)
    last_cooked = Column(DateTime)

    # Per-user match data (based on shared pantry, but stored per-user for flexibility)
    match_percentage = Column(DECIMAL(5, 2))
    uses_expiring_items = Column(Boolean, default=False)
    expiring_ingredient_count = Column(Integer, default=0)
    available_ingredient_count = Column(Integer, default=0)
    missing_ingredient_count = Column(Integer, default=0)
    missing_ingredients = Column(JSON)
    expiring_ingredients = Column(JSON)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="recipe_preferences")
    recipe = relationship("Recipe", back_populates="user_preferences")

    __table_args__ = (
        UniqueConstraint('user_id', 'recipe_id', name='uq_user_recipe_preference'),
        Index('idx_user_recipe_prefs_user', 'user_id'),
        Index('idx_user_recipe_prefs_recipe', 'recipe_id'),
        Index('idx_user_recipe_prefs_favorite', 'user_id', 'favorite'),
        Index('idx_user_recipe_prefs_match', 'user_id', 'match_percentage'),
    )
