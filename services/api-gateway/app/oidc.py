"""
Native OIDC (Google, Apple) — ID token verification.

The client obtains an ID token directly from the provider's native SDK
on-device (expo-auth-session for Google, expo-apple-authentication for
Apple) and POSTs it to /api/auth/oidc. This module verifies the token's
signature against the provider's published JWKS — there is no server-side
redirect_uri and no browser hand-off.
"""
import os
import time
from typing import Dict, Optional

import httpx
from jose import jwt as jose_jwt

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


def oidc_public_config() -> Dict[str, str]:
    """Public config exposed via /api/auth/status for the mobile/web login screen."""
    return {"google_client_id": google_client_id() or ""}


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
