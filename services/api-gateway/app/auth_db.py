import sqlite3
import secrets
from datetime import datetime, timedelta
from typing import Optional, List, Dict
from passlib.context import CryptContext
import os

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Database path
DB_PATH = os.getenv("API_KEYS_DB_PATH", "/app/data/api_keys.db")


def get_db():
    """Get database connection"""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database with api_keys table"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_hash TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP NOT NULL,
            last_used_at TIMESTAMP,
            expires_at TIMESTAMP,
            is_active BOOLEAN NOT NULL DEFAULT 1
        )
    """)
    
    conn.commit()
    conn.close()


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


def create_api_key(name: str, description: Optional[str] = None, 
                   expires_in_days: Optional[int] = None) -> Dict:
    """
    Create a new API key
    Returns: Dict with the plain key (only time it's shown!) and key info
    """
    conn = get_db()
    cursor = conn.cursor()
    
    # Generate the key
    plain_key = generate_api_key()
    key_hash = hash_api_key(plain_key)
    
    # Calculate expiration
    created_at = datetime.now()
    expires_at = None
    if expires_in_days:
        expires_at = created_at + timedelta(days=expires_in_days)
    
    # Insert into database
    cursor.execute("""
        INSERT INTO api_keys (key_hash, name, description, created_at, expires_at, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
    """, (key_hash, name, description, created_at, expires_at))
    
    key_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return {
        "id": key_id,
        "key": plain_key,  # ONLY TIME THIS IS RETURNED!
        "name": name,
        "description": description,
        "created_at": created_at.isoformat(),
        "expires_at": expires_at.isoformat() if expires_at else None,
        "is_active": True
    }


def validate_api_key(api_key: str) -> Optional[Dict]:
    """
    Validate an API key and return key info if valid
    Updates last_used_at timestamp
    """
    if not api_key or not api_key.startswith("pp_"):
        return None
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Get all active keys
    cursor.execute("""
        SELECT id, key_hash, name, description, created_at, last_used_at, expires_at, is_active
        FROM api_keys
        WHERE is_active = 1
    """)
    
    keys = cursor.fetchall()
    
    for key_row in keys:
        # Check if key matches
        if verify_api_key(api_key, key_row['key_hash']):
            # Check if expired
            if key_row['expires_at']:
                expires_at = datetime.fromisoformat(key_row['expires_at'])
                if datetime.now() > expires_at:
                    conn.close()
                    return None
            
            # Update last_used_at
            cursor.execute("""
                UPDATE api_keys
                SET last_used_at = ?
                WHERE id = ?
            """, (datetime.now(), key_row['id']))
            conn.commit()
            
            result = {
                "id": key_row['id'],
                "name": key_row['name'],
                "description": key_row['description'],
                "created_at": key_row['created_at'],
                "last_used_at": datetime.now().isoformat(),
            }
            
            conn.close()
            return result
    
    conn.close()
    return None


def list_api_keys() -> List[Dict]:
    """List all API keys (without exposing the actual keys)"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, name, description, created_at, last_used_at, expires_at, is_active
        FROM api_keys
        ORDER BY created_at DESC
    """)
    
    keys = []
    for row in cursor.fetchall():
        keys.append({
            "id": row['id'],
            "name": row['name'],
            "description": row['description'],
            "created_at": row['created_at'],
            "last_used_at": row['last_used_at'],
            "expires_at": row['expires_at'],
            "is_active": bool(row['is_active'])
        })
    
    conn.close()
    return keys


def revoke_api_key(key_id: int) -> bool:
    """Revoke (deactivate) an API key"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE api_keys
        SET is_active = 0
        WHERE id = ?
    """, (key_id,))
    
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    
    return rows_affected > 0


def delete_api_key(key_id: int) -> bool:
    """Permanently delete an API key"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM api_keys WHERE id = ?", (key_id,))
    
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    
    return rows_affected > 0


# Initialize database on module import
init_db()