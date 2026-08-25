"""
OIDC Authentication — two independent flows.

1. Native (Google, Apple) — ID token verification. The client obtains an ID
   token directly from the provider's native SDK on-device (expo-auth-session
   for Google, expo-apple-authentication for Apple) and POSTs it to
   /api/auth/oidc. This module verifies the token's signature against the
   provider's published JWKS — there is no server-side redirect_uri and no
   browser hand-off. Used by the mobile app and the web "Sign in with
   Google" button.

2. Generic (any OIDC-compliant provider) — authorization-code redirect flow
   via authlib. For self-hosters running their own IdP (Authentik, Keycloak,
   Authelia, Okta, Azure AD, etc.) where there's no native SDK to obtain a
   token from directly. Configured via OIDC_* env vars; disabled unless
   OIDC_ENABLED=true and a client ID/secret are set.
"""
import os
import time
from typing import Dict, Optional

import httpx
from jose import jwt as jose_jwt
from authlib.integrations.starlette_client import OAuth

# Apple's native Sign In always sets `aud` to the app's bundle identifier —
# this is a fixed, non-secret value, not a rotatable credential.
APPLE_BUNDLE_ID = "com.palstack.pantrypal"

GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"
APPLE_DISCOVERY_URL = "https://appleid.apple.com/.well-known/openid-configuration"

_JWKS_CACHE_TTL = 3600
_jwks_cache: Dict[str, tuple] = {}  # discovery_url -> (keys, expires_at)


def google_client_id() -> Optional[str]:
    """Google OAuth client ID — self-hosters set this via the GOOGLE_CLIENT_ID env var."""
    return os.getenv("GOOGLE_CLIENT_ID")


def oidc_public_config() -> Dict:
    """Public config exposed via /api/auth/status for the mobile/web login screen."""
    config: Dict = {"google_client_id": google_client_id() or ""}
    generic = get_oidc_config()
    if generic:
        config.update(generic)
    return config


def _provider_config(provider: str) -> Dict[str, str]:
    if provider == "google":
        client_id = google_client_id()
        if not client_id:
            raise ValueError("Google sign-in is not configured on this server")
        return {"client_id": client_id, "discovery_url": GOOGLE_DISCOVERY_URL}
    if provider == "apple":
        return {"client_id": APPLE_BUNDLE_ID, "discovery_url": APPLE_DISCOVERY_URL}
    raise ValueError(f"Unknown OIDC provider: {provider}")


async def _fetch_jwks(discovery_url: str) -> list:
    cached = _jwks_cache.get(discovery_url)
    if cached and cached[1] > time.time():
        return cached[0]
    async with httpx.AsyncClient(timeout=10) as client:
        disc_resp = await client.get(discovery_url)
        disc_resp.raise_for_status()
        jwks_uri = disc_resp.json()["jwks_uri"]
        jwks_resp = await client.get(jwks_uri)
        jwks_resp.raise_for_status()
        keys = jwks_resp.json().get("keys", [])
    _jwks_cache[discovery_url] = (keys, time.time() + _JWKS_CACHE_TTL)
    return keys


async def verify_id_token(provider: str, id_token: str) -> Dict:
    """Verify a provider ID token and return its claims. Raises ValueError on any failure."""
    config = _provider_config(provider)
    keys = await _fetch_jwks(config["discovery_url"])

    try:
        header = jose_jwt.get_unverified_header(id_token)
    except Exception as exc:
        raise ValueError(f"Malformed ID token: {exc}")

    kid = header.get("kid")
    matching = next((k for k in keys if not kid or k.get("kid") == kid), None)
    if not matching:
        raise ValueError("No matching JWKS key found for token")

    try:
        # Algorithm is pinned here (RS256) — never trust the alg from the untrusted JWT header.
        claims = jose_jwt.decode(
            id_token, matching, algorithms=["RS256"], audience=config["client_id"]
        )
    except Exception as exc:
        raise ValueError(f"ID token verification failed: {exc}")

    return claims


async def fetch_userinfo(provider: str, access_token: str) -> Dict:
    """
    Fallback path for Google's native mobile flow, which commonly yields an
    OAuth access_token rather than an id_token — exchange it for profile
    claims via the provider's userinfo endpoint. Apple never uses this path
    (expo-apple-authentication only ever returns an identityToken).
    """
    config = _provider_config(provider)
    async with httpx.AsyncClient(timeout=10) as client:
        disc_resp = await client.get(config["discovery_url"])
        disc_resp.raise_for_status()
        userinfo_endpoint = disc_resp.json()["userinfo_endpoint"]
        resp = await client.get(userinfo_endpoint, headers={"Authorization": f"Bearer {access_token}"})
        if resp.status_code != 200:
            raise ValueError("Access token rejected by OIDC provider")
        return resp.json()


# =============================================================================
# GENERIC OIDC (redirect flow, any provider) — for self-hosted IdPs
# =============================================================================

OIDC_ENABLED = os.getenv("OIDC_ENABLED", "false").lower() == "true"
OIDC_PROVIDER_NAME = os.getenv("OIDC_PROVIDER_NAME", "SSO")  # Display name on the login button
OIDC_CLIENT_ID = os.getenv("OIDC_CLIENT_ID")
OIDC_CLIENT_SECRET = os.getenv("OIDC_CLIENT_SECRET")
OIDC_DISCOVERY_URL = os.getenv("OIDC_DISCOVERY_URL")  # e.g. https://auth.example.com/.well-known/openid-configuration

# Manual endpoint configuration, only used if the provider doesn't support discovery
OIDC_AUTHORIZATION_ENDPOINT = os.getenv("OIDC_AUTHORIZATION_ENDPOINT")
OIDC_TOKEN_ENDPOINT = os.getenv("OIDC_TOKEN_ENDPOINT")
OIDC_USERINFO_ENDPOINT = os.getenv("OIDC_USERINFO_ENDPOINT")

OIDC_SCOPES = os.getenv("OIDC_SCOPES", "openid profile email")

# Account linking strategy
OIDC_AUTO_LINK = os.getenv("OIDC_AUTO_LINK", "true").lower() == "true"      # Link to an existing account by verified email
OIDC_AUTO_CREATE = os.getenv("OIDC_AUTO_CREATE", "true").lower() == "true"  # Create a new account if no match


def is_oidc_enabled() -> bool:
    """Check whether generic OIDC is enabled and has enough config to actually work."""
    if not OIDC_ENABLED:
        return False
    if not OIDC_CLIENT_ID or not OIDC_CLIENT_SECRET:
        print("Warning: OIDC_ENABLED=true but OIDC_CLIENT_ID or OIDC_CLIENT_SECRET is not set")
        return False
    if not OIDC_DISCOVERY_URL and not (OIDC_AUTHORIZATION_ENDPOINT and OIDC_TOKEN_ENDPOINT):
        print("Warning: OIDC_ENABLED=true but neither OIDC_DISCOVERY_URL nor manual endpoints are configured")
        return False
    return True


def get_oidc_config() -> Optional[Dict]:
    """Public config for the login screen — None when generic OIDC isn't usable."""
    if not is_oidc_enabled():
        return None
    return {
        "enabled": True,
        "provider_name": OIDC_PROVIDER_NAME,
        "login_url": "/api/auth/oidc/login",
    }


# Registered lazily (not at import time) so tests and installs without OIDC
# configured never try to reach a discovery URL.
oauth = OAuth()
_oidc_client_registered = False


def get_oauth_client():
    """Return the registered authlib client for the generic OIDC provider."""
    global _oidc_client_registered
    if not _oidc_client_registered:
        if OIDC_DISCOVERY_URL:
            oauth.register(
                name="oidc",
                client_id=OIDC_CLIENT_ID,
                client_secret=OIDC_CLIENT_SECRET,
                server_metadata_url=OIDC_DISCOVERY_URL,
                client_kwargs={"scope": OIDC_SCOPES},
            )
        else:
            oauth.register(
                name="oidc",
                client_id=OIDC_CLIENT_ID,
                client_secret=OIDC_CLIENT_SECRET,
                authorize_url=OIDC_AUTHORIZATION_ENDPOINT,
                access_token_url=OIDC_TOKEN_ENDPOINT,
                userinfo_endpoint=OIDC_USERINFO_ENDPOINT,
                client_kwargs={"scope": OIDC_SCOPES},
            )
        _oidc_client_registered = True
    return oauth.oidc


def extract_user_info(oidc_user: Dict) -> Dict:
    """
    Normalize claims across providers into a standard shape.
    Different IdPs use different claim names:
      - Google/most OIDC providers: sub, email, name
      - Azure AD: oid, email or upn, name
      - Keycloak/Authentik: sub, email, name, preferred_username
    """
    oidc_id = oidc_user.get("sub") or oidc_user.get("oid")
    email = oidc_user.get("email") or oidc_user.get("upn")
    name = (
        oidc_user.get("name")
        or oidc_user.get("displayName")
        or f"{oidc_user.get('given_name', '')} {oidc_user.get('family_name', '')}".strip()
        or None
    )
    username = oidc_user.get("preferred_username") or (email.split("@")[0] if email else None) or f"oidc_{(oidc_id or '')[:8]}"

    return {
        "oidc_id": oidc_id,
        "email": email,
        "email_verified": bool(oidc_user.get("email_verified", False)),
        "name": name,
        "username": username,
    }
