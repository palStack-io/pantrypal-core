import sqlite3
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict
from passlib.context import CryptContext
import os

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Database path
DB_PATH = os.getenv("USERS_DB_PATH", "/app/data/users.db")


def get_db():
    """Get database connection"""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database with users and sessions tables"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            email TEXT,
            full_name TEXT,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            is_admin BOOLEAN NOT NULL DEFAULT 0,
            email_verified BOOLEAN NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL,
            last_login_at TIMESTAMP
        )
    """)
    
    # Sessions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            session_token TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            last_used_at TIMESTAMP NOT NULL,
            ip_address TEXT,
            user_agent TEXT,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)
    
    # Password reset tokens table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used BOOLEAN NOT NULL DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)

    # Email verification tokens table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS email_verification_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT NOT NULL UNIQUE,
            created_at TIMESTAMP NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used BOOLEAN NOT NULL DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    """)

    # Migration: Add email_verified column if it doesn't exist
    cursor.execute("PRAGMA table_info(users)")
    columns = [row[1] for row in cursor.fetchall()]
    if 'email_verified' not in columns:
        cursor.execute("ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT 0")
        # Set existing users as verified
        cursor.execute("UPDATE users SET email_verified = 1")

    conn.commit()
    conn.close()


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def create_user(username: str, password: str, email: Optional[str] = None, 
                full_name: Optional[str] = None, is_admin: bool = False) -> Dict:
    """
    Create a new user
    """
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if username already exists
    cursor.execute("SELECT id FROM users WHERE username = ?", (username,))
    if cursor.fetchone():
        conn.close()
        raise ValueError("Username already exists")
    
    password_hash = hash_password(password)
    created_at = datetime.now()
    
    cursor.execute("""
        INSERT INTO users (username, password_hash, email, full_name, is_admin, created_at, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 1)
    """, (username, password_hash, email, full_name, is_admin, created_at))
    
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return {
        "id": user_id,
        "username": username,
        "email": email,
        "full_name": full_name,
        "is_admin": is_admin,
        "created_at": created_at.isoformat()
    }


def authenticate_user(username: str, password: str) -> Optional[Dict]:
    """
    Authenticate a user with username and password
    Returns user info if successful, None otherwise
    """
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, username, password_hash, email, full_name, is_active, is_admin
        FROM users
        WHERE username = ?
    """, (username,))
    
    user = cursor.fetchone()
    
    if not user:
        conn.close()
        return None
    
    if not user['is_active']:
        conn.close()
        return None
    
    if not verify_password(password, user['password_hash']):
        conn.close()
        return None
    
    # Update last login
    cursor.execute("""
        UPDATE users
        SET last_login_at = ?
        WHERE id = ?
    """, (datetime.now(), user['id']))
    conn.commit()
    
    result = {
        "id": user['id'],
        "username": user['username'],
        "email": user['email'],
        "full_name": user['full_name'],
        "is_admin": bool(user['is_admin'])
    }
    
    conn.close()
    return result


def create_session(user_id: int, ip_address: Optional[str] = None, 
                   user_agent: Optional[str] = None, 
                   expires_in_days: int = 7) -> str:
    """
    Create a new session for a user
    Returns session token
    """
    conn = get_db()
    cursor = conn.cursor()
    
    session_token = secrets.token_urlsafe(32)
    created_at = datetime.now()
    expires_at = created_at + timedelta(days=expires_in_days)
    
    cursor.execute("""
        INSERT INTO sessions (user_id, session_token, created_at, expires_at, last_used_at, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (user_id, session_token, created_at, expires_at, created_at, ip_address, user_agent))
    
    conn.commit()
    conn.close()
    
    return session_token


def validate_session(session_token: str) -> Optional[Dict]:
    """
    Validate a session token and return user info
    Updates last_used_at timestamp
    """
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT s.id, s.user_id, s.expires_at, u.username, u.email, u.full_name, u.is_admin, u.is_active
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_token = ?
    """, (session_token,))
    
    session = cursor.fetchone()
    
    if not session:
        conn.close()
        return None
    
    # Check if user is active
    if not session['is_active']:
        conn.close()
        return None
    
    # Check if session expired
    expires_at = datetime.fromisoformat(session['expires_at'])
    if datetime.now() > expires_at:
        # Delete expired session
        cursor.execute("DELETE FROM sessions WHERE id = ?", (session['id'],))
        conn.commit()
        conn.close()
        return None
    
    # Update last used
    cursor.execute("""
        UPDATE sessions
        SET last_used_at = ?
        WHERE id = ?
    """, (datetime.now(), session['id']))
    conn.commit()
    
    # FIXED: Return "id" instead of "user_id" for consistency with main.py
    result = {
        "id": session['user_id'],  # Changed from "user_id" to "id"
        "username": session['username'],
        "email": session['email'],
        "full_name": session['full_name'],
        "is_admin": bool(session['is_admin'])
    }
    
    conn.close()
    return result


def delete_session(session_token: str) -> bool:
    """Delete a session (logout)"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM sessions WHERE session_token = ?", (session_token,))
    rows_affected = cursor.rowcount
    
    conn.commit()
    conn.close()
    
    return rows_affected > 0


def delete_user_sessions(user_id: int) -> int:
    """Delete all sessions for a user"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))
    rows_affected = cursor.rowcount
    
    conn.commit()
    conn.close()
    
    return rows_affected


def list_users() -> list:
    """List all users (without password hashes)"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, username, email, full_name, is_active, is_admin, created_at, last_login_at
        FROM users
        ORDER BY created_at DESC
    """)
    
    users = []
    for row in cursor.fetchall():
        users.append({
            "id": row['id'],
            "username": row['username'],
            "email": row['email'],
            "full_name": row['full_name'],
            "is_active": bool(row['is_active']),
            "is_admin": bool(row['is_admin']),
            "created_at": row['created_at'],
            "last_login_at": row['last_login_at']
        })
    
    conn.close()
    return users


def update_user_password(user_id: int, new_password: str) -> bool:
    """Update user password"""
    conn = get_db()
    cursor = conn.cursor()
    
    password_hash = hash_password(new_password)
    
    cursor.execute("""
        UPDATE users
        SET password_hash = ?
        WHERE id = ?
    """, (password_hash, user_id))
    
    rows_affected = cursor.rowcount
    conn.commit()
    conn.close()
    
    return rows_affected > 0


def delete_user(user_id: int) -> bool:
    """Delete a user (cascades to sessions)"""
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    rows_affected = cursor.rowcount
    
    conn.commit()
    conn.close()
    
    return rows_affected > 0


def create_password_reset_token(email: str) -> Optional[str]:
    """
    Create a password reset token for a user by email
    Returns token if user found, None otherwise
    """
    conn = get_db()
    cursor = conn.cursor()

    # Find user by email
    cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()

    if not user:
        conn.close()
        return None

    # Generate token
    token = secrets.token_urlsafe(32)
    created_at = datetime.now()
    expires_at = created_at + timedelta(hours=1)  # Token valid for 1 hour

    # Store token
    cursor.execute("""
        INSERT INTO password_reset_tokens (user_id, token, created_at, expires_at, used)
        VALUES (?, ?, ?, ?, 0)
    """, (user['id'], token, created_at, expires_at))

    conn.commit()
    conn.close()

    return token


def use_reset_token(token: str, new_password: str) -> bool:
    """
    Validate and use a password reset token to change password
    Returns True if successful, False if token invalid/expired
    """
    conn = get_db()
    cursor = conn.cursor()

    # Find unused, non-expired token
    cursor.execute("""
        SELECT id, user_id, expires_at, used
        FROM password_reset_tokens
        WHERE token = ?
    """, (token,))

    reset = cursor.fetchone()

    if not reset:
        conn.close()
        return False

    # Check if already used
    if reset['used']:
        conn.close()
        return False

    # Check if expired
    expires_at = datetime.fromisoformat(reset['expires_at'])
    if datetime.now() > expires_at:
        conn.close()
        return False

    # Update password
    password_hash = hash_password(new_password)
    cursor.execute("""
        UPDATE users
        SET password_hash = ?
        WHERE id = ?
    """, (password_hash, reset['user_id']))

    # Mark token as used
    cursor.execute("""
        UPDATE password_reset_tokens
        SET used = 1
        WHERE id = ?
    """, (reset['id'],))

    conn.commit()
    conn.close()

    return True


def create_email_verification_token(user_id: int) -> str:
    """
    Create an email verification token for a user
    Returns token
    """
    conn = get_db()
    cursor = conn.cursor()

    # Generate token
    token = secrets.token_urlsafe(32)
    created_at = datetime.now()
    expires_at = created_at + timedelta(hours=24)  # Token valid for 24 hours

    # Store token
    cursor.execute("""
        INSERT INTO email_verification_tokens (user_id, token, created_at, expires_at, used)
        VALUES (?, ?, ?, ?, 0)
    """, (user_id, token, created_at, expires_at))

    conn.commit()
    conn.close()

    return token


def verify_email_token(token: str) -> bool:
    """
    Validate and use an email verification token
    Returns True if successful, False if token invalid/expired
    """
    conn = get_db()
    cursor = conn.cursor()

    # Find unused, non-expired token
    cursor.execute("""
        SELECT id, user_id, expires_at, used
        FROM email_verification_tokens
        WHERE token = ?
    """, (token,))

    verification = cursor.fetchone()

    if not verification:
        conn.close()
        return False

    # Check if already used
    if verification['used']:
        conn.close()
        return False

    # Check if expired
    expires_at = datetime.fromisoformat(verification['expires_at'])
    if datetime.now() > expires_at:
        conn.close()
        return False

    # Mark email as verified
    cursor.execute("""
        UPDATE users
        SET email_verified = 1
        WHERE id = ?
    """, (verification['user_id'],))

    # Mark token as used
    cursor.execute("""
        UPDATE email_verification_tokens
        SET used = 1
        WHERE id = ?
    """, (verification['id'],))

    conn.commit()
    conn.close()

    return True


def create_default_admin():
    """Create default admin user if no users exist"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) as count FROM users")
    count = cursor.fetchone()['count']

    if count == 0:
        # Create default admin
        password_hash = hash_password("admin")  # Default password, should be changed immediately
        created_at = datetime.now()

        cursor.execute("""
            INSERT INTO users (username, password_hash, email, full_name, is_admin, created_at, is_active, email_verified)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, ("admin", password_hash, None, "Administrator", True, created_at, True, True))

        conn.commit()


    conn.close()


# Initialize database on module import
init_db()
create_default_admin()