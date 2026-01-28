"""
OIDC (OpenID Connect) Authentication Module

Provides generic OIDC authentication support for PantryPal.
Works with any OIDC-compliant provider (Google, Microsoft, Keycloak, Authentik, etc.)
"""

from authlib.integrations.starlette_client import OAuth
from authlib.integrations.base_client import OAuthError
from fastapi import HTTPException, status
import os
from typing import Optional, Dict
import httpx

# OIDC Configuration from environment variables
OIDC_ENABLED = os.getenv("OIDC_ENABLED", "false").lower() == "true"
OIDC_PROVIDER_NAME = os.getenv("OIDC_PROVIDER_NAME", "oidc")  # Display name
OIDC_CLIENT_ID = os.getenv("OIDC_CLIENT_ID")
OIDC_CLIENT_SECRET = os.getenv("OIDC_CLIENT_SECRET")
OIDC_DISCOVERY_URL = os.getenv("OIDC_DISCOVERY_URL")  # e.g., https://accounts.google.com/.well-known/openid-configuration
OIDC_REDIRECT_URI = os.getenv("OIDC_REDIRECT_URI")  # e.g., https://pantrypal.palstack.io/api/auth/oidc/callback

# Optional: Manual endpoint configuration (if provider doesn't support discovery)
OIDC_AUTHORIZATION_ENDPOINT = os.getenv("OIDC_AUTHORIZATION_ENDPOINT")
OIDC_TOKEN_ENDPOINT = os.getenv("OIDC_TOKEN_ENDPOINT")
OIDC_USERINFO_ENDPOINT = os.getenv("OIDC_USERINFO_ENDPOINT")

# OAuth scopes (default: openid, profile, email)
OIDC_SCOPES = os.getenv("OIDC_SCOPES", "openid profile email")

# Account linking strategy
OIDC_AUTO_LINK = os.getenv("OIDC_AUTO_LINK", "true").lower() == "true"  # Auto-link by email
OIDC_AUTO_CREATE = os.getenv("OIDC_AUTO_CREATE", "true").lower() == "true"  # Auto-create users


def is_oidc_enabled() -> bool:
    """Check if OIDC is enabled and properly configured"""
    if not OIDC_ENABLED:
        return False

    # Check required configuration
    if not OIDC_CLIENT_ID or not OIDC_CLIENT_SECRET:
        print("Warning: OIDC enabled but CLIENT_ID or CLIENT_SECRET not configured")
        return False

    if not OIDC_DISCOVERY_URL and not (OIDC_AUTHORIZATION_ENDPOINT and OIDC_TOKEN_ENDPOINT):
        print("Warning: OIDC enabled but neither DISCOVERY_URL nor manual endpoints configured")
        return False

    return True


def get_oidc_config() -> Optional[Dict]:
    """Get OIDC configuration for the UI"""
    if not is_oidc_enabled():
        return None

    return {
        "enabled": True,
        "provider_name": OIDC_PROVIDER_NAME,
        "login_url": "/api/auth/oidc/login",
    }


# Initialize OAuth client
oauth = OAuth()

if is_oidc_enabled():
    # Register OIDC provider
    if OIDC_DISCOVERY_URL:
        # Use OIDC discovery
        oauth.register(
            name='oidc',
            client_id=OIDC_CLIENT_ID,
            client_secret=OIDC_CLIENT_SECRET,
            server_metadata_url=OIDC_DISCOVERY_URL,
            client_kwargs={
                'scope': OIDC_SCOPES,
            }
        )
    else:
        # Manual endpoint configuration
        oauth.register(
            name='oidc',
            client_id=OIDC_CLIENT_ID,
            client_secret=OIDC_CLIENT_SECRET,
            authorize_url=OIDC_AUTHORIZATION_ENDPOINT,
            access_token_url=OIDC_TOKEN_ENDPOINT,
            userinfo_endpoint=OIDC_USERINFO_ENDPOINT,
            client_kwargs={
                'scope': OIDC_SCOPES,
            }
        )


async def get_oidc_user_info(token: str) -> Dict:
    """
    Fetch user information from OIDC provider using access token
    """
    if not is_oidc_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OIDC is not enabled"
        )

    try:
        # Get userinfo endpoint from provider metadata
        client = oauth.create_client('oidc')

        # Fetch user info
        async with httpx.AsyncClient() as http_client:
            if OIDC_USERINFO_ENDPOINT:
                endpoint = OIDC_USERINFO_ENDPOINT
            else:
                # Get from discovery document
                metadata = await client.load_server_metadata()
                endpoint = metadata.get('userinfo_endpoint')

            if not endpoint:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Could not determine userinfo endpoint"
                )

            response = await http_client.get(
                endpoint,
                headers={'Authorization': f'Bearer {token}'}
            )

            if response.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Failed to fetch user info from OIDC provider"
                )

            return response.json()

    except OAuthError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"OIDC authentication failed: {str(e)}"
        )


def extract_user_info(oidc_user: Dict) -> Dict:
    """
    Extract standardized user information from OIDC user data

    Different OIDC providers use different claim names:
    - Google: sub, email, name, picture
    - Microsoft: oid, email, name
    - Keycloak: sub, email, name, preferred_username
    """
    # Try to get user ID (sub is standard OIDC claim)
    user_id = oidc_user.get('sub') or oidc_user.get('oid')

    # Try to get email
    email = oidc_user.get('email') or oidc_user.get('upn')

    # Try to get name
    name = (
        oidc_user.get('name') or
        oidc_user.get('displayName') or
        f"{oidc_user.get('given_name', '')} {oidc_user.get('family_name', '')}".strip()
    )

    # Try to get username
    username = (
        oidc_user.get('preferred_username') or
        oidc_user.get('email', '').split('@')[0] or
        user_id
    )

    return {
        'oidc_id': user_id,
        'email': email,
        'name': name,
        'username': username,
        'email_verified': oidc_user.get('email_verified', False)
    }
