"""
PostgreSQL-based API key management
Replaces SQLite auth_db.py with PostgreSQL + SQLAlchemy
"""
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional, List, Dict
import secrets

from .database import SessionLocal
from .models import APIKey

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def generate_api_key() -> str:
    """Generate a secure random API key"""
    # Format: pp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (pantrypal prefix + 32 hex chars)
    return f"pp_{secrets.token_hex(32)}"


def hash_api_key(api_key: str) -> str:
    """Hash an API key using bcrypt"""
    return pwd_context.hash(api_key)


def verify_api_key(plain_key: str, hashed_key: str) -> bool:
    """Verify an API key against its hash"""
    return pwd_context.verify(plain_key, hashed_key)


def create_api_key(name: str, description: Optional[str] = None, expires_in_days: Optional[int] = None) -> Dict:
    """
    Create a new API key
    Returns: Dict with the plain key (only time it's shown!) and key info
    """
    db = SessionLocal()
    try:
        # Generate the key
        plain_key = generate_api_key()
        key_hash = hash_api_key(plain_key)

        # Calculate expiration
        created_at = datetime.utcnow()
        expires_at = None
        if expires_in_days:
            expires_at = created_at + timedelta(days=expires_in_days)

        # Create API key
        api_key = APIKey(
            key_hash=key_hash,
            name=name,
            description=description,
            created_at=created_at,
            expires_at=expires_at,
            is_active=True
        )
        db.add(api_key)
        db.commit()
        db.refresh(api_key)

        return {
            "id": api_key.id,
            "key": plain_key,  # ONLY TIME THIS IS RETURNED!
            "name": api_key.name,
            "description": api_key.description,
            "created_at": api_key.created_at.isoformat(),
            "expires_at": api_key.expires_at.isoformat() if api_key.expires_at else None,
            "is_active": api_key.is_active
        }
    finally:
        db.close()


def validate_api_key(plain_key: str) -> Optional[Dict]:
    """
    Validate an API key
    Returns key info if valid, None if invalid/expired/inactive
    """
    db = SessionLocal()
    try:
        # Get all active keys
        api_keys = db.query(APIKey).filter(APIKey.is_active == True).all()

        for api_key in api_keys:
            if verify_api_key(plain_key, api_key.key_hash):
                # Check if expired
                if api_key.expires_at and datetime.utcnow() > api_key.expires_at:
                    return None

                # Update last used timestamp
                api_key.last_used_at = datetime.utcnow()
                db.commit()

                return {
                    "id": api_key.id,
                    "name": api_key.name,
                    "description": api_key.description,
                    "last_used_at": api_key.last_used_at.isoformat(),
                    "expires_at": api_key.expires_at.isoformat() if api_key.expires_at else None
                }

        return None
    finally:
        db.close()


def list_api_keys() -> List[Dict]:
    """List all API keys (without the actual keys)"""
    db = SessionLocal()
    try:
        api_keys = db.query(APIKey).order_by(APIKey.created_at.desc()).all()

        return [{
            "id": api_key.id,
            "name": api_key.name,
            "description": api_key.description,
            "created_at": api_key.created_at.isoformat(),
            "last_used_at": api_key.last_used_at.isoformat() if api_key.last_used_at else None,
            "expires_at": api_key.expires_at.isoformat() if api_key.expires_at else None,
            "is_active": api_key.is_active
        } for api_key in api_keys]
    finally:
        db.close()


def get_api_key(key_id: str) -> Optional[Dict]:
    """Get API key by ID"""
    db = SessionLocal()
    try:
        api_key = db.query(APIKey).filter(APIKey.id == key_id).first()

        if not api_key:
            return None

        return {
            "id": api_key.id,
            "name": api_key.name,
            "description": api_key.description,
            "created_at": api_key.created_at.isoformat(),
            "last_used_at": api_key.last_used_at.isoformat() if api_key.last_used_at else None,
            "expires_at": api_key.expires_at.isoformat() if api_key.expires_at else None,
            "is_active": api_key.is_active
        }
    finally:
        db.close()


def delete_api_key(key_id: str) -> bool:
    """Delete an API key"""
    db = SessionLocal()
    try:
        api_key = db.query(APIKey).filter(APIKey.id == key_id).first()

        if api_key:
            db.delete(api_key)
            db.commit()
            return True
        return False
    finally:
        db.close()


def revoke_api_key(key_id: str) -> bool:
    """Revoke (deactivate) an API key"""
    db = SessionLocal()
    try:
        api_key = db.query(APIKey).filter(APIKey.id == key_id).first()

        if api_key:
            api_key.is_active = False
            db.commit()
            return True
        return False
    finally:
        db.close()


def update_api_key(key_id: str, name: Optional[str] = None, description: Optional[str] = None) -> bool:
    """Update API key name or description"""
    db = SessionLocal()
    try:
        api_key = db.query(APIKey).filter(APIKey.id == key_id).first()

        if not api_key:
            return False

        if name is not None:
            api_key.name = name

        if description is not None:
            api_key.description = description

        db.commit()
        return True
    finally:
        db.close()
