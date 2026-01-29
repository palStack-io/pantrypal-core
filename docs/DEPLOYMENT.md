# PantryPal Deployment Guide

**Version:** 1.4.0
**Last Updated:** January 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Shared Household Model](#shared-household-model)
3. [First-Time Setup](#first-time-setup)
4. [Adding Users](#adding-users)
5. [Recipe Integration (Mealie/Tandoor)](#recipe-integration)
6. [Environment Configuration](#environment-configuration)
7. [Production Checklist](#production-checklist)

---

## Overview

PantryPal is designed for household/family deployments where a single instance serves all household members. This guide covers the shared household model and deployment best practices.

---

## Shared Household Model

PantryPal uses a **shared household model** where:

### Shared Across All Users
- **Pantry inventory** - All users see and can manage the same pantry items
- **Recipes** - Imported recipes are available to all household members
- **Recipe integration settings** - Mealie/Tandoor configuration is household-level

### Per-User (Private)
- **Favorites** - Each user has their own list of favorite recipes
- **Recipe notes** - Personal notes on recipes are private
- **Cooking history** - Times cooked and last cooked date are per-user
- **Recipe match percentages** - Based on shared pantry, but stored per-user

### Permission Levels

| Action | Regular User | Admin |
|--------|-------------|-------|
| View pantry | ✅ | ✅ |
| Add/edit/delete pantry items | ✅ | ✅ |
| View recipes | ✅ | ✅ |
| Import recipes | ✅ | ✅ |
| Delete recipes | ✅ | ✅ |
| Favorite/unfavorite recipes | ✅ | ✅ |
| Add notes to recipes | ✅ | ✅ |
| Configure Mealie/Tandoor | ❌ | ✅ |
| Create new users | ❌ | ✅ |
| Promote/demote admins | ❌ | ✅ |
| Delete users | ❌ | ✅ |

---

## First-Time Setup

### 1. Start the Services

```bash
# Clone the repository
git clone https://github.com/palstack-io/pantrypal.git
cd pantrypal/backend

# Start with Docker Compose
docker compose up -d
```

### 2. Access the Application

Open your browser to `http://localhost:8888`

### 3. Login with Default Admin

A default admin account is created on first startup:

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin` |

⚠️ **IMPORTANT:** Change the default password immediately!

1. Login with `admin` / `admin`
2. Go to Settings → Change Password
3. Set a strong, unique password

### 4. Configure Email (Optional but Recommended)

If you want password reset and welcome emails to work, configure SMTP:

```yaml
# docker-compose.yml
environment:
  - SMTP_HOST=smtp.gmail.com
  - SMTP_PORT=587
  - SMTP_USERNAME=your-email@gmail.com
  - SMTP_PASSWORD=your-app-password
  - SMTP_FROM_EMAIL=your-email@gmail.com
  - SMTP_FROM_NAME=PantryPal
  - SMTP_USE_TLS=true
  - APP_URL=https://your-domain.com
```

**Note:** For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833), not your regular password.

---

## Adding Users

### Registration is Disabled by Default

Self-registration is disabled by default (`ALLOW_REGISTRATION=false`) for security. This is appropriate for household deployments where the admin controls who has access.

### Method 1: Admin Creates Users (Recommended)

1. Login as admin
2. Go to Settings → Users
3. Click "Add User"
4. Fill in:
   - Username
   - Email
   - Temporary password
   - Full name (optional)
5. Click "Create"

The new user will receive a welcome email with a password reset link (if SMTP is configured).

### Method 2: Enable Self-Registration

For demo or open deployments, you can enable self-registration:

```yaml
# docker-compose.yml
environment:
  - ALLOW_REGISTRATION=true
```

Users can then register themselves at the login page.

### Promoting Users to Admin

To give a user admin privileges:

1. Login as admin
2. Go to Settings → Users
3. Find the user and click "Edit"
4. Toggle "Admin" to enabled
5. Save

Or via API:
```bash
curl -X PATCH https://your-domain.com/api/admin/users/{user_id} \
  -H "Content-Type: application/json" \
  -H "Cookie: session_token=..." \
  -d '{"is_admin": true}'
```

**Safety Notes:**
- You cannot remove your own admin status
- You cannot remove admin status from the last admin user

---

## Recipe Integration

PantryPal can import recipes from Mealie or Tandoor recipe managers.

### Configuration (Admin Only)

Only admin users can configure recipe integrations.

1. Login as admin
2. Go to Settings → Recipe Integration
3. Select provider (Mealie or Tandoor)
4. Enter:
   - Server URL (e.g., `https://mealie.your-domain.com`)
   - API Token
5. Click "Test Connection"
6. If successful, click "Save"

### Importing Recipes (Any User)

Once configured by an admin, any user can import recipes:

1. Go to Recipes page
2. Click "Import from [Provider]"
3. Wait for import to complete
4. Recipes appear in the shared recipe list

### How Shared Recipes Work

When a recipe is imported:
- The recipe data (name, ingredients, instructions, image) is shared
- Any user can view, search, and delete the recipe
- User-specific data (favorites, notes, times cooked) is private

Example:
- User A imports "Pasta Carbonara" from Mealie
- User B can see "Pasta Carbonara" in their recipe list
- User A favorites the recipe - User B does not see it as favorited
- User B adds notes - User A cannot see User B's notes
- User B deletes the recipe - it's removed for everyone

---

## Environment Configuration

### Required Environment Variables

```yaml
environment:
  # Database
  - DATABASE_URL=postgresql://pantrypal:password@postgres:5432/pantrypal

  # MinIO (image storage)
  - MINIO_ENDPOINT=minio:9000
  - MINIO_ACCESS_KEY=minioadmin
  - MINIO_SECRET_KEY=minioadmin123

  # Security (CHANGE THIS!)
  - SECRET_KEY=change-this-to-a-random-secret-key-in-production
```

### Authentication Options

```yaml
environment:
  # Authentication mode
  - AUTH_MODE=full  # Options: none, api_key_only, full, smart

  # Registration control
  - ALLOW_REGISTRATION=false  # Admin creates users (recommended)
```

### Optional: Email Configuration

```yaml
environment:
  - SMTP_HOST=smtp.gmail.com
  - SMTP_PORT=587
  - SMTP_USERNAME=your-email@gmail.com
  - SMTP_PASSWORD=your-app-password
  - SMTP_FROM_EMAIL=your-email@gmail.com
  - SMTP_FROM_NAME=PantryPal
  - SMTP_USE_TLS=true
  - APP_URL=https://your-domain.com
```

### Optional: OIDC/SSO Configuration

```yaml
environment:
  - OIDC_ENABLED=true
  - OIDC_PROVIDER_NAME=Google
  - OIDC_CLIENT_ID=your-client-id
  - OIDC_CLIENT_SECRET=your-client-secret
  - OIDC_DISCOVERY_URL=https://accounts.google.com/.well-known/openid-configuration
```

---

## Production Checklist

Before deploying to production, ensure:

### Security

- [ ] Changed default admin password
- [ ] Set a strong, random `SECRET_KEY`
- [ ] Using HTTPS (reverse proxy with SSL)
- [ ] Updated MinIO credentials from defaults
- [ ] Updated PostgreSQL password from defaults

### Configuration

- [ ] Set `AUTH_MODE=full` (or `smart` for local network access)
- [ ] Set `ALLOW_REGISTRATION=false` (unless intentionally open)
- [ ] Configured `APP_URL` to your public domain
- [ ] Configured SMTP for email features (optional)

### Backup

- [ ] PostgreSQL data volume is backed up
- [ ] MinIO data volume is backed up
- [ ] Backup schedule configured

### Monitoring

- [ ] Health check endpoints accessible
- [ ] Log aggregation configured (optional)
- [ ] Container restart policies set

### Example Production docker-compose.yml

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: pantrypal
      POSTGRES_USER: pantrypal
      POSTGRES_PASSWORD: ${DB_PASSWORD}  # Strong password in .env
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  api-gateway:
    image: ghcr.io/palstack-io/pantrypal-api-gateway:latest
    environment:
      - DATABASE_URL=postgresql://pantrypal:${DB_PASSWORD}@postgres:5432/pantrypal
      - SECRET_KEY=${SECRET_KEY}  # Random 64-char string in .env
      - AUTH_MODE=full
      - ALLOW_REGISTRATION=false
      - APP_URL=https://pantrypal.your-domain.com
    restart: unless-stopped

  # ... other services
```

Create a `.env` file with secrets:

```bash
# .env (not committed to git!)
DB_PASSWORD=super-secure-database-password-here
SECRET_KEY=generate-64-random-characters-here
MINIO_ROOT_PASSWORD=minio-secure-password
```

Generate a random secret key:
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

---

## Support

- **Documentation:** https://github.com/palstack-io/pantrypal/tree/main/backend/docs
- **Issues:** https://github.com/palstack-io/pantrypal/issues
- **Contact:** support@palstack.io
