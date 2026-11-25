# Configuration

Everything you can set in `.env`, how sign-in works, and how the shared household works. The [README](../README.md) has the quick start.

## Authentication Modes

pantryPal supports flexible authentication to fit different use cases. Configure `AUTH_MODE` in `docker-compose.yml`:

| Mode | Best For | Home Network | External Access |
|------|----------|--------------|-----------------|
| **full** | Maximum security (recommended) | Login required | Login required |
| **smart** | Convenience + security | Auto-login on home network | Login required externally |
| **api_key_only** | API integrations only | API key required | API key required |
| **none** | Single user only (not recommended) | Open access | Open access (insecure) |

**Default Mode:** `full` - All users must create accounts and login, ensuring secure access from anywhere.

### Authentication Features
- **Session-based authentication** for web and mobile (extends automatically while in use)
- **API key support** for Home Assistant and service integrations
- **Biometric authentication** on mobile (Face ID, Touch ID, Fingerprint)
- **Google and Apple sign-in** (native ID-token verification)
- **OIDC/OAuth2 support** for Single Sign-On with any OIDC provider:
  - Authentik, Keycloak, Authelia, Okta, Azure AD / Microsoft Entra
  - Auto account linking by verified email
  - Authorization-code flow with state validation
- **Email verification** for new accounts
- **Password reset** via email (1-hour token TTL)
- **Multi-user support** with admin capabilities
- **Device tracking** for active sessions

---

## Configuration

### Environment Variables

pantryPal can be configured via environment variables in your `.env` file or `docker-compose.yml`:

#### Required Secrets
No defaults. `docker compose` refuses to start until each is set. The [quick start](../README.md#quick-start) generates them for you.

| Variable | Description |
|----------|-------------|
| `DB_PASSWORD` | PostgreSQL password. Fixed at first start — don't change it afterwards |
| `SECRET_KEY` | Encryption key for stored integration credentials; also signs the SSO login round-trip |
| `INTERNAL_SERVICE_TOKEN` | Shared token the internal services use to authenticate each other |
| `ENCRYPTION_SALT` | Salt for encrypting stored integration credentials |
| `ADMIN_DEFAULT_PASSWORD` | Password for the `admin` account created on first start. At least 12 characters; published defaults are refused. Used once: change the password in the app afterwards |

#### Authentication & Security
| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_MODE` | `full` | Authentication mode: `full`, `smart`, `api_key_only`, `none` |
| `ALLOW_REGISTRATION` | `false` | Enable public user registration |
| `APP_URL` | `http://localhost:8888` | Base URL for email links |
| `HTTP_PORT` | `8888` | Port pantryPal is served on |

#### Email Configuration
| Variable | Default | Description |
|----------|---------|-------------|
| `SMTP_HOST` | - | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_USERNAME` | - | SMTP authentication username |
| `SMTP_PASSWORD` | - | SMTP authentication password |
| `SMTP_FROM_EMAIL` | - | Sender email address |
| `SMTP_FROM_NAME` | `pantryPal` | Sender display name |
| `SMTP_USE_TLS` | `true` | Enable TLS encryption |

#### Google Sign-In (Optional)
| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | - | Native ID-token sign-in — no redirect flow, no client secret |

#### Generic OIDC / SSO (Optional)
Redirect-flow OIDC for self-hosted IdPs — Authentik, Keycloak, Authelia, Okta, Azure AD, or any OIDC-compliant provider. Independent of Google Sign-In above; both can be enabled at once.

| Variable | Default | Description |
|----------|---------|-------------|
| `OIDC_ENABLED` | `false` | Enable generic OIDC authentication |
| `OIDC_CLIENT_ID` | - | OAuth2 client ID |
| `OIDC_CLIENT_SECRET` | - | OAuth2 client secret |
| `OIDC_DISCOVERY_URL` | - | OIDC discovery endpoint |
| `OIDC_PROVIDER_NAME` | `SSO` | Display name for provider (shown on login button) |
| `OIDC_SCOPES` | `openid profile email` | OAuth scopes to request |
| `OIDC_AUTO_LINK` | `true` | Link to an existing account by verified email |
| `OIDC_AUTO_CREATE` | `true` | Create a new account on first login if no match |

#### Local Image Storage
| Variable | Default | Description |
|----------|---------|-------------|
| `LOCAL_STORAGE_PATH` | `/app/data/storage` | Where recipe/product/user images are stored on disk |

#### Advanced
| Variable | Default | Description |
|----------|---------|-------------|
| `CORS_ORIGINS` | `*` | Allowed CORS origins (comma-separated) |
| `DATABASE_URL` | - | PostgreSQL connection string (auto-configured) |

### Example Configuration

```bash
# .env file
# Required — generate each with: openssl rand -hex 32
DB_PASSWORD=<generated>
SECRET_KEY=<generated>
INTERNAL_SERVICE_TOKEN=<generated>
ENCRYPTION_SALT=<generated>
ADMIN_DEFAULT_PASSWORD=<generated, e.g. openssl rand -base64 18>

AUTH_MODE=full
ALLOW_REGISTRATION=false
APP_URL=https://pantry.yourdomain.com

# Email notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=pantryPal

# Optional: Google OAuth
OIDC_ENABLED=true
OIDC_CLIENT_ID=your-google-client-id
OIDC_CLIENT_SECRET=your-google-client-secret
OIDC_DISCOVERY_URL=https://accounts.google.com/.well-known/openid-configuration
OIDC_PROVIDER_NAME=Google
```

---

## Shared Household Model

pantryPal is designed for **household use** - one instance serves one household with shared data and individual preferences.

### How It Works

| Data Type | Scope | Description |
|-----------|-------|-------------|
| **Pantry Items** | Shared | One pantry for the whole household |
| **Shopping List** | Shared | Everyone adds to and checks off the same list |
| **Recipes** | Shared | All users see the same imported recipes |
| **Recipe Favorites** | Per-user | Each user has their own favorites list |
| **Recipe Notes** | Per-user | Personal notes visible only to you |
| **Recipe Integrations** | Admin-only | Mealie/Tandoor setup requires admin |

### User Management

**Registration is disabled by default.** The admin creates accounts for household members:

1. Sign in as `admin` with your `ADMIN_DEFAULT_PASSWORD` and go to **Admin → Users**
2. Click **Create User** and enter their email
3. User receives an email invitation to set their password
4. User logs in and can immediately access the shared pantry and recipes

### Admin Responsibilities

Admins can:
- Create, edit, and delete user accounts
- Promote/demote users to admin status (must have at least one admin)
- Configure recipe integrations (Mealie, Tandoor)
- Configure OIDC authentication providers
- Access system statistics and user management

**Important:** The last admin cannot be demoted - there must always be at least one admin.

### Recipe Integrations

Connect to external recipe managers to import recipes for the whole household:

- **Mealie** - Self-hosted recipe manager
- **Tandoor** - Self-hosted recipe manager

Only admins can configure integrations, but all users can:
- View imported recipes
- Import new recipes (any user)
- Delete recipes (any user)
- Add recipes to their personal favorites
- Add private recipe notes
- Mark recipes as cooked
- See which recipes can be made with available ingredients
- Find recipes that use expiring items
- Add missing ingredients to shopping list

---
