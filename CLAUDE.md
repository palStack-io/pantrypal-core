# pantrypal_core — Claude Code Instructions

## Smoke Test — Run After Major Changes

Run before declaring any task complete or committing:

- Adding or modifying API endpoints in `services/api-gateway`
- Changes to auth flows (login, register, logout, OIDC, API keys)
- Inventory or shopping list CRUD changes
- Docker / `docker-compose.yml` changes
- Database model or migration changes
- Any change that touches more than 3 backend files

```bash
# Stack must be running (docker compose up -d from pantrypal_core/)
./scripts/smoke_test.sh                      # default: http://localhost:8888
./scripts/smoke_test.sh http://localhost:8888

# With auto-cleanup of the test user:
SMOKE_ADMIN_USER=admin SMOKE_ADMIN_PASS=yourpassword ./scripts/smoke_test.sh
```

Exit code 0 = all checks passed. The script registers a temporary `smoketest_<timestamp>` user and exercises: health, auth, API keys, inventory CRUD + pagination, shopping list CRUD, stats, notifications, user profile, API-key auth, logout.

## Web UI Build Check

Run after any change to `services/web-ui/`:

```bash
cd services/web-ui
npm run build          # must exit 0 before shipping
```

## Public Docs — Keep In Sync

The public-facing documentation lives at:

```
/Users/basestation/Documents/Palstacks/palStack/palstack Homepage/pantrypal/docs.html
```

Update it for user-visible or operator-visible changes. Skip for internal refactors, test coverage, or dependency bumps.

| Change type | What to update |
|---|---|
| New user-facing feature (web UI) | Feature grid in the Introduction section |
| New or renamed environment variable | Environment Variables table and example `.env` block |
| Auth method added or changed | Authentication section |
| Architecture change (new/removed service) | Backend Services and Tech Stack table |
| Default port, password, or first-run flow changed | Quick Start and First-Time Setup info box |
| New integration (recipe manager, HA, etc.) | Relevant Integrations section |

Match the existing HTML style — use `.feature-item`, `.info-box`, `.warning-box`, and `<table class="params-table">`.
