# PantryPal Changelog

## [1.4.0] - 2026-01-29

### Added
- **Shared Household Model**: Complete rewrite of data isolation model
  - **Shared Pantry**: One pantry for the whole household
  - **Shared Recipes**: Imported recipes visible to all users
  - **Per-User Preferences**: Favorites, notes, and cooking history are private per user
  - **New `UserRecipePreference` model** for storing per-user recipe data

- **Admin Promotion/Demotion**: Admins can now promote/demote users
  - Added `is_admin` field to user update endpoint
  - Safety: Cannot modify your own admin status
  - Safety: Cannot remove the last admin

- **Test Script**: Added `test_shared_household.sh` for verifying all features

### Changed
- **Registration Disabled by Default**: `ALLOW_REGISTRATION` now defaults to `false`
  - Admins create user accounts via Admin panel
  - More secure for household deployments

- **Recipe Integration Admin-Only**: Mealie/Tandoor configuration requires admin
  - All users can still import and view recipes
  - Only admins can configure the integration endpoints

- **Database**: Migrated from SQLite to PostgreSQL
  - Automatic migration for existing data
  - Recipe deduplication during migration

### Security
- Default admin credentials: `admin` / `admin` (change immediately!)
- Last admin protection prevents accidental lockout

---

## [Unreleased] - 2026-01-21

### Fixed
- **Password Reset Email Links**: Fixed issue where password reset and email verification links were missing port numbers, causing redirects to homepage instead of proper flows
  - Root cause: `APP_URL` environment variable didn't match actual service access URL
  - Solution: Updated `APP_URL` to `http://192.168.68.104:8080` to match nginx exposed port
  - Impact: Password reset and email verification now work correctly

### Added
- **Comprehensive Documentation**:
  - `backend/docs/BACKEND_SERVICE_TEMPLATE.md` - Complete template for creating new backend microservices with FastAPI
  - `backend/docs/FRONTEND_SERVICE_TEMPLATE.md` - Templates for web (React+Vite) and mobile (React Native+Expo) frontends
  - `backend/docs/TROUBLESHOOTING_EMAIL_LINKS.md` - Troubleshooting guide for email link issues
  - `mobile/TESTFLIGHT_DEPLOY.md` - Step-by-step TestFlight deployment workflow

### Changed
- **Environment Configuration**:
  - Enhanced `backend/.env.example` with detailed APP_URL configuration examples
  - Added port configuration guidance for different deployment scenarios
  - Documented when to include/exclude ports in APP_URL

- **Mobile App**:
  - Updated default API URL in `mobile/config.js` from `192.168.68.79:8888` to `192.168.68.104:8080`
  - Updated example URLs in LandingScreen to show proper port usage
  - No TestFlight push required (cosmetic changes only)

### Infrastructure
- **Docker Images**: Rebuilt and pushed all services to Docker Hub
  - Multi-architecture support: AMD64 + ARM64
  - Services: web-ui, api-gateway, inventory-service, lookup-service, nginx
  - Available at: `docker.io/harung43/pantrypal-*:latest`

## [1.3.0] - Previous Release

### Features
- OIDC/OAuth authentication support (Google, Microsoft, Keycloak, Authentik)
- Biometric authentication for mobile (Face ID, Touch ID)
- Email verification flow
- Password reset flow
- Multi-user support with admin capabilities
- API key authentication for integrations
- Smart authentication mode (network-based access control)

### Services
- API Gateway (FastAPI + PostgreSQL) - Authentication, authorization, routing
- Inventory Service (FastAPI + PostgreSQL) - Item management, shopping lists
- Lookup Service (FastAPI + Open Food Facts) - Barcode lookup with caching
- Web UI (React + Vite) - Desktop/tablet dashboard
- Mobile App (React Native + Expo) - iOS app with barcode scanning
- Nginx - Reverse proxy and static file serving

---

## Version Format

Following Semantic Versioning (semver):
- **Major** (X.0.0): Breaking changes, major new features
- **Minor** (1.X.0): New features, backward compatible
- **Patch** (1.0.X): Bug fixes, documentation

## Deployment Notes

### Backend
```bash
cd backend
docker compose down
docker compose pull  # Pull latest images
docker compose up -d
```

### Mobile (TestFlight)
```bash
cd mobile
# Increment buildNumber in app.json
eas build --platform ios --profile preview --auto-submit
```

### Environment Variables
Always check `.env.example` for new variables after updates.

---

## Links

- **GitHub**: https://github.com/harung43/pantrypal
- **Docker Hub**: https://hub.docker.com/u/harung43
- **Documentation**: `/backend/docs/`
- **Issues**: https://github.com/harung43/pantrypal/issues
