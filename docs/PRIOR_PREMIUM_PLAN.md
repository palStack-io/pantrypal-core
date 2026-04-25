# Multi-Household Architecture Plan

## Overview

PantryPal Premium will support multiple isolated households on a single server instance. Each household is a self-contained unit — members share recipes, inventory, and shopping lists within their household, with no visibility into other households.

---

## Core Concept

```
Household (1)
  ├── Members (N users) — roles: owner, admin, member
  ├── Recipes (N) — shared within household, isolated from others
  ├── Integrations (N) — Mealie/Tandoor config per household
  ├── Inventory (N items) — shared within household
  └── Shopping List (N items) — shared within household
```

---

## Phase 1 — New Tables

### `households`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| name | VARCHAR | e.g. "The Smith Family" |
| owner_id | UUID FK → users | The user who created the household |
| created_at | TIMESTAMP | |
| subscription_tier | VARCHAR | e.g. "free", "premium" |

### `household_members`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| household_id | UUID FK → households | |
| user_id | UUID FK → users | |
| role | ENUM | `owner`, `admin`, `member` |
| joined_at | TIMESTAMP | |
| invited_by_user_id | UUID FK → users | Nullable |

### `household_invitations`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| household_id | UUID FK → households | |
| email | VARCHAR | Who was invited (nullable for link-based invites) |
| invite_code | VARCHAR | Unique short code for invite link |
| created_by_user_id | UUID FK → users | |
| expires_at | TIMESTAMP | |
| accepted_at | TIMESTAMP | Nullable — null if not yet accepted |
| is_revoked | BOOLEAN | |

---

## Phase 2 — Schema Changes

Tables that need a `household_id` foreign key added:

| Table | Service | Change |
|-------|---------|--------|
| `recipes` | API Gateway (Postgres) | Add `household_id` FK |
| `recipe_integrations` | API Gateway (Postgres) | Add `household_id` FK; change unique constraint from `(provider)` → `(household_id, provider)` |
| `recipe_images` | API Gateway (Postgres) | Add `household_id` FK |
| `items` (inventory) | Inventory Service | Add `household_id` |
| `shopping_list` | Inventory Service | Add `household_id` |

Tables that stay unchanged:

| Table | Reason |
|-------|--------|
| `users` | Household membership is via `household_members` |
| `user_recipe_preferences` | Household derived from user's membership |
| `sessions`, `api_keys` | Per-user, no household context needed |
| `lookup_cache` | Global barcode cache, no tenant isolation needed |
| `product_images` | Global cache, no tenant isolation needed |

---

## Phase 3 — Middleware

Add a `get_current_household()` FastAPI dependency, injected into every protected route:

- Reads authenticated user's `household_members` row
- Attaches `household_id` to the request context
- All DB queries filter by `household_id`
- Returns 403 if user has no household membership

Edge cases:
- **User not in any household** → auto-create a household on first login, user becomes owner
- **User in multiple households** (future) → household switcher header/param
- **Owner leaves** → block unless ownership is transferred first

---

## Phase 4 — User Flows

### Registration / First Login
```
Register → Email verified → Auto-create household → User becomes owner
```

### Invite Flow
```
Owner or admin generates invite (by email or shareable link)
→ Invitee registers or logs in
→ Accepts invite via code
→ Added as member to household
→ Immediately sees shared household data
```

### Role Permissions

| Action | Owner | Admin | Member |
|--------|-------|-------|--------|
| View recipes / inventory | ✓ | ✓ | ✓ |
| Add / edit recipes | ✓ | ✓ | ✓ |
| Delete recipes | ✓ | ✓ | ✗ |
| Manage integrations | ✓ | ✓ | ✗ |
| Invite members | ✓ | ✓ | ✗ |
| Remove members | ✓ | ✓ | ✗ |
| Delete household | ✓ | ✗ | ✗ |
| Transfer ownership | ✓ | ✗ | ✗ |

---

## Phase 5 — Inventory Service Refactor

Currently uses SQLite with no household concept. Two options:

### Option A — Per-household SQLite files
Each household gets its own DB file: `household_{id}.db`
- Pros: Minimal code change
- Cons: Hard to query across households, messy backups, doesn't scale

### Option B — Migrate to shared PostgreSQL with `household_id` (Recommended)
- Pros: Consistent with rest of stack, easier backups, cleaner queries
- Cons: More migration work upfront

**Decision: Option B** — migrate inventory and shopping list into the main Postgres database, adding `household_id` to both tables.

---

## Phase 6 — Admin Panel

Super-admin capabilities (platform operator level, above household owners):

- List all households with member counts and activity
- Suspend or delete a household
- Set/change subscription tier per household
- Impersonate a household for debugging (audit logged)

---

## What Stays the Same

- Lookup service (global barcode cache, no tenant context)
- Product images (globally cached, no tenant isolation)
- Auth / session / OIDC flow (already per-user)
- MinIO structure (bucket-per-type is fine; object paths can encode household_id)

---

## Implementation Order

1. New tables: `households`, `household_members`, `household_invitations`
2. Middleware: `get_current_household()` dependency
3. Migrate `recipes`, `recipe_integrations`, `recipe_images` — add `household_id`
4. Auto-household creation on registration
5. Invite flow endpoints
6. Role-based permission checks on routes
7. Migrate inventory service to Postgres with `household_id`
8. Admin panel household management endpoints
