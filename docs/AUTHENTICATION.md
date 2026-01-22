# PantryPal Authentication System - Technical Documentation

**Version:** 1.3.0
**Last Updated:** January 2026
**Author:** PalStack Team

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication Methods](#authentication-methods)
3. [Database Schema](#database-schema)
4. [API Endpoints Reference](#api-endpoints-reference)
5. [User Flows](#user-flows)
6. [UI Integration Guide](#ui-integration-guide)
7. [Security Architecture](#security-architecture)
8. [Environment Configuration](#environment-configuration)
9. [OIDC Integration Guide](#oidc-integration-guide)
10. [Mobile-Specific Features](#mobile-specific-features)

---

## Overview

PantryPal implements a flexible, multi-method authentication system designed for self-hosted deployments. The system supports traditional username/password authentication, OIDC/OAuth 2.0 single sign-on, API keys for programmatic access, and biometric authentication for mobile devices.

### Key Features

- **Session-Based Auth**: Cookie-based sessions for web, token-based for mobile
- **Email Verification**: Optional email verification for new user registrations
- **Password Reset**: Secure token-based password reset flow
- **OIDC/OAuth 2.0**: Single sign-on with any OIDC-compliant provider
- **API Keys**: Long-lived tokens for integrations (Home Assistant, scripts)
- **Biometric Auth**: Face ID/Touch ID support on mobile
- **Admin User Management**: Admins can create users without email verification
- **Auto-Link OIDC**: Automatically link OIDC logins to existing accounts by email

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend Layer                       │
│  (Web UI, Mobile App, Third-party Integrations)         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      │ HTTP/HTTPS
                      │
┌─────────────────────▼───────────────────────────────────┐
│                  API Gateway Service                     │
│  - FastAPI                                               │
│  - Session Management                                    │
│  - OIDC/OAuth Client                                     │
│  - Email Service                                         │
└─────────────────────┬───────────────────────────────────┘
                      │
                      │ SQLite
                      │
┌─────────────────────▼───────────────────────────────────┐
│                   User Database                          │
│  - users                                                 │
│  - sessions                                              │
│  - api_keys                                              │
│  - oidc_connections                                      │
└─────────────────────────────────────────────────────────┘
```

---

## Authentication Methods

### 1. Username/Password (Traditional)

**How it works:**
- User provides username and password
- Server validates credentials against hashed password in database
- On success, creates session and returns session token
- Session token stored in HTTP-only cookie (web) or AsyncStorage (mobile)

**Security:**
- Passwords hashed with bcrypt (cost factor 12)
- Minimum 8 character password requirement
- Session tokens are cryptographically random UUIDs

**Files:**
- Backend: `/backend/services/api-gateway/app/main.py` (login endpoint)
- Web UI: `/backend/services/web-ui/src/LandingPage.jsx`
- Mobile: `/mobile/src/screens/LoginScreen.js`

### 2. OIDC/OAuth 2.0 (Single Sign-On)

**How it works:**
- User clicks "Sign in with [Provider]" button
- Redirected to OIDC provider (Google, Microsoft, Keycloak, etc.)
- User authenticates with provider
- Provider redirects back with authorization code
- Server exchanges code for access token and user info
- Server creates or links user account, creates session

**Security:**
- Uses authorization code flow (most secure OAuth flow)
- State parameter prevents CSRF attacks
- PKCE support for mobile apps
- Token validation via provider's userinfo endpoint

**Configuration:**
- Disabled by default (`OIDC_ENABLED=false`)
- Supports OIDC Discovery for automatic configuration
- Auto-link by email (optional)
- Auto-create users (optional)

**Files:**
- Backend: `/backend/services/api-gateway/app/oidc.py`
- Backend: `/backend/services/api-gateway/app/main.py` (OIDC endpoints)
- Web UI: `/backend/services/web-ui/src/LandingPage.jsx`
- Mobile: `/mobile/src/screens/LoginScreen.js`

### 3. API Keys

**How it works:**
- Admin creates API key for user via settings page
- API key is a long-lived token (32+ character random string)
- Client includes API key in `X-API-Key` header
- Server validates key and retrieves associated user

**Use Cases:**
- Home Assistant integration
- CLI tools and scripts
- Third-party integrations
- Automation workflows

**Security:**
- Keys stored hashed in database
- Can be revoked by admin
- Each key linked to specific user (inherits permissions)
- Keys don't expire but can be manually revoked

**Files:**
- Backend: `/backend/services/api-gateway/app/main.py` (API key validation)
- Backend: `/backend/services/api-gateway/app/user_db.py` (API key management)

### 4. Biometric Authentication (Mobile Only)

**How it works:**
- User enables biometric auth after first successful login
- App stores encrypted credentials in secure storage
- On biometric auth success, app retrieves and decrypts credentials
- App performs automatic login with stored credentials

**Security:**
- Credentials encrypted with device secure enclave
- Biometric data never leaves device
- Requires device passcode as fallback
- Can be disabled at any time

**Supported Methods:**
- iOS: Face ID, Touch ID
- Android: Fingerprint, Face Unlock

**Files:**
- Mobile: `/mobile/src/services/biometricAuth.js`
- Mobile: `/mobile/src/screens/LoginScreen.js`

---

## Database Schema

### Users Table

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    full_name TEXT,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    email_verified INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);
```

**Fields:**
- `id`: Unique user identifier
- `username`: Unique login name (required)
- `email`: User email (required for password reset)
- `full_name`: Display name (optional)
- `password_hash`: Bcrypt hash of password
- `is_admin`: Admin flag (0 or 1)
- `email_verified`: Email verification status (0 or 1)
- `created_at`: Account creation timestamp
- `last_login_at`: Last successful login timestamp

### Sessions Table

```sql
CREATE TABLE sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    session_token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

**Fields:**
- `session_token`: UUID stored in cookie/AsyncStorage
- `expires_at`: Session expiration (default: 30 days)
- Sessions automatically deleted on user deletion (CASCADE)

### API Keys Table

```sql
CREATE TABLE api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    key_hash TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

**Fields:**
- `key_hash`: SHA256 hash of API key
- `name`: Optional description (e.g., "Home Assistant")
- `last_used_at`: Updated on each API call

### OIDC Connections Table

```sql
CREATE TABLE oidc_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL DEFAULT 'oidc',
    provider_user_id TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMP NOT NULL,
    last_login_at TIMESTAMP,
    UNIQUE(provider, provider_user_id),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

**Fields:**
- `provider`: OIDC provider name (e.g., "google", "microsoft")
- `provider_user_id`: User's ID from OIDC provider (sub claim)
- `email`: Email from OIDC provider (for account linking)
- `last_login_at`: Last OIDC login timestamp

---

## API Endpoints Reference

### Authentication Endpoints

#### `POST /api/auth/register`

Create a new user account with email verification.

**Request:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "full_name": "John Doe",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "full_name": "John Doe",
    "is_admin": false,
    "email_verified": false
  },
  "session_token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Behavior:**
- Creates user with `email_verified=0`
- Sends verification email if SMTP configured
- Creates session immediately (user can use app before verification)
- Returns 400 if username/email already exists

---

#### `POST /api/auth/login`

Authenticate with username and password.

**Request:**
```json
{
  "username": "johndoe",
  "password": "securepassword123"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "full_name": "John Doe",
    "is_admin": false,
    "email_verified": true
  },
  "session_token": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response (401 Unauthorized):**
```json
{
  "detail": "Invalid credentials"
}
```

---

#### `POST /api/auth/logout`

Invalidate current session.

**Headers:**
```
Cookie: session_token=a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

---

#### `GET /api/auth/status`

Check authentication status and get OIDC config.

**Response (authenticated):**
```json
{
  "authenticated": true,
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "is_admin": false,
    "email_verified": true
  },
  "oidc": {
    "enabled": true,
    "provider_name": "Google"
  }
}
```

**Response (not authenticated):**
```json
{
  "authenticated": false,
  "oidc": {
    "enabled": false
  }
}
```

---

### Email Verification Endpoints

#### `POST /api/auth/verify-email`

Verify email address with token from email.

**Request:**
```json
{
  "token": "verification-token-from-email"
}
```

**Response (200 OK):**
```json
{
  "message": "Email verified successfully"
}
```

**Response (400 Bad Request):**
```json
{
  "detail": "Invalid or expired verification token"
}
```

---

#### `POST /api/auth/resend-verification`

Resend verification email.

**Request:**
```json
{
  "email": "john@example.com"
}
```

**Response (200 OK):**
```json
{
  "message": "Verification email sent"
}
```

---

### Password Reset Endpoints

#### `POST /api/auth/forgot-password`

Request password reset email.

**Request:**
```json
{
  "email": "john@example.com"
}
```

**Response (200 OK):**
```json
{
  "message": "If the email exists, a reset link has been sent"
}
```

**Note:** Always returns 200 to prevent email enumeration.

---

#### `POST /api/auth/reset-password`

Reset password with token from email.

**Request:**
```json
{
  "token": "reset-token-from-email",
  "new_password": "newsecurepassword456"
}
```

**Response (200 OK):**
```json
{
  "message": "Password reset successfully"
}
```

**Response (400 Bad Request):**
```json
{
  "detail": "Invalid or expired reset token"
}
```

---

### OIDC Endpoints

#### `GET /api/auth/oidc/login`

Initiate OIDC authentication flow.

**Behavior:**
- Redirects to OIDC provider's authorization endpoint
- Includes state parameter for CSRF protection
- Sets redirect_uri to `/api/auth/oidc/callback`

---

#### `GET /api/auth/oidc/callback`

Handle OIDC callback after authentication.

**Query Parameters:**
- `code`: Authorization code from provider
- `state`: State parameter for CSRF validation

**Behavior:**
1. Validates state parameter
2. Exchanges code for access token
3. Fetches user info from provider
4. Finds or creates user account:
   - If OIDC connection exists → login existing user
   - If `OIDC_AUTO_LINK=true` and email matches → link to existing user
   - If `OIDC_AUTO_CREATE=true` → create new user
   - Otherwise → return error
5. Creates session and redirects to app

**Success:** Redirects to `/` with session cookie

**Error:** Redirects to `/?error=oidc_failed`

---

### Admin Endpoints

#### `POST /api/admin/users`

Create user account (admin only).

**Request:**
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "full_name": "New User",
  "password": "temporarypassword",
  "is_admin": false
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": 2,
    "username": "newuser",
    "email": "newuser@example.com",
    "full_name": "New User",
    "is_admin": false,
    "email_verified": true
  }
}
```

**Behavior:**
- Auto-verifies email (`email_verified=1`)
- Sends welcome email with password reset link
- Only accessible to admin users
- Returns 403 if non-admin tries to access

---

## User Flows

### 1. Registration Flow (Self-Service)

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       │ 1. Fills registration form
       │    (username, email, password)
       ▼
┌─────────────────────────────────┐
│  Frontend (Web/Mobile)          │
│  POST /api/auth/register        │
└──────┬──────────────────────────┘
       │
       │ 2. Validates input
       │    (password length, email format)
       ▼
┌─────────────────────────────────┐
│  Backend API                     │
│  - Check username/email unique   │
│  - Hash password (bcrypt)        │
│  - Create user (email_verified=0)│
│  - Generate verification token   │
│  - Send verification email       │
│  - Create session                │
└──────┬──────────────────────────┘
       │
       │ 3. Returns session token
       ▼
┌─────────────────────────────────┐
│  Frontend                        │
│  - Store session token           │
│  - Show "verify email" banner    │
│  - Navigate to main app          │
└─────────────────────────────────┘
```

**User can use app immediately**, but sees banner prompting email verification.

**Email Verification Process:**

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       │ 4. Clicks link in email
       │    (https://app.com/verify-email?token=xyz)
       ▼
┌─────────────────────────────────┐
│  Frontend                        │
│  GET /verify-email?token=xyz     │
│  (VerifyEmailPage component)     │
└──────┬──────────────────────────┘
       │
       │ 5. Auto-submits token
       │    POST /api/auth/verify-email
       ▼
┌─────────────────────────────────┐
│  Backend API                     │
│  - Validate token (not expired)  │
│  - Update user:                  │
│    email_verified = 1            │
└──────┬──────────────────────────┘
       │
       │ 6. Returns success
       ▼
┌─────────────────────────────────┐
│  Frontend                        │
│  - Show success message          │
│  - Auto-redirect to login (3s)   │
│  - Remove verification banner    │
└─────────────────────────────────┘
```

**Files Involved:**
- Web: `/backend/services/web-ui/src/LandingPage.jsx` (signup form)
- Web: `/backend/services/web-ui/src/VerifyEmailPage.jsx` (verification page)
- Mobile: `/mobile/src/screens/SignupScreen.js` (signup form)
- Mobile: `/mobile/src/screens/VerifyEmailScreen.js` (verification screen)
- Backend: `/backend/services/api-gateway/app/main.py` (register, verify endpoints)
- Backend: `/backend/services/api-gateway/app/email_service.py` (verification email)

---

### 2. Login Flow (Username/Password)

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       │ 1. Enters username + password
       ▼
┌─────────────────────────────────┐
│  Frontend (Web/Mobile)          │
│  POST /api/auth/login           │
└──────┬──────────────────────────┘
       │
       │ 2. Sends credentials
       ▼
┌─────────────────────────────────┐
│  Backend API                     │
│  - Find user by username         │
│  - Verify password (bcrypt)      │
│  - Update last_login_at          │
│  - Create session (30d expiry)   │
└──────┬──────────────────────────┘
       │
       │ 3. Returns session token + user
       ▼
┌─────────────────────────────────┐
│  Frontend                        │
│  Web: Store in cookie            │
│  Mobile: Store in AsyncStorage   │
│  - Navigate to main app          │
└─────────────────────────────────┘
```

**Mobile Biometric Enrollment (Optional):**

After first successful login on mobile:

```
┌─────────────────────────────────┐
│  Mobile App                      │
│  - Check if biometric available  │
│  - Prompt user to enable         │
└──────┬──────────────────────────┘
       │
       │ User accepts
       ▼
┌─────────────────────────────────┐
│  Biometric Service               │
│  - Request biometric auth        │
│  - On success:                   │
│    * Encrypt credentials         │
│    * Store in SecureStore        │
│    * Set biometric_enabled flag  │
└─────────────────────────────────┘
```

Next login:

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       │ Tap "Sign in with Face ID"
       ▼
┌─────────────────────────────────┐
│  Mobile App                      │
│  - Request biometric auth        │
│  - On success:                   │
│    * Retrieve encrypted creds    │
│    * Decrypt with secure enclave │
│    * Auto-login with password    │
└─────────────────────────────────┘
```

---

### 3. Password Reset Flow

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       │ 1. Clicks "Forgot password?"
       │    Enters email
       ▼
┌─────────────────────────────────┐
│  Frontend                        │
│  POST /api/auth/forgot-password │
└──────┬──────────────────────────┘
       │
       │ 2. Sends email
       ▼
┌─────────────────────────────────┐
│  Backend API                     │
│  - Find user by email            │
│  - Generate reset token (1h TTL) │
│  - Send reset email              │
│  - Always return 200             │
│    (prevent email enumeration)   │
└──────┬──────────────────────────┘
       │
       │ 3. User clicks email link
       │    (https://app.com/reset-password?token=xyz)
       ▼
┌─────────────────────────────────┐
│  Frontend                        │
│  GET /reset-password?token=xyz   │
│  (ResetPasswordPage component)   │
└──────┬──────────────────────────┘
       │
       │ 4. User enters new password
       │    POST /api/auth/reset-password
       ▼
┌─────────────────────────────────┐
│  Backend API                     │
│  - Validate token (not expired)  │
│  - Hash new password             │
│  - Update user password_hash     │
│  - Invalidate token              │
└──────┬──────────────────────────┘
       │
       │ 5. Success response
       ▼
┌─────────────────────────────────┐
│  Frontend                        │
│  - Show success message          │
│  - Auto-redirect to login (3s)   │
└─────────────────────────────────┘
```

**Token Security:**
- Tokens valid for 1 hour only
- Single-use (invalidated after reset)
- Cryptographically random (32+ bytes)
- Not stored in database (prevents token leakage if DB compromised)

**Files Involved:**
- Web: `/backend/services/web-ui/src/ResetPasswordPage.jsx`
- Mobile: `/mobile/src/screens/ResetPasswordScreen.js`
- Mobile: `/mobile/src/screens/ForgotPasswordScreen.js`
- Backend: `/backend/services/api-gateway/app/main.py` (forgot, reset endpoints)
- Backend: `/backend/services/api-gateway/app/email_service.py` (reset email)

---

### 4. Admin User Creation Flow

```
┌─────────────┐
│   Admin     │
└──────┬──────┘
       │
       │ 1. Navigate to Settings > Users
       │    Click "Add User"
       │    Fill form (username, email, password)
       ▼
┌─────────────────────────────────┐
│  Frontend                        │
│  POST /api/admin/users          │
└──────┬──────────────────────────┘
       │
       │ 2. Sends user data
       ▼
┌─────────────────────────────────┐
│  Backend API                     │
│  - Verify requester is admin     │
│  - Hash temporary password       │
│  - Create user:                  │
│    email_verified = 1 (auto)     │
│  - Generate password reset token │
│  - Send welcome email with       │
│    reset link                    │
└──────┬──────────────────────────┘
       │
       │ 3. New user receives email
       │    "Welcome! Set your password"
       │    Contains reset link
       ▼
┌─────────────────────────────────┐
│  New User                        │
│  - Clicks reset link             │
│  - Sets own password             │
│  - Can login immediately         │
│    (no verification needed)      │
└─────────────────────────────────┘
```

**Key Differences from Self-Registration:**
- ✅ Email auto-verified (`email_verified=1`)
- ✅ No verification email sent
- ✅ Welcome email includes password reset link
- ✅ User can login immediately after setting password

**Files Involved:**
- Web: `/backend/services/web-ui/src/SettingsPage.jsx` (admin user form)
- Backend: `/backend/services/api-gateway/app/main.py` (admin create endpoint)
- Backend: `/backend/services/api-gateway/app/email_service.py` (welcome email)

---

### 5. OIDC Login Flow

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       │ 1. Clicks "Sign in with Google"
       ▼
┌─────────────────────────────────┐
│  Frontend                        │
│  GET /api/auth/oidc/login       │
└──────┬──────────────────────────┘
       │
       │ 2. Redirect to OIDC provider
       ▼
┌─────────────────────────────────┐
│  OIDC Provider (Google)          │
│  - User logs in                  │
│  - User consents to scopes       │
│  - Redirect to callback with     │
│    authorization code            │
└──────┬──────────────────────────┘
       │
       │ 3. GET /api/auth/oidc/callback?code=xyz&state=abc
       ▼
┌─────────────────────────────────┐
│  Backend API                     │
│  - Validate state (CSRF)         │
│  - Exchange code for token       │
│  - Fetch user info from provider │
│  - Extract email, name, sub      │
└──────┬──────────────────────────┘
       │
       │ 4. Account Linking Logic
       ▼
┌─────────────────────────────────┐
│  Account Linking Decision        │
│                                  │
│  A. OIDC connection exists?      │
│     → Login existing user        │
│                                  │
│  B. Email matches + AUTO_LINK?   │
│     → Link to existing user      │
│     → Create OIDC connection     │
│                                  │
│  C. No match + AUTO_CREATE?      │
│     → Create new user            │
│     → Create OIDC connection     │
│     → email_verified = 1 (auto)  │
│                                  │
│  D. Otherwise:                   │
│     → Return error               │
└──────┬──────────────────────────┘
       │
       │ 5. Create session
       ▼
┌─────────────────────────────────┐
│  Backend API                     │
│  - Create session (30d expiry)   │
│  - Update last_login_at          │
│  - Redirect to / with session    │
└──────┬──────────────────────────┘
       │
       │ 6. User logged in
       ▼
┌─────────────────────────────────┐
│  Frontend                        │
│  - Session cookie set            │
│  - User redirected to main app   │
└─────────────────────────────────┘
```

**Configuration Options:**

| Setting | Effect |
|---------|--------|
| `OIDC_AUTO_LINK=true` | Automatically link OIDC login to existing user with matching email |
| `OIDC_AUTO_LINK=false` | User must have existing OIDC connection (no auto-linking) |
| `OIDC_AUTO_CREATE=true` | Create new user if no match found |
| `OIDC_AUTO_CREATE=false` | Return error if user doesn't exist |

**Example Scenarios:**

**Scenario 1: First-time OIDC user**
- User `john@example.com` doesn't exist in database
- `OIDC_AUTO_CREATE=true`
- Result: New user created with `email_verified=1`, OIDC connection created

**Scenario 2: Existing user, first OIDC login**
- User `john@example.com` exists (created via password registration)
- `OIDC_AUTO_LINK=true`
- Result: OIDC connection linked to existing user, user logged in

**Scenario 3: Return OIDC user**
- User has existing OIDC connection (provider + provider_user_id)
- Result: Instant login (no email check needed)

**Files Involved:**
- Web: `/backend/services/web-ui/src/LandingPage.jsx` (OIDC button)
- Mobile: `/mobile/src/screens/LoginScreen.js` (OIDC button)
- Backend: `/backend/services/api-gateway/app/oidc.py` (OIDC logic)
- Backend: `/backend/services/api-gateway/app/main.py` (OIDC endpoints)
- Backend: `/backend/services/api-gateway/app/user_db.py` (OIDC connections)

---

## UI Integration Guide

### Web UI Architecture

**Technology Stack:**
- React (functional components)
- Inline styles (no CSS framework)
- Fetch API for HTTP requests
- LocalStorage for server config
- Cookies for session management

**Key Components:**

#### LandingPage.jsx
**Location:** `/backend/services/web-ui/src/LandingPage.jsx`

**Purpose:** Handles all pre-authentication screens (landing, login, signup, forgot password)

**State Machine:**
```javascript
view = 'landing' | 'login' | 'signup' | 'forgot'
```

**Key Features:**
- Server configuration (first-time setup)
- OIDC button (dynamically shown if enabled)
- Email verification banner
- Password show/hide toggles

**Integration:**
```javascript
// Fetch OIDC config on mount
useEffect(() => {
  if (serverConfigured) {
    fetchOidcConfig();
  }
}, [serverConfigured]);

// Check if OIDC enabled
const fetchOidcConfig = async () => {
  const response = await fetch('/api/auth/status');
  const data = await response.json();
  if (data.oidc?.enabled) {
    setOidcConfig(data.oidc);
  }
};

// Show OIDC button conditionally
{oidcConfig?.enabled && (
  <button onClick={handleOidcLogin}>
    Sign in with {oidcConfig.provider_name}
  </button>
)}
```

#### VerifyEmailPage.jsx
**Location:** `/backend/services/web-ui/src/VerifyEmailPage.jsx`

**Purpose:** Handle email verification from email link

**Flow:**
1. Component receives `token` from URL query param
2. Auto-submits verification request on mount
3. Shows success/error state
4. Auto-redirects to login after 3 seconds

**Usage:**
```javascript
<Route path="/verify-email">
  <VerifyEmailPage
    token={urlParams.get('token')}
    onSuccess={() => navigate('/')}
  />
</Route>
```

#### ResetPasswordPage.jsx
**Location:** `/backend/services/web-ui/src/ResetPasswordPage.jsx`

**Purpose:** Handle password reset from email link

**Features:**
- Password and confirm password inputs
- Show/hide password toggles
- Client-side validation (length, match)
- Token expiration handling

**Usage:**
```javascript
<Route path="/reset-password">
  <ResetPasswordPage
    token={urlParams.get('token')}
    onSuccess={() => navigate('/')}
  />
</Route>
```

#### App.jsx Routing
**Location:** `/backend/services/web-ui/src/App.jsx`

**Special Route Handling:**
```javascript
// Handle special routes BEFORE auth check
const isSpecialRoute =
  location.pathname === '/verify-email' ||
  location.pathname === '/reset-password';

if (isSpecialRoute) {
  // Allow access without authentication
  return <VerifyEmailPage /> or <ResetPasswordPage />;
}

// Normal auth check for all other routes
if (!currentUser) {
  return <LandingPage />;
}
```

---

### Mobile UI Architecture

**Technology Stack:**
- React Native (Expo)
- React Navigation (stack + tab)
- AsyncStorage for persistence
- Expo SecureStore for biometrics
- Deep linking support

**Key Screens:**

#### LandingScreen.js
**Location:** `/mobile/src/screens/LandingScreen.js`

**Purpose:** Server configuration (first-time setup)

**Flow:**
1. Check if `API_BASE_URL` exists in AsyncStorage
2. If not → show server config form
3. If yes → show auth buttons (navigate to Login/Signup)

#### LoginScreen.js
**Location:** `/mobile/src/screens/LoginScreen.js`

**Purpose:** Handle login with multiple methods

**Features:**
- Username/password login
- OIDC button (fetches config from `/api/auth/status`)
- Biometric login (if enabled)
- "OR" dividers between methods
- Forgot password link

**Integration:**
```javascript
// Fetch OIDC config on mount
useEffect(() => {
  fetchOidcConfig();
}, []);

const fetchOidcConfig = async () => {
  const baseURL = await getApiBaseUrl();
  const response = await fetch(`${baseURL}/api/auth/status`);
  const data = await response.json();
  if (data.oidc?.enabled) {
    setOidcConfig(data.oidc);
  }
};

// Open OIDC login in browser
const handleOidcLogin = async () => {
  const baseURL = await getApiBaseUrl();
  const oidcUrl = `${baseURL}/api/auth/oidc/login`;

  Alert.alert(
    'OIDC Login',
    `Opening browser to sign in with ${oidcConfig.provider_name}`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Continue',
        onPress: () => Linking.openURL(oidcUrl)
      }
    ]
  );
};
```

#### SignupScreen.js
**Location:** `/mobile/src/screens/SignupScreen.js`

**Purpose:** User registration

**Features:**
- Form validation
- Email verification prompt after signup
- Immediate session creation

#### VerifyEmailScreen.js
**Location:** `/mobile/src/screens/VerifyEmailScreen.js`

**Purpose:** Handle email verification from deep link

**Deep Link URL:** `pantrypal://verify-email?token=xyz`

**Flow:**
1. App opens from deep link with token
2. Screen auto-submits verification request
3. Shows success/error message
4. Navigates to Login on success

#### ResetPasswordScreen.js
**Location:** `/mobile/src/screens/ResetPasswordScreen.js`

**Purpose:** Handle password reset from deep link

**Deep Link URL:** `pantrypal://reset-password?token=xyz`

**Features:**
- Password input with show/hide toggle
- Confirm password validation
- Token expiration handling

---

### Deep Linking Configuration

**Mobile Deep Links:**
```
Custom Scheme:  pantrypal://
Universal Links: https://pantrypal.palstack.io
```

**Supported Routes:**
```javascript
{
  screens: {
    VerifyEmail: 'verify-email',    // pantrypal://verify-email?token=xyz
    ResetPassword: 'reset-password', // pantrypal://reset-password?token=xyz
    Home: '',                        // pantrypal://
  }
}
```

**Configuration Files:**
- `/mobile/app.json` - Expo config with scheme
- `/mobile/App.js` - Linking configuration

**Email Links:**
- Web: `https://pantrypal.palstack.io/verify-email?token=xyz`
- Mobile: `pantrypal://verify-email?token=xyz`

Both work on mobile (universal links fall back to custom scheme).

---

### Session Management

#### Web

**Storage:** HTTP-only cookies (secure, httpOnly flags in production)

**Cookie Name:** `session_token`

**API Usage:**
```javascript
// Cookies sent automatically with fetch
const response = await fetch('/api/items', {
  credentials: 'include'  // Include cookies
});
```

**Logout:**
```javascript
await fetch('/api/auth/logout', {
  method: 'POST',
  credentials: 'include'
});
// Cookie cleared by server (Set-Cookie with expired date)
```

#### Mobile

**Storage:** AsyncStorage (unencrypted, but app sandboxed)

**Key:** `SESSION_TOKEN`

**API Usage:**
```javascript
// api.js wraps fetch with auto-injected token
import api from './services/api';

const response = await api.get('/api/items');
// Automatically adds Authorization header
```

**Implementation:**
```javascript
// /mobile/src/services/api.js
const getSessionToken = async () => {
  return await AsyncStorage.getItem('SESSION_TOKEN');
};

const apiGet = async (url) => {
  const token = await getSessionToken();
  return fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
};
```

**Logout:**
```javascript
await AsyncStorage.removeItem('SESSION_TOKEN');
await AsyncStorage.removeItem('API_BASE_URL');
// Navigate to LandingScreen
```

---

## Security Architecture

### Password Security

**Hashing Algorithm:** bcrypt (cost factor 12)

**Why bcrypt:**
- Adaptive: cost factor increases with hardware advances
- Salt built-in (random per password)
- Resistant to rainbow table attacks
- Resistant to GPU brute-force (memory-hard)

**Code:**
```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Hash password
password_hash = pwd_context.hash(plain_password)

# Verify password
is_valid = pwd_context.verify(plain_password, password_hash)
```

**Minimum Requirements:**
- 8 characters minimum
- No complexity requirements (NIST recommends length over complexity)

---

### Session Security

**Token Generation:**
```python
import uuid
session_token = str(uuid.uuid4())  # Cryptographically random
```

**Session Expiry:** 30 days from creation

**Cookie Flags (Production):**
- `httpOnly=True` - JavaScript cannot access
- `secure=True` - HTTPS only
- `sameSite='Lax'` - CSRF protection

**Mobile Tokens:**
- Stored in AsyncStorage (app-sandboxed)
- No expiry client-side (server validates expiry)
- Cleared on logout

---

### OIDC Security

**Flow:** Authorization Code Flow (most secure)

**State Parameter:** Random UUID prevents CSRF

**Token Validation:**
- Access token validated via provider's userinfo endpoint
- No JWT signature validation needed (trust provider)

**Provider Trust:**
- Only admin can configure OIDC (via environment variables)
- Discovery URL fetches provider metadata
- Supports any OIDC-compliant provider

**Account Linking:**
- Email matching only if `OIDC_AUTO_LINK=true`
- Provider email must be verified (trust provider)
- OIDC connections stored separately (can have both password + OIDC)

---

### API Key Security

**Generation:**
```python
import secrets
api_key = secrets.token_urlsafe(32)  # 256 bits
```

**Storage:** SHA256 hash (not bcrypt, as not rate-limited)

**Validation:**
```python
import hashlib

key_hash = hashlib.sha256(api_key.encode()).hexdigest()
# Lookup key_hash in database
```

**Revocation:** Admin deletes API key from database

**Rate Limiting:** Not implemented (should be added for production)

---

### Email Token Security

**Verification Tokens:**
- Random 32-byte URL-safe string
- Stored in database with 24-hour expiry
- Single-use (deleted after verification)

**Reset Tokens:**
- Random 32-byte URL-safe string
- NOT stored in database (computed on-demand)
- 1-hour expiry embedded in token
- Signed with secret key (HMAC)

**Token Format:**
```
reset-token = base64(timestamp || hmac(timestamp, secret))
```

**Validation:**
```python
def validate_reset_token(token):
    timestamp, signature = decode_token(token)
    if time.now() - timestamp > 1_hour:
        return False
    if hmac(timestamp, secret) != signature:
        return False
    return True
```

---

### SQL Injection Prevention

**All queries use parameterized statements:**

```python
# SAFE - parameterized
cursor.execute("SELECT * FROM users WHERE username = ?", (username,))

# UNSAFE - string interpolation (NEVER DO THIS)
cursor.execute(f"SELECT * FROM users WHERE username = '{username}'")
```

**Foreign Key Constraints:** CASCADE deletes ensure data consistency

---

### XSS Prevention

**Web UI:**
- React auto-escapes all text content
- No `dangerouslySetInnerHTML` usage
- No inline event handlers in strings

**Mobile:**
- React Native doesn't render HTML by default
- All user input rendered as `<Text>` (safe)

---

### CSRF Prevention

**Web:**
- Session cookies use `sameSite='Lax'`
- OIDC flow uses state parameter

**Mobile:**
- Not applicable (Bearer tokens in Authorization header)

---

## Environment Configuration

### Required Variables

```bash
# SMTP Configuration (Required for email features)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=PantryPal
SMTP_USE_TLS=true

# Application URL (Required for email links)
APP_URL=https://pantrypal.palstack.io
```

### Optional Variables

```bash
# OIDC Configuration (Optional, disabled by default)
OIDC_ENABLED=false
OIDC_PROVIDER_NAME=Google
OIDC_CLIENT_ID=your-client-id.apps.googleusercontent.com
OIDC_CLIENT_SECRET=your-client-secret
OIDC_DISCOVERY_URL=https://accounts.google.com/.well-known/openid-configuration
OIDC_REDIRECT_URI=https://pantrypal.palstack.io/api/auth/oidc/callback
OIDC_SCOPES=openid profile email
OIDC_AUTO_LINK=true
OIDC_AUTO_CREATE=true
```

### Docker Compose Example

```yaml
services:
  api-gateway:
    image: harung43/pantrypal-api-gateway:latest
    environment:
      - SMTP_HOST=smtp.gmail.com
      - SMTP_PORT=587
      - SMTP_USERNAME=${SMTP_USERNAME}
      - SMTP_PASSWORD=${SMTP_PASSWORD}
      - SMTP_FROM_EMAIL=${SMTP_FROM_EMAIL}
      - SMTP_FROM_NAME=PantryPal
      - SMTP_USE_TLS=true
      - APP_URL=https://pantrypal.palstack.io
      - OIDC_ENABLED=false
```

---

## OIDC Integration Guide

### Google OAuth Setup

**1. Create OAuth Client:**
- Go to https://console.cloud.google.com/apis/credentials
- Click "Create Credentials" → "OAuth Client ID"
- Application type: "Web application"
- Add redirect URI: `{APP_URL}/api/auth/oidc/callback`

**2. Configure Environment:**
```bash
OIDC_ENABLED=true
OIDC_PROVIDER_NAME=Google
OIDC_CLIENT_ID=123456-abc.apps.googleusercontent.com
OIDC_CLIENT_SECRET=GOCSPX-abc123
OIDC_DISCOVERY_URL=https://accounts.google.com/.well-known/openid-configuration
OIDC_REDIRECT_URI=https://pantrypal.palstack.io/api/auth/oidc/callback
```

**3. Test:**
- Restart services
- Open web UI
- "Sign in with Google" button should appear
- Click button → redirects to Google login

---

### Microsoft Azure AD Setup

**1. Register Application:**
- Go to https://portal.azure.com
- Navigate to "Azure Active Directory" → "App registrations"
- Click "New registration"
- Add redirect URI: `{APP_URL}/api/auth/oidc/callback`

**2. Create Client Secret:**
- Go to "Certificates & secrets"
- Click "New client secret"
- Copy secret value (shown once)

**3. Configure Environment:**
```bash
OIDC_ENABLED=true
OIDC_PROVIDER_NAME=Microsoft
OIDC_CLIENT_ID=12345678-1234-1234-1234-123456789abc
OIDC_CLIENT_SECRET=abc~123
OIDC_DISCOVERY_URL=https://login.microsoftonline.com/{tenant-id}/v2.0/.well-known/openid-configuration
OIDC_REDIRECT_URI=https://pantrypal.palstack.io/api/auth/oidc/callback
```

**Note:** Replace `{tenant-id}` with your Azure AD tenant ID.

---

### Keycloak Setup

**1. Create Client:**
- Open Keycloak admin console
- Select realm
- Go to "Clients" → "Create"
- Client ID: `pantrypal`
- Client Protocol: `openid-connect`
- Access Type: `confidential`

**2. Configure Client:**
- Valid Redirect URIs: `{APP_URL}/api/auth/oidc/callback`
- Save settings
- Go to "Credentials" tab
- Copy client secret

**3. Configure Environment:**
```bash
OIDC_ENABLED=true
OIDC_PROVIDER_NAME=Keycloak
OIDC_CLIENT_ID=pantrypal
OIDC_CLIENT_SECRET=abc123def456
OIDC_DISCOVERY_URL=https://keycloak.example.com/realms/master/.well-known/openid-configuration
OIDC_REDIRECT_URI=https://pantrypal.palstack.io/api/auth/oidc/callback
```

---

### Authentik Setup

**1. Create Provider:**
- Open Authentik admin interface
- Go to "Applications" → "Providers"
- Click "Create" → "OAuth2/OpenID Provider"
- Name: `PantryPal`
- Authorization flow: `default-provider-authorization-implicit-consent`
- Redirect URIs: `{APP_URL}/api/auth/oidc/callback`

**2. Create Application:**
- Go to "Applications" → "Applications"
- Click "Create"
- Name: `PantryPal`
- Provider: Select provider created above

**3. Configure Environment:**
```bash
OIDC_ENABLED=true
OIDC_PROVIDER_NAME=Authentik
OIDC_CLIENT_ID=abc123
OIDC_CLIENT_SECRET=def456
OIDC_DISCOVERY_URL=https://authentik.example.com/application/o/pantrypal/.well-known/openid-configuration
OIDC_REDIRECT_URI=https://pantrypal.palstack.io/api/auth/oidc/callback
```

---

### Custom OIDC Provider

For providers without discovery support:

```bash
OIDC_ENABLED=true
OIDC_PROVIDER_NAME=Custom SSO
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_AUTHORIZATION_ENDPOINT=https://provider.com/oauth/authorize
OIDC_TOKEN_ENDPOINT=https://provider.com/oauth/token
OIDC_USERINFO_ENDPOINT=https://provider.com/oauth/userinfo
OIDC_REDIRECT_URI=https://pantrypal.palstack.io/api/auth/oidc/callback
```

**Required Provider Endpoints:**
- Authorization endpoint (OAuth 2.0)
- Token endpoint (OAuth 2.0)
- Userinfo endpoint (OpenID Connect)

**Required User Info Claims:**
- `sub` (subject identifier - unique user ID)
- `email` (optional, but required for auto-linking)
- `name` (optional, used for display name)

---

## Mobile-Specific Features

### Biometric Authentication

**Setup Flow:**
1. User logs in with username/password (first time)
2. App checks if biometric available (`LocalAuthentication.hasHardwareAsync()`)
3. App prompts user to enable biometric login
4. On acceptance:
   - App requests biometric auth to confirm identity
   - Credentials encrypted with device secure enclave
   - Stored in `SecureStore`
   - Flag set: `biometric_enabled=true`

**Login Flow:**
1. User opens app
2. App checks if biometric enabled
3. Shows "Sign in with Face ID" button
4. On tap:
   - Request biometric auth
   - On success: retrieve encrypted credentials
   - Decrypt with secure enclave
   - Auto-login with username/password

**Security:**
- Credentials never stored in plain text
- Encryption key tied to device (can't export)
- Biometric data never leaves device
- Can disable at any time (clears stored credentials)

**Code Location:** `/mobile/src/services/biometricAuth.js`

**Supported Platforms:**
- iOS: Face ID, Touch ID
- Android: Fingerprint, Face Unlock

---

### Deep Linking

**Setup:**

`/mobile/app.json`:
```json
{
  "expo": {
    "scheme": "pantrypal",
    "experiments": {
      "typedRoutes": false
    }
  }
}
```

`/mobile/App.js`:
```javascript
const linking = {
  prefixes: [
    'pantrypal://',
    'https://pantrypal.palstack.io',
    'http://pantrypal.palstack.io'
  ],
  config: {
    screens: {
      VerifyEmail: 'verify-email',
      ResetPassword: 'reset-password',
      Home: '',
    }
  }
};

<NavigationContainer linking={linking}>
  <Stack.Navigator>
    <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
    <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
  </Stack.Navigator>
</NavigationContainer>
```

**Supported Links:**

| URL | Screen | Purpose |
|-----|--------|---------|
| `pantrypal://verify-email?token=xyz` | VerifyEmailScreen | Email verification |
| `pantrypal://reset-password?token=xyz` | ResetPasswordScreen | Password reset |
| `https://pantrypal.palstack.io/verify-email?token=xyz` | VerifyEmailScreen | Universal link (fallback) |

**Email Template:**

Backend generates mobile-friendly links:
```python
# Check if client is mobile (via User-Agent or explicit param)
if is_mobile:
    verification_link = f"pantrypal://verify-email?token={token}"
else:
    verification_link = f"{APP_URL}/verify-email?token={token}"
```

Currently, backend uses web URLs for all emails. Mobile apps handle universal links and fall back to custom scheme.

---

### Offline Handling

**Session Persistence:**
- Session token stored in AsyncStorage
- Persists across app restarts
- App checks session validity on startup
- If expired → redirect to login

**API Error Handling:**
```javascript
try {
  const response = await api.get('/api/items');
  if (!response.ok) {
    if (response.status === 401) {
      // Session expired → logout
      await logout();
    }
  }
} catch (error) {
  // Network error
  Alert.alert('Connection Error', 'Could not reach server');
}
```

---

## Troubleshooting

### Common Issues

#### 1. Email Verification Links Not Working

**Symptom:** Clicking email link shows "Invalid token"

**Causes:**
- Token expired (24-hour TTL)
- User already verified
- `APP_URL` misconfigured

**Debug:**
```bash
# Check APP_URL matches your domain
echo $APP_URL

# Check email link format in logs
docker logs pantrypal-api-gateway-1 | grep "verification_link"

# Check database
sqlite3 data/pantrypal.db "SELECT email_verified FROM users WHERE email='user@example.com'"
```

**Fix:**
- Resend verification email
- Update `APP_URL` to match public domain
- Manually verify user in database if needed

---

#### 2. OIDC Login Fails

**Symptom:** OIDC button doesn't appear or login fails

**Causes:**
- `OIDC_ENABLED=false` (disabled)
- `OIDC_REDIRECT_URI` doesn't match provider config
- Provider credentials invalid

**Debug:**
```bash
# Check OIDC config
curl http://localhost:3000/api/auth/status

# Should return:
# {"authenticated": false, "oidc": {"enabled": true, "provider_name": "Google"}}

# Check logs for OIDC errors
docker logs pantrypal-api-gateway-1 | grep "OIDC"
```

**Fix:**
- Set `OIDC_ENABLED=true`
- Verify `OIDC_REDIRECT_URI` matches provider config exactly
- Check client ID/secret are correct
- Test discovery URL: `curl {OIDC_DISCOVERY_URL}`

---

#### 3. Password Reset Email Not Received

**Symptom:** User doesn't receive reset email

**Causes:**
- SMTP not configured
- Gmail blocking "less secure apps"
- Email in spam folder
- Email doesn't exist in database

**Debug:**
```bash
# Check SMTP config
docker logs pantrypal-api-gateway-1 | grep "SMTP"

# Test SMTP connection
python -c "import smtplib; smtplib.SMTP('smtp.gmail.com', 587).starttls()"
```

**Fix:**
- Use Gmail App Password (not regular password)
- Check spam folder
- Verify SMTP credentials
- Test with different email provider

---

#### 4. Biometric Login Not Working (Mobile)

**Symptom:** "Sign in with Face ID" button doesn't appear

**Causes:**
- Device doesn't support biometric
- User hasn't enabled biometric on device
- User hasn't enrolled biometric in app

**Debug:**
```javascript
// Check biometric availability
import * as LocalAuthentication from 'expo-local-authentication';

const hasHardware = await LocalAuthentication.hasHardwareAsync();
const isEnrolled = await LocalAuthentication.isEnrolledAsync();
const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

console.log({ hasHardware, isEnrolled, types });
```

**Fix:**
- Enable Face ID/Touch ID in device settings
- Login with password first, then enroll biometric
- Check app permissions for biometric access

---

#### 5. Session Expired Too Quickly

**Symptom:** User logged out after short time

**Causes:**
- Clock skew between client and server
- Session expiry set too short
- Session token not stored correctly

**Debug:**
```bash
# Check session expiry (default 30 days)
sqlite3 data/pantrypal.db "SELECT created_at, expires_at FROM sessions ORDER BY created_at DESC LIMIT 1"

# Check if session token stored
# Web: Check browser cookies (DevTools → Application → Cookies)
# Mobile: Check AsyncStorage logs
```

**Fix:**
- Verify system clocks are synchronized
- Check session token is stored (cookie or AsyncStorage)
- Increase session expiry if needed (edit `main.py`)

---

## File Reference

### Backend Files

| File | Purpose |
|------|---------|
| `/backend/services/api-gateway/app/main.py` | Main FastAPI app, auth endpoints |
| `/backend/services/api-gateway/app/user_db.py` | Database functions (users, sessions, API keys) |
| `/backend/services/api-gateway/app/email_service.py` | Email sending (verification, reset, welcome) |
| `/backend/services/api-gateway/app/oidc.py` | OIDC configuration and OAuth client |
| `/backend/services/api-gateway/requirements.txt` | Python dependencies (includes `authlib`) |
| `/backend/.env` | Environment configuration |
| `/backend/docker-compose.yml` | Docker service definitions |

### Web UI Files

| File | Purpose |
|------|---------|
| `/backend/services/web-ui/src/LandingPage.jsx` | Landing, login, signup, forgot password |
| `/backend/services/web-ui/src/VerifyEmailPage.jsx` | Email verification page |
| `/backend/services/web-ui/src/ResetPasswordPage.jsx` | Password reset page |
| `/backend/services/web-ui/src/App.jsx` | Main app, routing, special route handling |
| `/backend/services/web-ui/src/api.js` | API client utilities |

### Mobile App Files

| File | Purpose |
|------|---------|
| `/mobile/src/screens/LandingScreen.js` | Server configuration |
| `/mobile/src/screens/LoginScreen.js` | Login (password, OIDC, biometric) |
| `/mobile/src/screens/SignupScreen.js` | User registration |
| `/mobile/src/screens/VerifyEmailScreen.js` | Email verification |
| `/mobile/src/screens/ResetPasswordScreen.js` | Password reset |
| `/mobile/src/screens/ForgotPasswordScreen.js` | Request password reset |
| `/mobile/src/services/api.js` | API client with auto-injected tokens |
| `/mobile/src/services/biometricAuth.js` | Biometric authentication utilities |
| `/mobile/App.js` | Navigation, deep linking config |
| `/mobile/app.json` | Expo config, deep linking scheme |

---

## Changelog

### v1.3.0 (January 2026)
- ✅ Added OIDC/OAuth 2.0 authentication
- ✅ Added `oidc_connections` database table
- ✅ Added OIDC login button to web and mobile UI
- ✅ Added OIDC provider setup guides
- ✅ Added auto-link and auto-create OIDC features
- ✅ Updated environment configuration documentation

### v1.2.0 (December 2025)
- ✅ Added email verification for new users
- ✅ Added password reset flow
- ✅ Added admin user creation with auto-verification
- ✅ Added welcome email with password reset link
- ✅ Fixed email links to use `APP_URL` environment variable
- ✅ Added show/hide password toggles
- ✅ Added mobile deep linking support

### v1.1.0 (November 2025)
- ✅ Added biometric authentication (mobile)
- ✅ Added API key authentication
- ✅ Added session expiry (30 days)
- ✅ Improved mobile UI with glass morphism

### v1.0.0 (October 2025)
- ✅ Initial release
- ✅ Username/password authentication
- ✅ Session-based authentication
- ✅ Admin user management

---

## License

This documentation is part of the PantryPal project.

**Repository:** https://github.com/harung1993/PantryPal
**Documentation:** https://github.com/harung1993/PantryPal/tree/main/backend/docs

---

## Contributing

Found an issue or want to improve the auth system? Please open an issue or pull request on GitHub.

**Contact:** PalStack Team - support@palstack.io
