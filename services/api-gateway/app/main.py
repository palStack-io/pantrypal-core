from fastapi import FastAPI, HTTPException, Depends, Response, Request, status
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
from typing import Optional
import httpx
import os
from pydantic import BaseModel, EmailStr
from typing import Optional
from .network_utils import get_client_ip, is_trusted_network


# Import auth modules
from .auth import get_current_auth, require_admin
from . import pg_api_keys, pg_auth
from .email_service import send_password_reset_email, send_welcome_email, send_verification_email, is_email_configured
from .oidc import is_oidc_enabled, get_oidc_config, oauth, extract_user_info

# Import database and services
from .database import init_db
from .minio_service import get_minio_service

# Import routers
from .routes import images, recipes

app = FastAPI(title="PantryPal API Gateway", version="2.0.0")

# Startup event: Initialize database and MinIO
@app.on_event("startup")
async def startup_event():
    """Initialize database tables and MinIO buckets"""
    print("🚀 Starting PantryPal API Gateway...")

    # Initialize PostgreSQL database
    try:
        init_db()
        print("✓ Database tables initialized")
    except Exception as e:
        print(f"⚠️  Database initialization warning: {e}")

    # Initialize MinIO buckets
    try:
        minio = get_minio_service()
        print("✓ MinIO service initialized")
    except Exception as e:
        print(f"⚠️  MinIO initialization warning: {e}")

    print("✓ PantryPal API Gateway ready")

# Include routers
app.include_router(images.router)
app.include_router(recipes.router)

# Get AUTH_MODE for informational purposes
AUTH_MODE = os.getenv("AUTH_MODE", "none").lower()

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

class CreateApiKeyRequest(BaseModel):
    name: str
    description: Optional[str] = None
    expires_in_days: Optional[int] = None

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
        async with httpx.AsyncClient() as client:
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
        return {"status": "degraded", "error": str(e)}

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
        response["demo_accounts"] = [
            {"username": "demo1", "password": "demo123"},
            {"username": "demo2", "password": "demo123"},
            {"username": "demo3", "password": "demo123"},
            {"username": "demo4", "password": "demo123"}
        ]
        response["demo_session_minutes"] = 10

    # Add OIDC config if enabled
    oidc_config = get_oidc_config()
    if oidc_config:
        response["oidc"] = oidc_config

    return response

# ============================================================================
# AUTHENTICATION ENDPOINTS (Login/Logout/Register)
# ============================================================================

@app.post("/api/auth/login")
async def login(request: LoginRequest, response: Response, http_request: Request):
    """Login with username and password (works in 'full' or 'smart' mode)"""
    if AUTH_MODE not in ["full", "smart"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Login not available in '{AUTH_MODE}' mode. Set AUTH_MODE=full or smart to enable."
        )
    
    user = pg_auth.authenticate_user(request.username, request.password)

    if not user:
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
    ip_address = http_request.client.host if http_request.client else None
    user_agent = http_request.headers.get("user-agent")

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
        secure=False  # Set to True in production with HTTPS
    )

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
async def register(request: RegisterRequest, response: Response, http_request: Request):
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
    if not request.email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required for registration"
        )
    
    try:
        user = pg_auth.create_user(
            username=request.username,
            password=request.password,
            email=request.email,
            full_name=request.full_name,
            is_admin=False
        )

        # Send verification email if email is configured
        if is_email_configured():
            try:
                # Use APP_URL if configured, otherwise fall back to request URL
                base_url = APP_URL or (http_request.url.scheme + "://" + http_request.url.netloc)
                verification_token = pg_auth.create_email_verification_token(user["id"])
                send_verification_email(request.email, request.username, verification_token, base_url)

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
            ip_address = http_request.client.host if http_request.client else None
            user_agent = http_request.headers.get("user-agent")

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
                secure=False
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
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Update password
    success = pg_auth.update_user_password(auth["user_id"], request.new_password)
    
    if success:
        return {"message": "Password changed successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to change password")

@app.post("/api/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, http_request: Request):
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
    
    # Create reset token (returns None if user not found - don't reveal this)
    token = pg_auth.create_password_reset_token(request.email)
    
    if token:
        try:
            # Use APP_URL if configured, otherwise fall back to request URL
            base_url = APP_URL or (http_request.url.scheme + "://" + http_request.url.netloc)
            send_password_reset_email(request.email, token, base_url)
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
async def resend_verification(request: ResendVerificationRequest, http_request: Request):
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

    # Find user by email
    import sqlite3
    conn = pg_auth.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email_verified FROM users WHERE email = ?", (request.email,))
    user = cursor.fetchone()
    conn.close()

    if not user:
        # Don't reveal if email exists
        return {"message": "If that email is registered and unverified, you'll receive a verification link shortly."}

    if user['email_verified']:
        return {"message": "This email is already verified. You can login to your account."}

    # Create new verification token
    try:
        # Use APP_URL if configured, otherwise fall back to request URL
        base_url = APP_URL or (http_request.url.scheme + "://" + http_request.url.netloc)
        verification_token = pg_auth.create_email_verification_token(user['id'])
        send_verification_email(request.email, user['username'], verification_token, base_url)

        return {"message": "If that email is registered and unverified, you'll receive a verification link shortly."}
    except Exception as e:
        print(f"Failed to send verification email: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email. Please try again later."
        )

# ============================================================================
# OIDC AUTHENTICATION ENDPOINTS
# ============================================================================

@app.get("/api/auth/oidc/login")
async def oidc_login(request: Request):
    """
    Initiate OIDC login flow
    Redirects user to OIDC provider for authentication
    """
    if not is_oidc_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OIDC authentication is not enabled"
        )

    # Build redirect URI
    redirect_uri = request.url_for('oidc_callback')

    # Initiate OAuth flow
    return await oauth.oidc.authorize_redirect(request, redirect_uri)


@app.get("/api/auth/oidc/callback")
async def oidc_callback(request: Request, response: Response):
    """
    OIDC callback endpoint
    Handles the redirect from OIDC provider after authentication
    """
    if not is_oidc_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OIDC authentication is not enabled"
        )

    try:
        # Exchange authorization code for tokens
        token = await oauth.oidc.authorize_access_token(request)

        # Get user info from ID token or userinfo endpoint
        user_info = token.get('userinfo')
        if not user_info:
            # Fetch from userinfo endpoint
            user_info = await oauth.oidc.userinfo(token=token)

        # Extract standardized user information
        oidc_user = extract_user_info(user_info)

        # Check if OIDC connection already exists
        oidc_connection = pg_auth.find_oidc_connection('oidc', oidc_user['oidc_id'])

        if oidc_connection:
            # Existing OIDC user - log them in
            user_id = oidc_connection['user_id']

            # Check if user is active
            if not oidc_connection['is_active']:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User account is disabled"
                )

            # Update last login
            pg_auth.update_oidc_last_login('oidc', oidc_user['oidc_id'])

        else:
            # New OIDC user
            from .oidc import OIDC_AUTO_LINK, OIDC_AUTO_CREATE

            # Try to link by email if auto-link is enabled
            if OIDC_AUTO_LINK and oidc_user['email']:
                existing_user = pg_auth.find_user_by_email(oidc_user['email'])

                if existing_user:
                    # Link OIDC to existing user
                    user_id = existing_user['id']
                    pg_auth.create_oidc_connection(user_id, 'oidc', oidc_user['oidc_id'], oidc_user['email'])
                elif OIDC_AUTO_CREATE:
                    # Create new user
                    new_user = pg_auth.create_user_from_oidc(
                        username=oidc_user['username'],
                        email=oidc_user['email'],
                        full_name=oidc_user['name']
                    )
                    user_id = new_user['id']

                    # Create OIDC connection
                    pg_auth.create_oidc_connection(user_id, 'oidc', oidc_user['oidc_id'], oidc_user['email'])
                else:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="No account found. Please contact an administrator."
                    )
            elif OIDC_AUTO_CREATE:
                # Create new user without email linking
                new_user = pg_auth.create_user_from_oidc(
                    username=oidc_user['username'],
                    email=oidc_user['email'],
                    full_name=oidc_user['name']
                )
                user_id = new_user['id']

                # Create OIDC connection
                pg_auth.create_oidc_connection(user_id, 'oidc', oidc_user['oidc_id'], oidc_user['email'])
            else:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No account found. Please contact an administrator."
                )

        # Create session for the user
        session_token = pg_auth.create_session(
            user_id=user_id,
            ip_address=get_client_ip(request),
            user_agent=request.headers.get("user-agent")
        )

        # Set session cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            max_age=30 * 24 * 60 * 60,  # 30 days
            samesite="lax"
        )

        # Redirect to home page
        return {"status": "success", "message": "Successfully logged in via OIDC"}

    except Exception as e:
        print(f"OIDC callback error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"OIDC authentication failed: {str(e)}"
        )

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
            expires_in_days=request.expires_in_days
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
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create API key: {str(e)}")

@app.get("/api/auth/keys")
async def list_api_keys(auth = Depends(get_current_auth)):
    """List all API keys (without exposing the actual key values)"""
    try:
        keys = pg_api_keys.list_api_keys()
        return {"keys": keys, "total": len(keys)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list API keys: {str(e)}")

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
        raise HTTPException(status_code=500, detail=f"Failed to delete API key: {str(e)}")

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
        raise HTTPException(status_code=500, detail=f"Failed to revoke API key: {str(e)}")

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
        raise HTTPException(status_code=500, detail=f"Failed to list users: {str(e)}")

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
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")

# ============================================================================
# PROTECTED ENDPOINTS (Require authentication based on AUTH_MODE)
# ============================================================================

@app.get("/api/lookup/{barcode}")
async def lookup_barcode(barcode: str, request: Request, auth = Depends(get_current_auth)):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{LOOKUP_SERVICE_URL}/lookup/{barcode}", timeout=10.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Lookup service error: {str(e)}")

@app.post("/api/items")
async def add_item(request: AddItemRequest, auth = Depends(get_current_auth)):
    try:
        async with httpx.AsyncClient() as client:
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
        raise HTTPException(status_code=500, detail=f"Service error: {str(e)}")

@app.post("/api/items/manual")
async def add_item_manual(request: ManualAddRequest, auth = Depends(get_current_auth)):
    try:
        async with httpx.AsyncClient() as client:
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
        raise HTTPException(status_code=500, detail=f"Inventory service error: {str(e)}")

@app.get("/api/items")
async def get_items(location: Optional[str] = None, search: Optional[str] = None, auth = Depends(get_current_auth)):
    try:
        params = {}
        if location:
            params["location"] = location
        if search:
            params["search"] = search
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{INVENTORY_SERVICE_URL}/items", params=params, timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Inventory service error: {str(e)}")

@app.get("/api/items/{item_id}")
async def get_item(item_id: int, auth = Depends(get_current_auth)):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{INVENTORY_SERVICE_URL}/items/{item_id}", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Item not found")
        raise HTTPException(status_code=500, detail=f"Inventory service error: {str(e)}")

@app.put("/api/items/{item_id}")
async def update_item(item_id: int, request: UpdateItemRequest, auth = Depends(get_current_auth)):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.put(f"{INVENTORY_SERVICE_URL}/items/{item_id}", json=request.dict(exclude_unset=True), timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Item not found")
        raise HTTPException(status_code=500, detail=f"Inventory service error: {str(e)}")

@app.get("/api/export/csv")
async def export_csv(auth = Depends(get_current_auth)):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{INVENTORY_SERVICE_URL}/export/csv", timeout=30.0)
            response.raise_for_status()
            return Response(
                content=response.content,
                media_type="text/csv",
                headers={"Content-Disposition": response.headers.get("Content-Disposition", "attachment; filename=pantrypal_export.csv")}
            )
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")

@app.delete("/api/items/{item_id}")
async def delete_item(item_id: int, auth = Depends(get_current_auth)):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(f"{INVENTORY_SERVICE_URL}/items/{item_id}", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Item not found")
        raise HTTPException(status_code=500, detail=f"Inventory service error: {str(e)}")

@app.get("/api/locations")
async def get_locations(auth = Depends(get_current_auth)):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{INVENTORY_SERVICE_URL}/locations", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Inventory service error: {str(e)}")

@app.get("/api/categories")
async def get_categories(auth = Depends(get_current_auth)):
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{INVENTORY_SERVICE_URL}/categories", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Inventory service error: {str(e)}")
    
@app.get("/api/stats/expiring")
async def get_expiring_items(days: int = 7, auth = Depends(get_current_auth)):
    """Get items expiring within specified days"""
    try:
        async with httpx.AsyncClient() as client:
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
        raise HTTPException(status_code=500, detail=f"Inventory service error: {str(e)}")

# ============================================================================
# SHOPPING LIST ENDPOINTS
# ============================================================================

@app.get("/api/shopping-list")
async def get_shopping_list(include_checked: bool = False, auth = Depends(get_current_auth)):
    """Get shopping list items"""
    try:
        params = {"include_checked": include_checked}
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{INVENTORY_SERVICE_URL}/shopping-list", params=params, timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Shopping list service error: {str(e)}")

@app.post("/api/shopping-list")
async def create_shopping_list_item(item: dict, auth = Depends(get_current_auth)):
    """Add item to shopping list"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{INVENTORY_SERVICE_URL}/shopping-list", json=item, timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Shopping list service error: {str(e)}")

@app.get("/api/shopping-list/{item_id}")
async def get_shopping_list_item(item_id: int, auth = Depends(get_current_auth)):
    """Get specific shopping list item"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{INVENTORY_SERVICE_URL}/shopping-list/{item_id}", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Shopping list item not found")
        raise HTTPException(status_code=500, detail=f"Shopping list service error: {str(e)}")

@app.put("/api/shopping-list/{item_id}")
async def update_shopping_list_item(item_id: int, item_update: dict, auth = Depends(get_current_auth)):
    """Update shopping list item"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.put(f"{INVENTORY_SERVICE_URL}/shopping-list/{item_id}", json=item_update, timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Shopping list item not found")
        raise HTTPException(status_code=500, detail=f"Shopping list service error: {str(e)}")

@app.delete("/api/shopping-list/{item_id}")
async def delete_shopping_list_item(item_id: int, auth = Depends(get_current_auth)):
    """Delete shopping list item"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(f"{INVENTORY_SERVICE_URL}/shopping-list/{item_id}", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Shopping list item not found")
        raise HTTPException(status_code=500, detail=f"Shopping list service error: {str(e)}")

@app.post("/api/shopping-list/from-inventory/{inventory_id}")
async def add_from_inventory_to_shopping_list(inventory_id: int, auth = Depends(get_current_auth)):
    """Add inventory item to shopping list"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{INVENTORY_SERVICE_URL}/shopping-list/from-inventory/{inventory_id}", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Inventory item not found")
        raise HTTPException(status_code=500, detail=f"Shopping list service error: {str(e)}")

@app.post("/api/shopping-list/add-checked-to-inventory")
async def add_checked_to_inventory(auth = Depends(get_current_auth)):
    """Move checked shopping list items to inventory"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{INVENTORY_SERVICE_URL}/shopping-list/add-checked-to-inventory", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Shopping list service error: {str(e)}")

@app.post("/api/shopping-list/suggest-low-stock")
async def suggest_low_stock(auth = Depends(get_current_auth)):
    """Add low stock items to shopping list"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{INVENTORY_SERVICE_URL}/shopping-list/suggest-low-stock", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Shopping list service error: {str(e)}")

@app.delete("/api/shopping-list/clear-checked")
async def clear_checked_shopping_items(auth = Depends(get_current_auth)):
    """Clear all checked items from shopping list"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(f"{INVENTORY_SERVICE_URL}/shopping-list/clear-checked", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Shopping list service error: {str(e)}")

# ============================================================================
# HOME ASSISTANT SHOPPING LIST INTEGRATION
# ============================================================================

@app.get("/api/homeassistant/shopping-list")
async def homeassistant_get_shopping_list():
    """Get shopping list in Home Assistant format (no auth required for HA)"""
    try:
        async with httpx.AsyncClient() as client:
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
        raise HTTPException(status_code=500, detail=f"Shopping list service error: {str(e)}")

@app.post("/api/homeassistant/shopping-list/item")
async def homeassistant_add_shopping_list_item(item: dict):
    """Add item to shopping list in Home Assistant format (no auth required for HA)"""
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

        async with httpx.AsyncClient() as client:
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
        raise HTTPException(status_code=500, detail=f"Shopping list service error: {str(e)}")

@app.post("/api/homeassistant/shopping-list/item/{item_id}")
async def homeassistant_update_shopping_list_item(item_id: str, item: dict):
    """Update shopping list item in Home Assistant format (no auth required for HA)"""
    try:
        # Convert from Home Assistant format
        update_data = {}
        if "name" in item:
            update_data["name"] = item["name"]
        if "complete" in item:
            update_data["checked"] = item["complete"]

        async with httpx.AsyncClient() as client:
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
        raise HTTPException(status_code=500, detail=f"Shopping list service error: {str(e)}")

@app.delete("/api/homeassistant/shopping-list/item/{item_id}")
async def homeassistant_delete_shopping_list_item(item_id: str):
    """Delete shopping list item in Home Assistant format (no auth required for HA)"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(f"{INVENTORY_SERVICE_URL}/shopping-list/{item_id}", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Shopping list item not found")
        raise HTTPException(status_code=500, detail=f"Shopping list service error: {str(e)}")

@app.post("/api/homeassistant/shopping-list/clear-items")
async def homeassistant_clear_shopping_list():
    """Clear all completed items from shopping list (Home Assistant format)"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.delete(f"{INVENTORY_SERVICE_URL}/shopping-list/clear-checked", timeout=5.0)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPError as e:
        raise HTTPException(status_code=500, detail=f"Shopping list service error: {str(e)}")

# ============================================================================
# NOTIFICATION PREFERENCES
# ============================================================================

@app.get("/api/notifications/preferences")
async def get_notification_preferences(auth = Depends(get_current_auth)):
    """Get notification preferences"""
    try:
        import json
        prefs_file = '/app/data/notification_preferences.json'
        os.makedirs(os.path.dirname(prefs_file), exist_ok=True)

        if os.path.exists(prefs_file):
            with open(prefs_file, 'r') as f:
                return json.load(f)
        else:
            return {
                'mobile_enabled': False,
                'notification_time': '09:00',
                'critical_threshold': 3,
                'warning_threshold': 7,
                'home_assistant_enabled': False
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get preferences: {str(e)}")

@app.post("/api/notifications/preferences")
async def save_notification_preferences(preferences: dict, auth = Depends(get_current_auth)):
    """Save notification preferences"""
    try:
        import json
        prefs_file = '/app/data/notification_preferences.json'
        os.makedirs(os.path.dirname(prefs_file), exist_ok=True)
        
        with open(prefs_file, 'w') as f:
            json.dump(preferences, f, indent=2)
        
        return {'status': 'success', 'preferences': preferences}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save preferences: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

class UpdateProfileRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None

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
    
    # Your user_db already has the user info, just return it
    return {
        "id": auth.get("id"),
        "username": auth.get("username"),
        "email": auth.get("email"),
        "full_name": auth.get("full_name"),
        "is_admin": auth.get("is_admin")
    }

@app.patch("/api/users/me")
async def update_my_profile(
    profile: UpdateProfileRequest,
    auth = Depends(get_current_auth)
):
    """Update current user's profile (username, email, full name)"""
    if auth.get("type") != "session":
        raise HTTPException(status_code=403, detail="Profile update only available for logged-in users")

    # Get current user from database
    conn = pg_auth.get_db()
    cursor = conn.cursor()

    updates = []
    params = []

    if profile.username is not None:
        # Validate username
        if len(profile.username.strip()) < 3:
            conn.close()
            raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
        # Check if username already taken
        cursor.execute("SELECT id FROM users WHERE username = ? AND id != ?", (profile.username, auth["id"]))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail="Username already in use")
        updates.append("username = ?")
        params.append(profile.username)

    if profile.email is not None:
        # Check if email already taken
        cursor.execute("SELECT id FROM users WHERE email = ? AND id != ?", (profile.email, auth["id"]))
        if cursor.fetchone():
            conn.close()
            raise HTTPException(status_code=400, detail="Email already in use")
        updates.append("email = ?")
        params.append(profile.email)

    if profile.full_name is not None:
        updates.append("full_name = ?")
        params.append(profile.full_name)

    if not updates:
        conn.close()
        return {"message": "No changes made"}

    params.append(auth["id"])
    query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
    cursor.execute(query, params)
    conn.commit()
    conn.close()

    return {"message": "Profile updated successfully"}

@app.post("/api/users/me/change-password")
async def change_my_password(
    password_data: ChangePasswordRequest,
    auth = Depends(get_current_auth)
):
    """Change current user's password"""
    if auth.get("type") != "session":
        raise HTTPException(status_code=403, detail="Password change only available for logged-in users")
    
    # Get user's current password hash
    conn = pg_auth.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash FROM users WHERE id = ?", (auth["id"],))
    user = cursor.fetchone()
    
    if not user:
        conn.close()
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify current password
    if not pg_auth.verify_password(password_data.current_password, user['password_hash']):
        conn.close()
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Update password
    new_password_hash = pg_auth.hash_password(password_data.new_password)
    cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_password_hash, auth["id"]))
    conn.commit()
    conn.close()
    
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
    http_request: Request,
    auth = Depends(require_admin)
):
    """Create a new user (admin only)"""
    if AUTH_MODE not in ["full", "smart"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User creation not available in current auth mode"
        )

    # Check if username already exists
    import sqlite3
    conn = pg_auth.get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE username = ?", (request.username,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )

    # Check if email already exists
    cursor.execute("SELECT id FROM users WHERE email = ?", (request.email,))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already in use"
        )
    conn.close()

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
        conn = pg_auth.get_db()
        cursor = conn.cursor()
        cursor.execute("UPDATE users SET email_verified = 1 WHERE id = ?", (user["id"],))
        conn.commit()
        conn.close()

        # Send welcome email with password reset link if email is configured
        if request.send_welcome_email and is_email_configured():
            try:
                # Use APP_URL if configured, otherwise fall back to request URL
                base_url = APP_URL or (http_request.url.scheme + "://" + http_request.url.netloc)

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
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
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

@app.get("/api/debug/network")
async def debug_network(request: Request):
    """Debug endpoint to check IP and network status"""
    client_ip = get_client_ip(request)
    is_trusted = is_trusted_network(client_ip)
    
    return {
        "client_ip": client_ip,
        "is_trusted_network": is_trusted,
        "headers": {
            "x-forwarded-for": request.headers.get("x-forwarded-for"),
            "x-real-ip": request.headers.get("x-real-ip"),
            "host": request.headers.get("host"),
        },
        "auth_mode": AUTH_MODE,
        "trusted_networks": os.getenv("TRUSTED_NETWORKS", "192.168.0.0/16,10.0.0.0/8,172.16.0.0/12,127.0.0.0/8")
    }