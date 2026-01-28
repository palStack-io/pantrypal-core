"""
PostgreSQL-based authentication module
Replaces SQLite user_db.py with PostgreSQL + SQLAlchemy
"""
from sqlalchemy.orm import Session
from passlib.context import CryptContext
from datetime import datetime, timedelta
from typing import Optional, Dict
import secrets

from .database import SessionLocal
from .models import User, Session as SessionModel, PasswordResetToken, EmailVerificationToken

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def create_user(
    username: str,
    password: str,
    email: Optional[str] = None,
    full_name: Optional[str] = None,
    is_admin: bool = False
) -> Dict:
    """Create a new user in PostgreSQL"""
    db = SessionLocal()
    try:
        # Check if username already exists
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            raise ValueError("Username already exists")

        # Check if email already exists
        if email:
            existing_email = db.query(User).filter(User.email == email).first()
            if existing_email:
                raise ValueError("Email already exists")

        # Create user
        user = User(
            username=username,
            password_hash=hash_password(password),
            email=email,
            full_name=full_name,
            is_admin=is_admin,
            is_active=True,
            email_verified=False,
            created_at=datetime.utcnow()
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_admin": user.is_admin,
            "created_at": user.created_at.isoformat()
        }
    finally:
        db.close()


def authenticate_user(username: str, password: str) -> Optional[Dict]:
    """
    Authenticate a user with username and password
    Returns user info if successful, None otherwise
    """
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()

        if not user:
            return None

        if not user.is_active:
            return None

        if not verify_password(password, user.password_hash):
            return None

        # Update last login
        user.last_login_at = datetime.utcnow()
        db.commit()

        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_admin": user.is_admin
        }
    finally:
        db.close()


def create_session(
    user_id: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
    expires_in_days: int = 7
) -> str:
    """Create a new session for a user"""
    db = SessionLocal()
    try:
        session_token = secrets.token_urlsafe(32)
        created_at = datetime.utcnow()
        expires_at = created_at + timedelta(days=expires_in_days)

        session = SessionModel(
            user_id=user_id,
            session_token=session_token,
            created_at=created_at,
            expires_at=expires_at,
            last_used_at=created_at,
            ip_address=ip_address,
            user_agent=user_agent
        )
        db.add(session)
        db.commit()

        return session_token
    finally:
        db.close()


def validate_session(session_token: str) -> Optional[Dict]:
    """
    Validate a session token and return user info
    Updates last_used_at timestamp
    """
    db = SessionLocal()
    try:
        session = db.query(SessionModel).filter(
            SessionModel.session_token == session_token
        ).first()

        if not session:
            return None

        # Check if session expired
        if datetime.utcnow() > session.expires_at:
            # Delete expired session
            db.delete(session)
            db.commit()
            return None

        # Get user
        user = db.query(User).filter(User.id == session.user_id).first()

        if not user or not user.is_active:
            return None

        # Update last used
        session.last_used_at = datetime.utcnow()
        db.commit()

        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_admin": user.is_admin
        }
    finally:
        db.close()


def delete_session(session_token: str) -> bool:
    """Delete a session (logout)"""
    db = SessionLocal()
    try:
        session = db.query(SessionModel).filter(
            SessionModel.session_token == session_token
        ).first()

        if session:
            db.delete(session)
            db.commit()
            return True
        return False
    finally:
        db.close()


def delete_user_sessions(user_id: str) -> int:
    """Delete all sessions for a user"""
    db = SessionLocal()
    try:
        count = db.query(SessionModel).filter(
            SessionModel.user_id == user_id
        ).delete()
        db.commit()
        return count
    finally:
        db.close()


def list_users() -> list:
    """List all users (without password hashes)"""
    db = SessionLocal()
    try:
        users = db.query(User).all()
        return [{
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "is_admin": user.is_admin,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
            "email_verified": user.email_verified
        } for user in users]
    finally:
        db.close()


def update_user_password(user_id: str, new_password: str) -> bool:
    """Update user password"""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.password_hash = hash_password(new_password)
            db.commit()
            return True
        return False
    finally:
        db.close()


def delete_user(user_id: str) -> bool:
    """Delete a user (cascades to sessions)"""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            db.delete(user)
            db.commit()
            return True
        return False
    finally:
        db.close()


def create_password_reset_token(email: str) -> Optional[str]:
    """
    Create a password reset token for a user by email
    Returns token if user found, None otherwise
    """
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return None

        token = secrets.token_urlsafe(32)
        created_at = datetime.utcnow()
        expires_at = created_at + timedelta(hours=1)

        reset_token = PasswordResetToken(
            user_id=user.id,
            token=token,
            created_at=created_at,
            expires_at=expires_at,
            used=False
        )
        db.add(reset_token)
        db.commit()

        return token
    finally:
        db.close()


def use_reset_token(token: str, new_password: str) -> bool:
    """
    Validate and use a password reset token to change password
    Returns True if successful, False if token invalid/expired
    """
    db = SessionLocal()
    try:
        reset = db.query(PasswordResetToken).filter(
            PasswordResetToken.token == token
        ).first()

        if not reset or reset.used:
            return False

        # Check if expired
        if datetime.utcnow() > reset.expires_at:
            return False

        # Update password
        user = db.query(User).filter(User.id == reset.user_id).first()
        if not user:
            return False

        user.password_hash = hash_password(new_password)
        reset.used = True
        db.commit()

        return True
    finally:
        db.close()


def create_email_verification_token(user_id: str) -> str:
    """Create an email verification token for a user"""
    db = SessionLocal()
    try:
        token = secrets.token_urlsafe(32)
        created_at = datetime.utcnow()
        expires_at = created_at + timedelta(hours=24)

        verification_token = EmailVerificationToken(
            user_id=user_id,
            token=token,
            created_at=created_at,
            expires_at=expires_at,
            used=False
        )
        db.add(verification_token)
        db.commit()

        return token
    finally:
        db.close()


def verify_email_token(token: str) -> bool:
    """
    Validate and use an email verification token
    Returns True if successful, False if token invalid/expired
    """
    db = SessionLocal()
    try:
        verification = db.query(EmailVerificationToken).filter(
            EmailVerificationToken.token == token
        ).first()

        if not verification or verification.used:
            return False

        # Check if expired
        if datetime.utcnow() > verification.expires_at:
            return False

        # Mark email as verified
        user = db.query(User).filter(User.id == verification.user_id).first()
        if not user:
            return False

        user.email_verified = True
        verification.used = True
        db.commit()

        return True
    finally:
        db.close()


def get_user_by_id(user_id: str) -> Optional[Dict]:
    """Get user by ID"""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return None

        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "is_admin": user.is_admin,
            "email_verified": user.email_verified
        }
    finally:
        db.close()


def is_email_verified(user_id: str) -> bool:
    """Check if user's email is verified"""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        return user.email_verified if user else False
    finally:
        db.close()


def mark_email_verified(user_id: str) -> bool:
    """Mark user's email as verified"""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.email_verified = True
            db.commit()
            return True
        return False
    finally:
        db.close()


def update_user_profile(user_id: str, username: Optional[str] = None, email: Optional[str] = None, full_name: Optional[str] = None) -> bool:
    """Update user profile"""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return False

        if username is not None:
            # Check if username already exists (for another user)
            existing = db.query(User).filter(User.username == username, User.id != user_id).first()
            if existing:
                raise ValueError("Username already exists")
            user.username = username

        if email is not None:
            # Check if email already exists (for another user)
            existing = db.query(User).filter(User.email == email, User.id != user_id).first()
            if existing:
                raise ValueError("Email already exists")
            user.email = email

        if full_name is not None:
            user.full_name = full_name

        db.commit()
        return True
    finally:
        db.close()


def update_user_status(user_id: str, is_active: Optional[bool] = None, is_admin: Optional[bool] = None) -> bool:
    """Update user status (admin only)"""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return False

        if is_active is not None:
            user.is_active = is_active

        if is_admin is not None:
            user.is_admin = is_admin

        db.commit()
        return True
    finally:
        db.close()


def find_user_by_email(email: str) -> Optional[Dict]:
    """Find user by email address"""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return None

        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "is_admin": user.is_admin,
            "email_verified": user.email_verified
        }
    finally:
        db.close()


def create_default_admin():
    """Create default admin user if no users exist"""
    db = SessionLocal()
    try:
        count = db.query(User).count()

        if count == 0:
            # Create default admin
            user = User(
                username="admin",
                password_hash=hash_password("admin"),
                email=None,
                full_name="Administrator",
                is_admin=True,
                is_active=True,
                email_verified=True,
                created_at=datetime.utcnow()
            )
            db.add(user)
            db.commit()
            print("✅ Created default admin user (username: admin, password: admin)")
    finally:
        db.close()


# ============================================================================
# OIDC Functions
# ============================================================================

def find_oidc_connection(provider: str, provider_user_id: str) -> Optional[Dict]:
    """Find OIDC connection by provider and provider user ID"""
    from .models import OIDCConnection
    db = SessionLocal()
    try:
        oidc_conn = db.query(OIDCConnection).filter(
            OIDCConnection.provider == provider,
            OIDCConnection.provider_user_id == provider_user_id
        ).first()

        if not oidc_conn:
            return None

        user = db.query(User).filter(User.id == oidc_conn.user_id).first()
        if not user:
            return None

        return {
            "id": oidc_conn.id,
            "user_id": oidc_conn.user_id,
            "provider": oidc_conn.provider,
            "provider_user_id": oidc_conn.provider_user_id,
            "email": oidc_conn.email,
            "username": user.username,
            "is_active": user.is_active
        }
    finally:
        db.close()


def create_oidc_connection(user_id: str, provider: str, provider_user_id: str, email: Optional[str] = None) -> Dict:
    """Create a new OIDC connection for a user"""
    from .models import OIDCConnection
    db = SessionLocal()
    try:
        oidc_conn = OIDCConnection(
            user_id=user_id,
            provider=provider,
            provider_user_id=provider_user_id,
            email=email,
            created_at=datetime.utcnow(),
            last_login_at=datetime.utcnow()
        )
        db.add(oidc_conn)
        db.commit()
        db.refresh(oidc_conn)

        return {
            "id": oidc_conn.id,
            "user_id": oidc_conn.user_id,
            "provider": oidc_conn.provider,
            "provider_user_id": oidc_conn.provider_user_id,
            "email": oidc_conn.email
        }
    finally:
        db.close()


def update_oidc_last_login(provider: str, provider_user_id: str):
    """Update last login time for an OIDC connection"""
    from .models import OIDCConnection
    db = SessionLocal()
    try:
        oidc_conn = db.query(OIDCConnection).filter(
            OIDCConnection.provider == provider,
            OIDCConnection.provider_user_id == provider_user_id
        ).first()

        if oidc_conn:
            oidc_conn.last_login_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


def create_user_from_oidc(username: str, email: Optional[str], full_name: Optional[str] = None) -> Dict:
    """
    Create a new user from OIDC authentication
    Password is set to a random value since OIDC users don't use password auth
    """
    random_password = secrets.token_urlsafe(32)

    db = SessionLocal()
    try:
        user = User(
            username=username,
            password_hash=hash_password(random_password),
            email=email,
            full_name=full_name,
            is_active=True,
            is_admin=False,
            email_verified=True,  # OIDC users are email-verified
            created_at=datetime.utcnow()
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_active": True,
            "is_admin": False,
            "email_verified": True
        }
    finally:
        db.close()
