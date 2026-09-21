from fastapi import FastAPI, HTTPException, Depends, Response, Request, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.responses import RedirectResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from datetime import datetime, timedelta
from typing import Optional
import asyncio
import httpx
import logging
import os
from pydantic import BaseModel, EmailStr

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from .network_utils import get_client_ip, is_trusted_network

# Import auth modules
from .auth import get_current_auth, require_admin, require_write_scope
from . import pg_api_keys, pg_auth
from .email_service import send_password_reset_email, send_welcome_email, send_verification_email, is_email_configured
from .oidc import (
    oidc_public_config, verify_id_token, fetch_userinfo,
    is_oidc_enabled, get_oauth_client, extract_user_info,
    OIDC_AUTO_LINK, OIDC_AUTO_CREATE,
)

# Import database and services
from .database import init_db
from .local_storage_service import get_local_storage_service

# Import routers
from .routes import images, recipes

app = FastAPI(title="PantryPal API Gateway", version="2.0.0")

# Rate limiter — keyed by client IP
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'camera=(), microphone=(), geolocation=()'
        return response

app.add_middleware(SecurityHeadersMiddleware)
# Only needed to carry OAuth state/nonce (and mobile_state) across the
# generic OIDC redirect round-trip — the native Google/Apple flow and
# regular session-token auth don't touch this.
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SECRET_KEY", os.getenv("ENCRYPTION_SALT", "change-me-in-production")),
    https_only=False,
    same_site="lax",
)

# Startup event: Initialize database and local storage
@app.on_event("startup")
async def startup_event():
    """Initialize database tables and local storage directories"""
    print("🚀 Starting PantryPal API Gateway...")

    # Initialize PostgreSQL database
    try:
        init_db()
        print("✓ Database tables initialized")
    except Exception as e:
        print(f"⚠️  Database initialization warning: {e}")

    # Initialize local storage directories
    try:
        get_local_storage_service()
        print("✓ Local storage initialized")
    except Exception as e:
        print(f"⚠️  Local storage initialization warning: {e}")

    print("✓ PantryPal API Gateway ready")

# Include routers
app.include_router(images.router)
app.include_router(recipes.router)

# Get AUTH_MODE for informational purposes
AUTH_MODE = os.getenv("AUTH_MODE", "full").lower()

# Get CORS origins from environment variable
cors_origins_env = os.getenv("CORS_ORIGINS", "*")
if cors_origins_env == "*":
    # When using wildcard, we cannot use credentials
    # For production, set specific origins in CORS_ORIGINS env var
    cors_origins = ["*"]
    allow_credentials = False
else:
    # Split comma-separated origins
    cors_origins = [origin.strip() for origin in cors_origins_env.split(",")]
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

INVENTORY_SERVICE_URL = os.getenv("INVENTORY_SERVICE_URL", "http://inventory-service:8001")
LOOKUP_SERVICE_URL = os.getenv("LOOKUP_SERVICE_URL", "http://lookup-service:8002")

_INTERNAL_TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN", "")
_INTERNAL_HEADERS = {"X-Internal-Token": _INTERNAL_TOKEN} if _INTERNAL_TOKEN else {}

COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

# Base URL for email links (password reset, email verification)
# If not set, will fall back to using the incoming request URL
APP_URL = os.getenv("APP_URL")

# ============================================================================
# REQUEST MODELS
# ============================================================================

class AddItemRequest(BaseModel):
    barcode: str
    location: str = "Basement Pantry"
    quantity: int = 1
    expiry_date: Optional[str] = None

class ManualAddRequest(BaseModel):
    name: str
    barcode: Optional[str] = None
    brand: Optional[str] = None
    category: str = "Uncategorized"
    location: str = "Basement Pantry"
    quantity: int = 1
    expiry_date: Optional[str] = None
    notes: Optional[str] = None

class UpdateItemRequest(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    location: Optional[str] = None
    quantity: Optional[int] = None
    expiry_date: Optional[str] = None
    notes: Optional[str] = None

class CreateLocationRequest(BaseModel):
    name: str
    emoji: Optional[str] = "📍"

class CreateCategoryRequest(BaseModel):
    name: str
    emoji: Optional[str] = "📦"

class CreateApiKeyRequest(BaseModel):
    name: str
    description: Optional[str] = None
    expires_in_days: Optional[int] = None
    is_read_only: bool = False

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    full_name: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class VerifyEmailRequest(BaseModel):
    token: str

class ResendVerificationRequest(BaseModel):
    email: str

# ============================================================================
# PUBLIC ENDPOINTS (No authentication required)
# ============================================================================

@app.get("/")
async def root():
    return {
        "service": "PantryPal API Gateway",
        "version": "2.0.0",
        "status": "healthy",
        "auth_mode": AUTH_MODE
    }

@app.get("/health")
async def health_check():
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            inventory_health = await client.get(f"{INVENTORY_SERVICE_URL}/health", timeout=2.0)
            lookup_health = await client.get(f"{LOOKUP_SERVICE_URL}/health", timeout=2.0)
        return {
            "status": "healthy",
            "auth_mode": AUTH_MODE,
            "services": {
                "inventory": inventory_health.json(),
                "lookup": lookup_health.json()
            }
        }
    except Exception as e:
        logger.warning("Health check degraded: %s", e)
        return {"status": "degraded", "error": "One or more internal services unavailable"}

@app.get("/api/auth/status")
async def auth_status():
    """Get current authentication mode and configuration"""
    allow_registration = os.getenv("ALLOW_REGISTRATION", "false").lower() == "true"
    demo_mode = os.getenv("DEMO_MODE", "false").lower() == "true"

    response = {
        "auth_mode": AUTH_MODE,
        "requires_login": AUTH_MODE in ["full", "smart"],
        "requires_api_key": AUTH_MODE in ["api_key_only"],
        "allow_registration": allow_registration,
        "email_configured": is_email_configured(),
        "demo_mode": demo_mode
    }

    # Add demo accounts info if demo mode is enabled
    if demo_mode:
        demo_password = os.getenv("DEMO_ACCOUNT_PASSWORD", "demo123")
        response["demo_accounts"] = [
            {"username": "demo1", "password": demo_password},
            {"username": "demo2", "password": demo_password},
            {"username": "demo3", "password": demo_password},
            {"username": "demo4", "password": demo_password},
        ]
        response["demo_session_minutes"] = 10

    response["oidc"] = oidc_public_config()

    return response

# ============================================================================
# AUTHENTICATION ENDPOINTS (Login/Logout/Register)
# ============================================================================

@app.post("/api/auth/login")
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, response: Response):
    """Login with username and password (works in 'full' or 'smart' mode)"""
    if AUTH_MODE not in ["full", "smart"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Login not available in '{AUTH_MODE}' mode. Set AUTH_MODE=full or smart to enable."
        )

    user = pg_auth.authenticate_user(body.username, body.password)

    if not user:
        ip_address = request.client.host if request.client else "unknown"
        logger.warning("AUDIT failed_login username=%s ip=%s", body.username, ip_address)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    # Check if email is verified (only if email is configured)
    if is_email_configured():
        if not pg_auth.is_email_verified(user["id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Please verify your email address before logging in. Check your inbox for the verification link."
            )

    # Create session
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    # Demo accounts get 10-minute session, regular users get 7 days
    is_demo_user = user.get("is_demo", False)
    if is_demo_user:
        session_token = pg_auth.create_session(
            user_id=user["id"],
            ip_address=ip_address,
            user_agent=user_agent,
            expires_in_minutes=10  # Demo accounts auto-logout after 10 minutes
        )
        max_age = 10 * 60  # 10 minutes
    else:
        session_token = pg_auth.create_session(
            user_id=user["id"],
            ip_address=ip_address,
            user_agent=user_agent,
            expires_in_days=7
        )
        max_age = 7 * 24 * 60 * 60  # 7 days

    # Set session cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        max_age=max_age,
        samesite="lax",
        secure=COOKIE_SECURE
    )

    logger.info("AUDIT login user_id=%s username=%s ip=%s", user["id"], user["username"], ip_address)

    response_data = {
        "message": "Login successful",
        "user": user,
        "session_token": session_token  # Also return in body for mobile apps
    }

    # Add demo warning if applicable
    if is_demo_user:
        response_data["demo_warning"] = "Demo account - you will be automatically logged out after 10 minutes"

    return response_data

@app.post("/api/auth/logout")
async def logout(response: Response, auth = Depends(get_current_auth)):
    """Logout (delete current session)"""
    if AUTH_MODE != "full":
        return {"message": "Logout not needed in current auth mode"}
    
    # Only session-based auth can logout
    if auth.get("type") == "session":
        # Delete session cookie
        response.delete_cookie(key="session_token")
        return {"message": "Logged out successfully"}
    
    return {"message": "Not logged in via session"}

@app.post("/api/auth/register")
@limiter.limit("5/minute")
async def register(request: Request, body: RegisterRequest, response: Response):
    """Register a new user (only works in 'full' or 'smart' mode)"""
    if AUTH_MODE not in ["full", "smart"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Registration not available in '{AUTH_MODE}' mode. Set AUTH_MODE=full or smart to enable."
        )

    # Check if registration is allowed
    allow_registration = os.getenv("ALLOW_REGISTRATION", "false").lower() == "true"
    if not allow_registration:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is currently disabled. Contact your administrator."
        )

    # Require email for registration
    if not body.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required for registration"
        )

    try:
        user = pg_auth.create_user(
            username=body.username,
            password=body.password,
            email=body.email,
            full_name=body.full_name,
            is_admin=False
        )

        # Send verification email if email is configured
        if is_email_configured():
            try:
                # Use APP_URL if configured, otherwise fall back to request URL
                base_url = APP_URL or (request.url.scheme + "://" + request.url.netloc)
                verification_token = pg_auth.create_email_verification_token(user["id"])
                send_verification_email(body.email, body.username, verification_token, base_url)

                return {
                    "message": "Registration successful! Please check your email to verify your account.",
                    "email_sent": True,
                    "user": {
                        "id": user["id"],
                        "username": user["username"],
                        "email": user["email"]
                    }
                }
            except Exception as e:
                print(f"Failed to send verification email: {e}")
                # If email fails, still create account but inform user
                return {
                    "message": "Registration successful, but we couldn't send the verification email. Please contact your administrator.",
                    "email_sent": False,
                    "user": {
                        "id": user["id"],
                        "username": user["username"],
                        "email": user["email"]
                    }
                }
        else:
            # If email is not configured, auto-verify and auto-login
            # This maintains backwards compatibility for systems without email
            pg_auth.mark_email_verified(user["id"])

            # Auto-login after registration
            ip_address = request.client.host if request.client else None
            user_agent = request.headers.get("user-agent")

            session_token = pg_auth.create_session(
                user_id=user["id"],
                ip_address=ip_address,
                user_agent=user_agent,
                expires_in_days=7
            )

            response.set_cookie(
                key="session_token",
                value=session_token,
                httponly=True,
                max_age=7 * 24 * 60 * 60,
                samesite="lax",
                secure=COOKIE_SECURE
            )

            return {
                "message": "Registration successful (email verification disabled)",
                "user": user,
                "session_token": session_token
            }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/api/auth/me")
async def get_current_user(auth = Depends(get_current_auth)):
    """Get current authenticated user info"""
    return auth

@app.post("/api/auth/onboarding-done")
async def mark_onboarding_done(auth = Depends(get_current_auth)):
    """Mark onboarding as complete for the current session user"""
    if auth.get("type") == "session":
        pg_auth.mark_onboarding_done(auth["id"])
    return {"message": "ok"}

@app.post("/api/auth/change-password")
async def change_password(request: ChangePasswordRequest, auth = Depends(get_current_auth)):
    """Change password for current user"""
    if AUTH_MODE not in ["full", "smart"]:
        raise HTTPException(status_code=400, detail="Password change only available in 'full' or 'smart' mode")
    
    if auth.get("type") != "session":
        raise HTTPException(status_code=400, detail="Password change only available for logged-in users")
    
    # Verify current password
    user = pg_auth.authenticate_user(auth["username"], request.current_password)
    if not user:
        logger.warning("AUDIT failed_password_change user_id=%s username=%s", auth["id"], auth["username"])
        raise HTTPException(status_code=401, detail="Current password is incorrect")

    # Update password
    try:
        success = pg_auth.update_user_password(auth["id"], request.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if success:
        logger.info("AUDIT password_changed user_id=%s username=%s", auth["id"], auth["username"])
        return {"message": "Password changed successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to change password")

@app.post("/api/auth/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(request: Request, body: ForgotPasswordRequest):
    """Request password reset email"""
    if AUTH_MODE not in ["full", "smart"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset not available in current auth mode"
        )

    if not is_email_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Email service not configured. Contact your administrator."
        )

    # Look up user first to get username (don't reveal if email exists)
    user = pg_auth.find_user_by_email(body.email)
    token = pg_auth.create_password_reset_token(body.email) if user else None

    if token:
        try:
            # Use APP_URL if configured, otherwise fall back to request URL
            base_url = APP_URL or (request.url.scheme + "://" + request.url.netloc)
            send_password_reset_email(body.email, token, base_url, username=user["username"])
        except Exception as e:
            print(f"Failed to send reset email: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to send reset email. Please try again later."
            )
    
    # Always return success (don't reveal if email exists)
    return {
        "message": "If that email is registered, you'll receive a password reset link shortly."
    }

@app.post("/api/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password using token from email"""
    if AUTH_MODE not in ["full", "smart"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password reset not available in current auth mode"
        )
    
    success = pg_auth.use_reset_token(request.token, request.new_password)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

    return {"message": "Password reset successful. You can now login with your new password."}

@app.post("/api/auth/verify-email")
async def verify_email(request: VerifyEmailRequest):
    """Verify email address using token from email"""
    if AUTH_MODE not in ["full", "smart"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email verification not available in current auth mode"
        )

    success = pg_auth.verify_email_token(request.token)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )

    return {"message": "Email verified successfully! You can now login to your account."}

@app.post("/api/auth/resend-verification")
@limiter.limit("3/minute")
async def resend_verification(request: Request, body: ResendVerificationRequest):
    """Resend verification email"""
    if AUTH_MODE not in ["full", "smart"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email verification not available in current auth mode"
        )

    if not is_email_configured():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Email service is not configured"
        )

    # Find user by email using pg_auth helper
    user = pg_auth.find_user_by_email(body.email)

    if not user:
        # Don't reveal if email exists
        return {"message": "If that email is registered and unverified, you'll receive a verification link shortly."}

    if user['email_verified']:
        return {"message": "This email is already verified. You can login to your account."}

    # Create new verification token
    try:
        # Use APP_URL if configured, otherwise fall back to request URL
        base_url = APP_URL or (request.url.scheme + "://" + request.url.netloc)
        verification_token = pg_auth.create_email_verification_token(user['id'])
        send_verification_email(body.email, user['username'], verification_token, base_url)

        return {"message": "If that email is registered and unverified, you'll receive a verification link shortly."}
    except Exception as e:
        print(f"Failed to send verification email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email. Please try again later."
        )

# ============================================================================
# OIDC AUTHENTICATION (native token verification — Google, Apple)
# ============================================================================

class OidcAuthRequest(BaseModel):
    provider: str  # "google" | "apple"
    id_token: Optional[str] = None       # preferred — a signed JWT from the provider
    access_token: Optional[str] = None   # fallback — Google's native flow commonly yields this instead
    full_name: Optional[str] = None      # Apple only returns this on first sign-in


@app.post("/api/auth/oidc")
@limiter.limit("10/minute")
async def oidc_login(request: Request, body: OidcAuthRequest, response: Response):
    """
    Sign in or register using a token obtained natively on-device
    (expo-auth-session for Google, expo-apple-authentication for Apple).
    The client never talks to this server during the provider handshake —
    it hands us the already-issued token, and we verify/exchange it here.
    """
    try:
        if body.id_token:
            claims = await verify_id_token(body.provider, body.id_token)
        elif body.access_token:
            claims = await fetch_userinfo(body.provider, body.access_token)
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide id_token or access_token")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))

    provider_user_id = claims.get("sub")
    email = claims.get("email")
    email_verified = claims.get("email_verified", False)
    if not provider_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="ID token did not include a subject claim")

    connection = pg_auth.find_oidc_connection(body.provider, provider_user_id)

    if connection:
        if not connection["is_active"]:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is disabled")
        user_id = connection["user_id"]
        pg_auth.update_oidc_last_login(body.provider, provider_user_id)
    else:
        # Only link to an existing account if the provider has verified the
        # email — prevents account takeover via an unverified email claim.
        existing_user = pg_auth.find_user_by_email(email) if (email and email_verified) else None
        if existing_user:
            user_id = existing_user["id"]
            pg_auth.create_oidc_connection(user_id, body.provider, provider_user_id, email)
        else:
            username = email.split("@")[0] if email else f"{body.provider}_{provider_user_id[:8]}"
            new_user = pg_auth.create_user_from_oidc(
                username=username,
                email=email,
                full_name=body.full_name or claims.get("name"),
            )
            user_id = new_user["id"]
            pg_auth.create_oidc_connection(user_id, body.provider, provider_user_id, email)

    session_token = pg_auth.create_session(
        user_id=user_id,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
        expires_in_days=7,
    )

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        max_age=7 * 24 * 60 * 60,
        samesite="lax",
        secure=COOKIE_SECURE
    )

    return {
        "message": "Login successful",
        "user": pg_auth.get_user_by_id(user_id),
        "session_token": session_token,
    }


# ============================================================================
# GENERIC OIDC (redirect flow — self-hosted IdPs: Authentik, Keycloak, etc.)
# ============================================================================

@app.get("/api/auth/oidc/login")
async def oidc_redirect_login(request: Request, mobile_state: Optional[str] = None):
    """Start the authorization-code redirect flow against the configured IdP."""
    if not is_oidc_enabled():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="OIDC authentication is not enabled")

    # Stash mobile_state in the session so it can be echoed back after the
    # provider redirects to our callback.
    if mobile_state:
        request.session['mobile_state'] = mobile_state

    redirect_uri = request.url_for('oidc_redirect_callback')
    client = get_oauth_client()
    return await client.authorize_redirect(request, redirect_uri)


@app.get("/api/auth/oidc/callback")
async def oidc_redirect_callback(request: Request, response: Response):
    """Handle the IdP's redirect back after the user authenticates."""
    if not is_oidc_enabled():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="OIDC authentication is not enabled")

    try:
        client = get_oauth_client()
        token = await client.authorize_access_token(request)

        userinfo = token.get('userinfo')
        if not userinfo:
            userinfo = await client.userinfo(token=token)

        oidc_user = extract_user_info(userinfo)
    except Exception as e:
        logger.error("OIDC callback error: %s", e)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="OIDC authentication failed")

    provider_user_id = oidc_user['oidc_id']
    if not provider_user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Provider did not return a subject claim")

    connection = pg_auth.find_oidc_connection('oidc', provider_user_id)

    if connection:
        if not connection['is_active']:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User account is disabled")
        user_id = connection['user_id']
        pg_auth.update_oidc_last_login('oidc', provider_user_id)
    else:
        # Only auto-link to an existing account if the IdP has verified the
        # email — prevents account takeover via an unverified email claim.
        existing_user = None
        if OIDC_AUTO_LINK and oidc_user['email'] and oidc_user['email_verified']:
            existing_user = pg_auth.find_user_by_email(oidc_user['email'])

        if existing_user:
            user_id = existing_user['id']
            pg_auth.create_oidc_connection(user_id, 'oidc', provider_user_id, oidc_user['email'])
        elif OIDC_AUTO_CREATE:
            new_user = pg_auth.create_user_from_oidc(
                username=oidc_user['username'],
                email=oidc_user['email'],
                full_name=oidc_user['name'],
            )
            user_id = new_user['id']
            pg_auth.create_oidc_connection(user_id, 'oidc', provider_user_id, oidc_user['email'])
        else:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No account found. Please contact an administrator.")

    session_token = pg_auth.create_session(
        user_id=user_id,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("user-agent"),
    )

    mobile_state = request.session.pop('mobile_state', None)

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        max_age=30 * 24 * 60 * 60,
        samesite="lax",
        secure=COOKIE_SECURE
    )

    if mobile_state:
        import urllib.parse
        params = urllib.parse.urlencode({"token": session_token, "state": mobile_state})
        return RedirectResponse(url=f"pantrypal://auth?{params}")

    return {"status": "success", "message": "Successfully logged in via OIDC"}


# ============================================================================
# API KEY MANAGEMENT ENDPOINTS
# ============================================================================

@app.post("/api/auth/keys")
async def create_api_key(request: CreateApiKeyRequest, auth = Depends(get_current_auth)):
    """Create a new API key"""
    # Demo accounts cannot create API keys
    if auth.get("is_demo", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Demo accounts cannot create API keys. Please create a regular account to use API keys."
        )

    try:
        key_info = pg_api_keys.create_api_key(
            name=request.name,
            description=request.description,
            expires_in_days=request.expires_in_days,
            is_read_only=request.is_read_only
        )
        return {
            "message": "⚠️ Save this key now! It won't be shown again.",
            "api_key": key_info["key"],
            "key_info": {
                "id": key_info["id"],
                "name": key_info["name"],
                "description": key_info["description"],
                "created_at": key_info["created_at"],
                "expires_at": key_info["expires_at"],
                "is_read_only": key_info["is_read_only"],
            }
        }
    except Exception as e:
        logger.error("Failed to create API key: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create API key")

@app.get("/api/auth/keys")
async def list_api_keys(auth = Depends(get_current_auth)):
    """List all API keys (without exposing the actual key values)"""
    try:
        keys = pg_api_keys.list_api_keys()
        return {"keys": keys, "total": len(keys)}
    except Exception as e:
        logger.error("Failed to list API keys: %s", e)
        raise HTTPException(status_code=500, detail="Failed to list API keys")

@app.delete("/api/auth/keys/{key_id}")
async def delete_api_key(key_id: int, auth = Depends(get_current_auth)):
    """Permanently delete an API key"""
    try:
        success = pg_api_keys.delete_api_key(key_id)
        if not success:
            raise HTTPException(status_code=404, detail="API key not found")
        return {"message": "API key deleted successfully", "key_id": key_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete API key %s: %s", key_id, e)
        raise HTTPException(status_code=500, detail="Failed to delete API key")

@app.post("/api/auth/keys/{key_id}/revoke")
async def revoke_api_key(key_id: int, auth = Depends(get_current_auth)):
    """Revoke (deactivate) an API key without deleting it"""
    try:
        success = pg_api_keys.revoke_api_key(key_id)
        if not success:
            raise HTTPException(status_code=404, detail="API key not found")
        return {"message": "API key revoked successfully", "key_id": key_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to revoke API key %s: %s", key_id, e)
        raise HTTPException(status_code=500, detail="Failed to revoke API key")

# ============================================================================
# USER MANAGEMENT ENDPOINTS (Admin only)
# ============================================================================

@app.get("/api/users")
async def list_users(auth = Depends(require_admin)):
    """List all users (admin only)"""
    try:
        users = pg_auth.list_users()
        return {"users": users, "total": len(users)}
    except Exception as e:
        logger.error("Failed to list users: %s", e)
        raise HTTPException(status_code=500, detail="Failed to list users")

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: int, auth = Depends(require_admin)):
    """Delete a user (admin only)"""
    try:
        # Prevent deleting yourself
        if auth.get("user_id") == user_id:
            raise HTTPException(status_code=400, detail="Cannot delete your own account")
        
        success = pg_auth.delete_user(user_id)
        if not success:
            raise HTTPException(status_code=404, detail="User not found")
        return {"message": "User deleted successfully", "user_id": user_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to delete user %s: %s", user_id, e)
        raise HTTPException(status_code=500, detail="Failed to delete user")

# ============================================================================
# PROTECTED ENDPOINTS (Require authentication based on AUTH_MODE)
# ============================================================================

@app.get("/api/lookup/{barcode}")
async def lookup_barcode(barcode: str, request: Request, auth = Depends(get_current_auth)):
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.get(f"{LOOKUP_SERVICE_URL}/lookup/{barcode}", timeout=10.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.error("Lookup service error: %s", e)
        raise HTTPException(status_code=500, detail="Lookup service unavailable")

@app.post("/api/items")
async def add_item(request: AddItemRequest, auth = Depends(require_write_scope)):
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            lookup_response = await client.get(f"{LOOKUP_SERVICE_URL}/lookup/{request.barcode}", timeout=10.0)
            
            if lookup_response.status_code == 200:
                product_info = lookup_response.json()
            else:
                product_info = {
                    "barcode": request.barcode,
                    "name": f"Unknown Product ({request.barcode})",
                    "brand": None,
                    "image_url": None,
                    "category": "Uncategorized",
                    "found": False
                }
            
            inventory_data = {
                "barcode": request.barcode,
                "name": product_info.get("name", request.barcode),
                "brand": product_info.get("brand"),
                "image_url": product_info.get("image_url"),
                "category": product_info.get("category", "Uncategorized"),
                "location": request.location,
                "quantity": request.quantity,
                "expiry_date": request.expiry_date,
                "manually_added": False
            }
            
            inventory_response = await client.post(f"{INVENTORY_SERVICE_URL}/items", json=inventory_data, timeout=5.0)
            inventory_response.raise_for_status()
            
            result = inventory_response.json()
            result["product_info"] = product_info
            return result
    except httpx.HTTPError as e:
        logger.error("Service error: %s", e)
        raise HTTPException(status_code=500, detail="Service unavailable")

@app.post("/api/items/manual")
async def add_item_manual(request: ManualAddRequest, auth = Depends(require_write_scope)):
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            inventory_data = {
                "barcode": request.barcode,
                "name": request.name,
                "brand": request.brand,
                "image_url": None,
                "category": request.category,
                "location": request.location,
                "quantity": request.quantity,
                "expiry_date": request.expiry_date,
                "notes": request.notes,
                "manually_added": True
            }
            response = await client.post(f"{INVENTORY_SERVICE_URL}/items", json=inventory_data, timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.error("Inventory service error: %s", e)
        raise HTTPException(status_code=500, detail="Inventory service unavailable")

@app.get("/api/items")
async def get_items(location: Optional[str] = None, search: Optional[str] = None, limit: Optional[int] = None, offset: int = 0, auth = Depends(get_current_auth)):
    try:
        params = {}
        if location:
            params["location"] = location
        if search:
            params["search"] = search
        if limit is not None:
            params["limit"] = limit
            params["offset"] = offset
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.get(f"{INVENTORY_SERVICE_URL}/items", params=params, timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.error("Inventory service error: %s", e)
        raise HTTPException(status_code=500, detail="Inventory service unavailable")

@app.get("/api/items/{item_id}")
async def get_item(item_id: int, auth = Depends(get_current_auth)):
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.get(f"{INVENTORY_SERVICE_URL}/items/{item_id}", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Item not found")
        logger.error("Inventory service error: %s", e)
        raise HTTPException(status_code=500, detail="Inventory service unavailable")

@app.put("/api/items/{item_id}")
async def update_item(item_id: int, request: UpdateItemRequest, auth = Depends(require_write_scope)):
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.put(f"{INVENTORY_SERVICE_URL}/items/{item_id}", json=request.dict(exclude_unset=True), timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Item not found")
        logger.error("Inventory service error: %s", e)
        raise HTTPException(status_code=500, detail="Inventory service unavailable")

@app.get("/api/export/csv")
async def export_csv(auth = Depends(get_current_auth)):
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.get(f"{INVENTORY_SERVICE_URL}/export/csv", timeout=30.0)
            response.raise_for_status()
            return Response(
                content=response.content,
                media_type="text/csv",
                headers={"Content-Disposition": response.headers.get("Content-Disposition", "attachment; filename=pantrypal_export.csv")}
            )
    except httpx.HTTPError as e:
        logger.error("Export failed: %s", e)
        raise HTTPException(status_code=500, detail="Export failed")

@app.delete("/api/items/{item_id}")
async def delete_item(item_id: int, auth = Depends(require_write_scope)):
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.delete(f"{INVENTORY_SERVICE_URL}/items/{item_id}", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Item not found")
        logger.error("Inventory service error: %s", e)
        raise HTTPException(status_code=500, detail="Inventory service unavailable")

@app.get("/api/locations")
async def get_locations(auth = Depends(get_current_auth)):
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.get(f"{INVENTORY_SERVICE_URL}/locations", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.error("Inventory service error: %s", e)
        raise HTTPException(status_code=500, detail="Inventory service unavailable")

@app.post("/api/locations")
async def create_location(request: CreateLocationRequest, auth = Depends(require_write_scope)):
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.post(f"{INVENTORY_SERVICE_URL}/locations", json=request.dict(), timeout=5.0)
            if response.status_code == 409:
                raise HTTPException(status_code=409, detail="Location already exists")
            response.raise_for_status()
            return response.json()
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error("Inventory service error: %s", e)
        raise HTTPException(status_code=500, detail="Inventory service unavailable")

@app.delete("/api/locations/{location_name}")
async def delete_location(location_name: str, auth = Depends(require_write_scope)):
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.delete(f"{INVENTORY_SERVICE_URL}/locations/{location_name}", timeout=5.0)
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Location not found")
            response.raise_for_status()
            return response.json()
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error("Inventory service error: %s", e)
        raise HTTPException(status_code=500, detail="Inventory service unavailable")

@app.get("/api/categories")
async def get_categories(auth = Depends(get_current_auth)):
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.get(f"{INVENTORY_SERVICE_URL}/categories", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.error("Inventory service error: %s", e)
        raise HTTPException(status_code=500, detail="Inventory service unavailable")

@app.post("/api/categories")
async def create_category(request: CreateCategoryRequest, auth = Depends(require_write_scope)):
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.post(f"{INVENTORY_SERVICE_URL}/categories", json=request.dict(), timeout=5.0)
            if response.status_code == 409:
                raise HTTPException(status_code=409, detail="Category already exists")
            response.raise_for_status()
            return response.json()
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error("Inventory service error: %s", e)
        raise HTTPException(status_code=500, detail="Inventory service unavailable")

@app.delete("/api/categories/{category_id}")
async def delete_category(category_id: int, auth = Depends(require_write_scope)):
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.delete(f"{INVENTORY_SERVICE_URL}/categories/{category_id}", timeout=5.0)
            if response.status_code == 404:
                raise HTTPException(status_code=404, detail="Category not found")
            response.raise_for_status()
            return response.json()
    except HTTPException:
        raise
    except httpx.HTTPError as e:
        logger.error("Inventory service error: %s", e)
        raise HTTPException(status_code=500, detail="Inventory service unavailable")
    
@app.get("/api/stats")
async def get_stats(auth = Depends(get_current_auth)):
    """Aggregate inventory statistics for the mobile server stats screen"""
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            items_resp, locations_resp, categories_resp = await asyncio.gather(
                client.get(f"{INVENTORY_SERVICE_URL}/items", timeout=10.0),
                client.get(f"{INVENTORY_SERVICE_URL}/locations", timeout=5.0),
                client.get(f"{INVENTORY_SERVICE_URL}/categories", timeout=5.0),
            )
            items_resp.raise_for_status()
            items = items_resp.json()

            today = datetime.now().date()
            expiring_soon = 0
            expired = 0
            no_date = 0
            total_quantity = 0
            manually_added = 0
            # Facet counts, so the sidebar can render "Fridge 12" without
            # holding every item. It used to derive these client-side from
            # useItems(), which is paginated at 50 -- a 96-item pantry showed
            # "50" and listed only the locations that happened to land on the
            # first page. These are computed over the full set.
            location_counts: dict[str, int] = {}
            category_counts: dict[str, int] = {}
            for item in items:
                total_quantity += item.get("quantity", 0)
                if item.get("manually_added"):
                    manually_added += 1

                # Only SET values. These lists drive the sidebar's filter
                # rows, and `GET /items?location=` has no is-null option, so
                # an "Uncategorized" row would be a control that filters to
                # nothing. Counting them would be honest; offering them as a
                # filter would not.
                if item.get("location"):
                    location_counts[item["location"]] = location_counts.get(item["location"], 0) + 1
                if item.get("category"):
                    category_counts[item["category"]] = category_counts.get(item["category"], 0) + 1

                if item.get("expiry_date"):
                    try:
                        days_left = (datetime.fromisoformat(item["expiry_date"]).date() - today).days
                        # The three buckets are exclusive and, with no_date,
                        # exhaustive -- they have to sum to total_items or the
                        # Insights donut misreports.
                        if days_left < 0:
                            expired += 1
                        elif days_left <= 7:
                            expiring_soon += 1
                    except (ValueError, TypeError):
                        no_date += 1
                else:
                    no_date += 1

            dated = len(items) - no_date
            fresh = dated - expiring_soon - expired

            locations_count = len(locations_resp.json()) if locations_resp.is_success else 0
            categories_count = len(categories_resp.json()) if categories_resp.is_success else 0

            def _facet(counts: dict[str, int]) -> list[dict]:
                return [
                    {"name": name, "count": count}
                    for name, count in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
                ]

            # Every pre-existing key is kept as-is: the mobile server-stats
            # screen reads this endpoint too, so the new fields are additive.
            return {
                "total_items": len(items),
                "total_quantity": total_quantity,
                "expiring_soon": expiring_soon,
                "expired": expired,
                "fresh": fresh,
                "no_date": no_date,
                "locations_count": locations_count,
                "categories_count": categories_count,
                "manually_added_count": manually_added,
                "locations": _facet(location_counts),
                "categories": _facet(category_counts),
            }
    except httpx.HTTPError as e:
        logger.error("Stats service error: %s", e)
        raise HTTPException(status_code=500, detail="Could not load statistics")


@app.get("/api/stats/expiring")
async def get_expiring_items(days: int = 7, auth = Depends(get_current_auth)):
    """Get items expiring within specified days"""
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.get(f"{INVENTORY_SERVICE_URL}/items", timeout=5.0)
            response.raise_for_status()
            items = response.json()
            
            items_with_expiry = [item for item in items if item.get('expiry_date')]
            today = datetime.now().date()
            
            expired = []
            critical = []  
            warning = []   
            upcoming = []  
            
            for item in items_with_expiry:
                try:
                    expiry_date = datetime.fromisoformat(item['expiry_date']).date()
                    days_until = (expiry_date - today).days
                    
                    item_info = {
                        'id': item['id'],
                        'name': item['name'],
                        'brand': item.get('brand'),
                        'location': item['location'],
                        'category': item.get('category', 'Uncategorized'),
                        'quantity': item['quantity'],
                        'expiry_date': item['expiry_date'],
                        'days_until_expiry': days_until
                    }
                    
                    if days_until < 0:
                        expired.append(item_info)
                    elif days_until <= 3:
                        critical.append(item_info)
                    elif days_until <= 7:
                        warning.append(item_info)
                    elif days_until <= days:
                        upcoming.append(item_info)
                        
                except (ValueError, TypeError):
                    continue
            
            expired.sort(key=lambda x: x['days_until_expiry'])
            critical.sort(key=lambda x: x['days_until_expiry'])
            warning.sort(key=lambda x: x['days_until_expiry'])
            upcoming.sort(key=lambda x: x['days_until_expiry'])
            
            return {
                'summary': {
                    'expired': len(expired),
                    'critical': len(critical),
                    'warning': len(warning),
                    'upcoming': len(upcoming),
                    'total_expiring': len(expired) + len(critical) + len(warning)
                },
                'items': {
                    'expired': expired,
                    'critical': critical,
                    'warning': warning,
                    'upcoming': upcoming
                },
                'generated_at': datetime.now().isoformat()
            }
            
    except httpx.HTTPError as e:
        logger.error("Inventory service error: %s", e)
        raise HTTPException(status_code=500, detail="Inventory service unavailable")

# ============================================================================
# SHOPPING LIST ENDPOINTS
# ============================================================================

@app.get("/api/shopping-list")
async def get_shopping_list(include_checked: bool = False, auth = Depends(get_current_auth)):
    """Get shopping list items"""
    try:
        params = {"include_checked": include_checked}
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.get(f"{INVENTORY_SERVICE_URL}/shopping-list", params=params, timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.error("Shopping list service error: %s", e)
        raise HTTPException(status_code=500, detail="Shopping list service unavailable")

@app.post("/api/shopping-list")
async def create_shopping_list_item(item: dict, auth = Depends(require_write_scope)):
    """Add item to shopping list"""
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.post(f"{INVENTORY_SERVICE_URL}/shopping-list", json=item, timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.error("Shopping list service error: %s", e)
        raise HTTPException(status_code=500, detail="Shopping list service unavailable")

@app.get("/api/shopping-list/{item_id}")
async def get_shopping_list_item(item_id: int, auth = Depends(get_current_auth)):
    """Get specific shopping list item"""
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.get(f"{INVENTORY_SERVICE_URL}/shopping-list/{item_id}", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Shopping list item not found")
        logger.error("Shopping list service error: %s", e)
        raise HTTPException(status_code=500, detail="Shopping list service unavailable")

@app.put("/api/shopping-list/{item_id}")
async def update_shopping_list_item(item_id: int, item_update: dict, auth = Depends(require_write_scope)):
    """Update shopping list item"""
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.put(f"{INVENTORY_SERVICE_URL}/shopping-list/{item_id}", json=item_update, timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Shopping list item not found")
        logger.error("Shopping list service error: %s", e)
        raise HTTPException(status_code=500, detail="Shopping list service unavailable")

@app.delete("/api/shopping-list/{item_id}")
async def delete_shopping_list_item(item_id: int, auth = Depends(require_write_scope)):
    """Delete shopping list item"""
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.delete(f"{INVENTORY_SERVICE_URL}/shopping-list/{item_id}", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Shopping list item not found")
        logger.error("Shopping list service error: %s", e)
        raise HTTPException(status_code=500, detail="Shopping list service unavailable")

@app.post("/api/shopping-list/from-inventory/{inventory_id}")
async def add_from_inventory_to_shopping_list(inventory_id: int, auth = Depends(require_write_scope)):
    """Add inventory item to shopping list"""
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.post(f"{INVENTORY_SERVICE_URL}/shopping-list/from-inventory/{inventory_id}", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Inventory item not found")
        logger.error("Shopping list service error: %s", e)
        raise HTTPException(status_code=500, detail="Shopping list service unavailable")

@app.post("/api/shopping-list/add-checked-to-inventory")
async def add_checked_to_inventory(auth = Depends(require_write_scope)):
    """Move checked shopping list items to inventory"""
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.post(f"{INVENTORY_SERVICE_URL}/shopping-list/add-checked-to-inventory", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.error("Shopping list service error: %s", e)
        raise HTTPException(status_code=500, detail="Shopping list service unavailable")

@app.post("/api/shopping-list/suggest-low-stock")
async def suggest_low_stock(auth = Depends(get_current_auth)):
    """Add low stock items to shopping list"""
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.post(f"{INVENTORY_SERVICE_URL}/shopping-list/suggest-low-stock", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.error("Shopping list service error: %s", e)
        raise HTTPException(status_code=500, detail="Shopping list service unavailable")

@app.delete("/api/shopping-list/clear-checked")
async def clear_checked_shopping_items(auth = Depends(require_write_scope)):
    """Clear all checked items from shopping list"""
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.delete(f"{INVENTORY_SERVICE_URL}/shopping-list/clear-checked", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.error("Shopping list service error: %s", e)
        raise HTTPException(status_code=500, detail="Shopping list service unavailable")

# ============================================================================
# HOME ASSISTANT SHOPPING LIST INTEGRATION
# ============================================================================

@app.get("/api/homeassistant/shopping-list")
async def homeassistant_get_shopping_list(auth=Depends(get_current_auth)):
    """Get shopping list in Home Assistant format"""
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.get(f"{INVENTORY_SERVICE_URL}/shopping-list", params={"include_checked": False}, timeout=5.0)
            response.raise_for_status()
            items = response.json()

            # Convert to Home Assistant format
            ha_items = []
            for item in items:
                ha_items.append({
                    "id": str(item["id"]),
                    "name": f"{item['name']}" + (f" ({item['brand']})" if item.get('brand') else ""),
                    "complete": item["checked"]
                })

            return ha_items
    except httpx.HTTPError as e:
        logger.error("Shopping list service error: %s", e)
        raise HTTPException(status_code=500, detail="Shopping list service unavailable")

@app.post("/api/homeassistant/shopping-list/item")
async def homeassistant_add_shopping_list_item(item: dict, auth=Depends(require_write_scope)):
    """Add item to shopping list in Home Assistant format"""
    try:
        # Convert from Home Assistant format to PantryPal format
        pantrypal_item = {
            "name": item.get("name", "Unknown Item"),
            "brand": None,
            "category": "Uncategorized",
            "quantity": 1,
            "notes": "Added from Home Assistant",
            "checked": False
        }

        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.post(f"{INVENTORY_SERVICE_URL}/shopping-list", json=pantrypal_item, timeout=5.0)
            response.raise_for_status()
            result = response.json()

            # Convert response to Home Assistant format
            return {
                "id": str(result["id"]),
                "name": result["name"],
                "complete": result["checked"]
            }
    except httpx.HTTPError as e:
        logger.error("Shopping list service error: %s", e)
        raise HTTPException(status_code=500, detail="Shopping list service unavailable")

@app.post("/api/homeassistant/shopping-list/item/{item_id}")
async def homeassistant_update_shopping_list_item(item_id: str, item: dict, auth=Depends(require_write_scope)):
    """Update shopping list item in Home Assistant format"""
    try:
        # Convert from Home Assistant format
        update_data = {}
        if "name" in item:
            update_data["name"] = item["name"]
        if "complete" in item:
            update_data["checked"] = item["complete"]

        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.put(f"{INVENTORY_SERVICE_URL}/shopping-list/{item_id}", json=update_data, timeout=5.0)
            response.raise_for_status()
            result = response.json()

            # Convert response to Home Assistant format
            return {
                "id": str(result["id"]),
                "name": result["name"],
                "complete": result["checked"]
            }
    except httpx.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Shopping list item not found")
        logger.error("Shopping list service error: %s", e)
        raise HTTPException(status_code=500, detail="Shopping list service unavailable")

@app.delete("/api/homeassistant/shopping-list/item/{item_id}")
async def homeassistant_delete_shopping_list_item(item_id: str, auth=Depends(require_write_scope)):
    """Delete shopping list item in Home Assistant format"""
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.delete(f"{INVENTORY_SERVICE_URL}/shopping-list/{item_id}", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Shopping list item not found")
        logger.error("Shopping list service error: %s", e)
        raise HTTPException(status_code=500, detail="Shopping list service unavailable")

@app.post("/api/homeassistant/shopping-list/clear-items")
async def homeassistant_clear_shopping_list(auth=Depends(require_write_scope)):
    """Clear all completed items from shopping list (Home Assistant format)"""
    try:
        async with httpx.AsyncClient(headers=_INTERNAL_HEADERS) as client:
            response = await client.delete(f"{INVENTORY_SERVICE_URL}/shopping-list/clear-checked", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        logger.error("Shopping list service error: %s", e)
        raise HTTPException(status_code=500, detail="Shopping list service unavailable")

# ============================================================================
# NOTIFICATION PREFERENCES
# ============================================================================

_DEFAULT_NOTIFICATION_PREFS = {
    'notify_expired': True,
    'notify_tomorrow': True,
    'notify_soon': True,
    'notify_reminder': True,
    'notification_time': '09:00',
    'warning_threshold': 7,
    'critical_threshold': 3,
}

@app.get("/api/notifications/preferences")
async def get_notification_preferences(auth = Depends(get_current_auth)):
    """Get notification preferences for the current user"""
    from .database import SessionLocal
    from .models import NotificationPreferences
    user_id = auth.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        db = SessionLocal()
        try:
            row = db.query(NotificationPreferences).filter_by(user_id=user_id).first()
            if row:
                return {
                    'notify_expired': row.notify_expired,
                    'notify_tomorrow': row.notify_tomorrow,
                    'notify_soon': row.notify_soon,
                    'notify_reminder': row.notify_reminder,
                    'notification_time': row.notification_time,
                    'warning_threshold': row.warning_threshold,
                    'critical_threshold': row.critical_threshold,
                }
            return {**_DEFAULT_NOTIFICATION_PREFS}
        finally:
            db.close()
    except Exception as e:
        logger.error("Failed to get notification preferences: %s", e)
        raise HTTPException(status_code=500, detail="Failed to get preferences")

@app.post("/api/notifications/preferences")
async def save_notification_preferences(preferences: dict, auth = Depends(get_current_auth)):
    """Save notification preferences for the current user"""
    from .database import SessionLocal
    from .models import NotificationPreferences
    import uuid as _uuid
    user_id = auth.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        db = SessionLocal()
        try:
            row = db.query(NotificationPreferences).filter_by(user_id=user_id).first()
            if row:
                for key in _DEFAULT_NOTIFICATION_PREFS:
                    if key in preferences:
                        setattr(row, key, preferences[key])
            else:
                row = NotificationPreferences(
                    id=str(_uuid.uuid4()),
                    user_id=user_id,
                    notify_expired=preferences.get('notify_expired', True),
                    notify_tomorrow=preferences.get('notify_tomorrow', True),
                    notify_soon=preferences.get('notify_soon', True),
                    notify_reminder=preferences.get('notify_reminder', True),
                    notification_time=preferences.get('notification_time', '09:00'),
                    warning_threshold=preferences.get('warning_threshold', 7),
                    critical_threshold=preferences.get('critical_threshold', 3),
                )
                db.add(row)
            db.commit()
            return {'status': 'success', 'preferences': preferences}
        finally:
            db.close()
    except Exception as e:
        logger.error("Failed to save notification preferences: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save preferences")

# ============================================================================
# CATEGORY OVERRIDES
# ============================================================================

@app.get("/api/category-overrides")
async def get_category_overrides(auth = Depends(get_current_auth)):
    """Get all category overrides for the current user"""
    from .database import SessionLocal
    from .models import CategoryOverride
    user_id = auth.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        db = SessionLocal()
        try:
            rows = db.query(CategoryOverride).filter_by(user_id=user_id).all()
            return {row.key: row.category for row in rows}
        finally:
            db.close()
    except Exception as e:
        logger.error("Failed to get category overrides: %s", e)
        raise HTTPException(status_code=500, detail="Failed to get category overrides")

@app.post("/api/category-overrides")
async def save_category_overrides(overrides: dict, auth = Depends(get_current_auth)):
    """Upsert category overrides for the current user"""
    from .database import SessionLocal
    from .models import CategoryOverride
    user_id = auth.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    if not overrides:
        return {"status": "ok", "upserted": 0}
    try:
        db = SessionLocal()
        try:
            for key, category in overrides.items():
                if not isinstance(key, str) or not isinstance(category, str):
                    continue
                if not key or not category or category == "Uncategorized":
                    continue
                row = db.query(CategoryOverride).filter_by(user_id=user_id, key=key).first()
                if row:
                    row.category = category
                else:
                    db.add(CategoryOverride(user_id=user_id, key=key, category=category))
            db.commit()
            return {"status": "ok", "upserted": len(overrides)}
        finally:
            db.close()
    except Exception as e:
        logger.error("Failed to save category overrides: %s", e)
        raise HTTPException(status_code=500, detail="Failed to save category overrides")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    timezone: Optional[str] = None

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class AdminUpdateUserRequest(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    is_admin: Optional[bool] = None

class AdminResetPasswordRequest(BaseModel):
    new_password: str

class AdminCreateUserRequest(BaseModel):
    username: str
    email: EmailStr
    full_name: Optional[str] = None
    send_welcome_email: bool = True


@app.get("/api/users/me")
async def get_my_profile(auth = Depends(get_current_auth)):
    """Get current user's profile"""
    if auth.get("type") != "session":
        raise HTTPException(status_code=403, detail="Profile only available for logged-in users")

    from .database import SessionLocal
    from .models import User as UserModel
    db = SessionLocal()
    try:
        user = db.query(UserModel).filter(UserModel.id == auth["id"]).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        return {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "full_name": user.full_name,
            "is_admin": user.is_admin,
            "timezone": user.timezone,
        }
    finally:
        db.close()

@app.patch("/api/users/me")
async def update_my_profile(
    profile: UpdateProfileRequest,
    auth = Depends(get_current_auth)
):
    """Update current user's profile (username, email, full name)"""
    if auth.get("type") != "session":
        raise HTTPException(status_code=403, detail="Profile update only available for logged-in users")

    # Validate username if provided
    if profile.username is not None and len(profile.username.strip()) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")

    # Check if any updates provided
    if profile.username is None and profile.email is None and profile.full_name is None and profile.timezone is None:
        return {"message": "No changes made"}

    # Use pg_auth helper to update profile (handles uniqueness checks)
    try:
        success = pg_auth.update_user_profile(
            user_id=auth["id"],
            username=profile.username,
            email=profile.email,
            full_name=profile.full_name,
            timezone=profile.timezone,
        )
        if success:
            return {"message": "Profile updated successfully"}
        else:
            raise HTTPException(status_code=404, detail="User not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/users/me/change-password")
async def change_my_password(
    password_data: ChangePasswordRequest,
    auth = Depends(get_current_auth)
):
    """Change current user's password"""
    if auth.get("type") != "session":
        raise HTTPException(status_code=403, detail="Password change only available for logged-in users")

    # Verify current password using pg_auth helper
    user = pg_auth.authenticate_user(auth["username"], password_data.current_password)
    if not user:
        logger.warning("AUDIT failed_password_change user_id=%s username=%s", auth["id"], auth["username"])
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    # Update password using pg_auth helper
    try:
        success = pg_auth.update_user_password(auth["id"], password_data.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not success:
        raise HTTPException(status_code=404, detail="User not found")

    logger.info("AUDIT password_changed user_id=%s username=%s", auth["id"], auth["username"])
    return {"message": "Password changed successfully"}

# ============================================
# Admin Endpoints (add these)
# ============================================

@app.get("/api/admin/users")
async def list_all_users(auth = Depends(require_admin)):
    """List all users (admin only)"""
    users = pg_auth.list_users()
    return {
        "total": len(users),
        "users": users
    }

@app.get("/api/admin/users/{user_id}")
async def get_user_details(user_id: str, auth = Depends(require_admin)):
    """Get specific user details (admin only)"""
    user = pg_auth.get_user_by_id(user_id)

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user

@app.patch("/api/admin/users/{user_id}")
async def update_user(
    user_id: str,
    user_data: AdminUpdateUserRequest,
    auth = Depends(require_admin)
):
    """Update user details (admin only)"""
    # Don't allow modifying yourself
    if user_id == auth["id"]:
        raise HTTPException(status_code=400, detail="Cannot modify your own account status")

    # Check user exists
    target_user = pg_auth.get_user_by_id(user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    changes_made = False

    # Update profile fields (email, full_name)
    if user_data.email is not None or user_data.full_name is not None:
        # Check email uniqueness if changing email
        if user_data.email is not None:
            existing = pg_auth.find_user_by_email(user_data.email)
            if existing and existing["id"] != user_id:
                raise HTTPException(status_code=400, detail="Email already in use")

        success = pg_auth.update_user_profile(
            user_id=user_id,
            email=user_data.email,
            full_name=user_data.full_name
        )
        if success:
            changes_made = True

    # Update status fields (is_active, is_admin)
    if user_data.is_active is not None or user_data.is_admin is not None:
        # If demoting from admin, check this isn't the last admin
        if user_data.is_admin is False and target_user.get("is_admin"):
            # Count current admins
            all_users = pg_auth.list_users()
            admin_count = sum(1 for u in all_users if u.get("is_admin"))
            if admin_count <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot remove admin status from the last admin user"
                )

        success = pg_auth.update_user_status(
            user_id=user_id,
            is_active=user_data.is_active,
            is_admin=user_data.is_admin
        )
        if success:
            changes_made = True

    if not changes_made:
        return {"message": "No changes made"}

    return {"message": "User updated successfully"}

@app.post("/api/admin/users/{user_id}/resend-invite")
async def admin_resend_invite(
    user_id: str,
    request: Request,
    auth = Depends(require_admin)
):
    """Resend welcome/invite email with a fresh password reset link (admin only)"""
    if not is_email_configured():
        raise HTTPException(status_code=400, detail="Email is not configured on this server")

    user = pg_auth.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        base_url = str(request.base_url).rstrip("/")
        import os as _os
        app_url = _os.environ.get("APP_URL", "").rstrip("/")
        if app_url:
            base_url = app_url

        reset_token = pg_auth.create_password_reset_token(user["email"])
        if not reset_token:
            raise HTTPException(status_code=500, detail="Failed to create reset token")

        send_welcome_email(user["email"], user["username"], base_url, reset_token)
        return {"message": f"Invite resent to {user['email']}"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to send invite: %s", e)
        raise HTTPException(status_code=500, detail="Failed to send invite")


@app.post("/api/admin/users/{user_id}/reset-password")
async def admin_reset_password(
    user_id: str,
    password_data: AdminResetPasswordRequest,
    auth = Depends(require_admin)
):
    """Reset user's password (admin only)"""
    success = pg_auth.update_user_password(user_id, password_data.new_password)
    
    if not success:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Password reset successfully"}

@app.post("/api/admin/users")
async def create_user_by_admin(
    request: AdminCreateUserRequest,
    http_req: Request,
    auth = Depends(require_admin)
):
    """Create a new user (admin only)"""
    if AUTH_MODE not in ["full", "smart"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User creation not available in current auth mode"
        )

    # Check if username already exists using pg_auth helper
    if pg_auth.find_user_by_username(request.username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )

    # Check if email already exists using pg_auth helper
    if pg_auth.find_user_by_email(request.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already in use"
        )

    # Generate a temporary random password (user will reset it via email)
    import secrets
    import string
    temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(16))

    try:
        # Create the user with the temporary password
        user = pg_auth.create_user(
            username=request.username,
            password=temp_password,
            email=request.email,
            full_name=request.full_name,
            is_admin=False
        )

        # Mark user as email verified (admin-created users don't need verification)
        pg_auth.mark_email_verified(user["id"])

        # Send welcome email with password reset link if email is configured
        if request.send_welcome_email and is_email_configured():
            try:
                # Use APP_URL if configured, otherwise fall back to request URL
                base_url = APP_URL or (http_req.url.scheme + "://" + http_req.url.netloc)

                # Create password reset token
                reset_token = pg_auth.create_password_reset_token(request.email)

                # Send ONE combined welcome email with password reset link
                send_welcome_email(request.email, request.username, base_url, reset_token)

                return {
                    "message": f"User {request.username} created successfully! Welcome email with password setup link sent.",
                    "email_sent": True,
                    "user": {
                        "id": user["id"],
                        "username": user["username"],
                        "email": user["email"],
                        "full_name": user.get("full_name")
                    }
                }
            except Exception as e:
                print(f"Failed to send welcome email: {e}")
                # User created but email failed
                return {
                    "message": f"User {request.username} created, but failed to send welcome email.",
                    "email_sent": False,
                    "user": {
                        "id": user["id"],
                        "username": user["username"],
                        "email": user["email"],
                        "full_name": user.get("full_name")
                    }
                }
        else:
            # Email not configured or not requested
            return {
                "message": f"User {request.username} created successfully!",
                "email_sent": False,
                "user": {
                    "id": user["id"],
                    "username": user["username"],
                    "email": user["email"],
                    "full_name": user.get("full_name")
                }
            }

    except Exception as e:
        logger.error("Failed to create user: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )

@app.delete("/api/admin/users/{user_id}")
async def delete_user_account(user_id: str, auth = Depends(require_admin)):
    """Delete user account (admin only)"""
    # Don't allow deleting yourself
    if user_id == auth["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    success = pg_auth.delete_user(user_id)

    if not success:
        raise HTTPException(status_code=404, detail="User not found")

    return {"message": "User deleted successfully"}

@app.get("/api/admin/stats")
async def get_admin_stats(auth = Depends(require_admin)):
    """Get system statistics (admin only)"""
    users = pg_auth.list_users()
    
    total_users = len(users)
    active_users = sum(1 for u in users if u["is_active"])
    inactive_users = total_users - active_users
    admin_users = sum(1 for u in users if u["is_admin"])
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "inactive_users": inactive_users,
        "admin_users": admin_users
    }
