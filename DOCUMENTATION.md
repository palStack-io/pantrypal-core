# PantryPal - Project Documentation

## Overview

**PantryPal** is a modern, privacy-first pantry management platform. It's a self-hosted solution designed to eliminate duplicate grocery purchases and reduce food waste through barcode scanning, expiry tracking, recipe integration, and smart shopping list management.

Part of the **PalStack ecosystem** - a suite of privacy-focused, self-hosted applications.

**License:** Personal Use (Free for self-hosted use)
**Status:** Production Ready (v1.3.x)

---

## Feature Set

### Core Inventory Management
| Feature | Description |
|---------|-------------|
| **Barcode Scanning** | Real-time camera-based scanning with product lookup |
| **Manual Entry** | Add items without barcode for custom products |
| **Multi-location Support** | Track items across fridge, pantry, freezer, etc. |
| **Category Organization** | Categorize items (dairy, produce, grains, etc.) |
| **Quantity Tracking** | Monitor stock levels per item |
| **Batch Operations** | Bulk edit, delete, and filter items |
| **CSV Export** | Download entire inventory for backup |

### Expiry Management
| Feature | Description |
|---------|-------------|
| **Expiry Tracking** | Track expiration dates per item |
| **Smart Alerts** | 4-level severity (expired, critical, warning, upcoming) |
| **Expiry Dashboard** | Visual overview of items needing attention |
| **Home Assistant Alerts** | Push expiry data to HA automations |

### Shopping List
| Feature | Description |
|---------|-------------|
| **Item Management** | Add, edit, delete, check off items |
| **Smart Suggestions** | Auto-suggest low-stock and expiring items |
| **Move to Inventory** | Transfer checked items to pantry |
| **Home Assistant Sync** | Bi-directional sync with HA shopping list |

### Recipe Integration
| Feature | Description |
|---------|-------------|
| **Mealie Integration** | Connect to Mealie recipe manager |
| **Tandoor Integration** | Connect to Tandoor recipe manager |
| **Pantry Matching** | Match recipes to available ingredients |
| **Expiring Recipes** | Find recipes that use expiring items |
| **Missing Ingredients** | Add missing ingredients to shopping list |
| **Favorites** | Mark and filter favorite recipes |
| **Image Caching** | Store recipe images locally in MinIO |

### Barcode Lookup
| Feature | Description |
|---------|-------------|
| **Open Food Facts** | Primary global product database |
| **UPCitemDB Fallback** | Secondary US-focused lookup |
| **30-day Cache** | Cached lookups reduce API calls |
| **Image URLs** | Product images from data sources |
| **Graceful Fallback** | Unknown products still tracked |

### Security & Authentication
| Feature | Description |
|---------|-------------|
| **Local Auth** | Username/password with bcrypt hashing |
| **OIDC Support** | Google, Microsoft, Keycloak, Authentik |
| **API Keys** | For Home Assistant and integrations |
| **Biometric Auth** | Face ID/Touch ID on mobile |
| **Email Verification** | Account verification on signup |
| **Password Recovery** | Token-based reset flow (1-hour TTL) |

### Multi-User Support (Shared Household Model)
| Feature | Description |
|---------|-------------|
| **Shared Pantry** | One pantry for the whole household |
| **Shared Recipes** | All users see imported recipes |
| **Per-User Favorites** | Each user has their own recipe favorites |
| **Per-User Notes** | Private recipe notes per user |
| **User Management** | Admin creates users (registration disabled by default) |
| **Admin Panel** | Full user administration interface |
| **Session Management** | 30-day sessions with device tracking |
| **Role-based Access** | Admin vs regular user permissions |

---

## Integrations

### Mealie / Tandoor (Recipe Managers)
- **Purpose:** Import recipes from self-hosted recipe managers
- **Features:**
  - Full recipe import with ingredients and instructions
  - Match recipes to pantry inventory
  - Track which recipes use expiring items
  - Add missing ingredients to shopping list
  - Image download to local MinIO storage
- **Shared Household Model:**
  - Integration configuration is **admin-only**
  - Imported recipes are **shared** across all users
  - Favorites and notes are **per-user** (private)
  - Any user can import/delete recipes

### Home Assistant
- **Purpose:** Smart home automation integration
- **Features:**
  - REST sensor for expiring items
  - Shopping list bi-directional sync
  - API key authentication
  - Automation triggers on expiry alerts

### Open Food Facts
- **Purpose:** Primary barcode product database
- **Features:**
  - Global product coverage
  - No authentication required
  - Category and brand extraction
  - Product image URLs

### UPCitemDB
- **Purpose:** Fallback barcode lookup
- **Features:**
  - US-focused product database
  - Backup when Open Food Facts fails

### OIDC Providers
- **Purpose:** Single Sign-On authentication
- **Supported:** Google, Microsoft, Keycloak, Authentik
- **Features:**
  - PKCE flow with state validation
  - Auto account linking by email
  - Auto user provisioning

---

## Technology Stack

### Backend (Microservices)
| Component | Technology |
|-----------|------------|
| Framework | Python 3.11+ / FastAPI 0.104 |
| Database | PostgreSQL 15 |
| ORM | SQLAlchemy 2.0 |
| Auth | bcrypt, passlib, python-jose (JWT) |
| OIDC | Authlib 1.3 |
| Email | aiosmtplib 3.0 (async SMTP) |
| Scheduler | APScheduler 3.10 |
| HTTP Client | httpx 0.25 (async) |
| Object Storage | MinIO (for recipe images) |
| WSGI Server | Uvicorn |

### Web Frontend
| Component | Technology |
|-----------|------------|
| Framework | React 19.1 |
| Build Tool | Vite (rolldown-vite) |
| Routing | React Router 6.28 |
| HTTP Client | Axios 1.12 |
| Icons | Lucide React 0.553 |
| Styling | Inline CSS (no framework) |

### Mobile App (iOS)
| Component | Technology |
|-----------|------------|
| Framework | React Native 0.81 |
| Platform | Expo SDK 54 |
| Navigation | React Navigation 6.x |
| Storage | AsyncStorage + SecureStore |
| Camera | expo-camera 17.0 |
| Biometrics | expo-local-authentication 17.0 |
| Notifications | expo-notifications 0.32 |
| HTTP Client | Axios 1.6 |

### Infrastructure
| Component | Technology |
|-----------|------------|
| Containerization | Docker |
| Orchestration | Docker Compose |
| Reverse Proxy | Nginx |
| Object Storage | MinIO |
| Multi-arch | AMD64 + ARM64 images |

---

## Project Structure

```
pantrypal/
├── backend/
│   ├── services/
│   │   ├── api-gateway/              # FastAPI - Auth & routing
│   │   │   ├── app/
│   │   │   │   ├── main.py           # API endpoints
│   │   │   │   ├── user_db.py        # User/session management
│   │   │   │   ├── auth.py           # Auth middleware
│   │   │   │   ├── email_service.py  # SMTP email sending
│   │   │   │   ├── oidc.py           # OAuth2/OIDC client
│   │   │   │   ├── recipe_matcher.py # Recipe-pantry matching
│   │   │   │   ├── mealie_integration.py
│   │   │   │   ├── tandoor_integration.py
│   │   │   │   └── minio_service.py  # Image storage
│   │   │   ├── requirements.txt
│   │   │   └── Dockerfile
│   │   │
│   │   ├── inventory-service/        # FastAPI - Item management
│   │   │   ├── app/
│   │   │   │   └── main.py           # Inventory CRUD, shopping list
│   │   │   ├── requirements.txt
│   │   │   └── Dockerfile
│   │   │
│   │   ├── lookup-service/           # FastAPI - Barcode lookup
│   │   │   ├── app/
│   │   │   │   └── main.py           # Barcode lookup with caching
│   │   │   ├── requirements.txt
│   │   │   └── Dockerfile
│   │   │
│   │   └── web-ui/                   # React SPA
│   │       ├── src/
│   │       │   ├── pages/
│   │       │   │   ├── DashboardPage.jsx
│   │       │   │   ├── InventoryPage.jsx
│   │       │   │   ├── ShoppingListPage.jsx
│   │       │   │   ├── RecipesPage.jsx
│   │       │   │   ├── InsightsPage.jsx
│   │       │   │   └── SettingsPage.jsx
│   │       │   ├── components/
│   │       │   ├── App.jsx
│   │       │   └── api.js
│   │       ├── package.json
│   │       └── Dockerfile
│   │
│   ├── nginx/                        # Reverse proxy
│   │   ├── nginx.conf
│   │   └── Dockerfile
│   │
│   ├── docker-compose.yml
│   └── docs/
│       └── AUTHENTICATION.md
│
├── mobile/                           # React Native iOS App
│   ├── src/
│   │   ├── screens/
│   │   │   ├── LoginScreen.js
│   │   │   ├── HomeScreen.js
│   │   │   ├── ScannerScreen.js
│   │   │   ├── ShoppingListScreen.js
│   │   │   ├── RecipesScreen.js
│   │   │   └── SettingsScreen.js
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   └── biometricAuth.js
│   │   ├── navigation/
│   │   │   └── MainTabs.js
│   │   └── components/
│   ├── App.js
│   ├── app.json
│   └── package.json
│
├── .gitignore
├── .dockerignore
├── README.md
├── DOCUMENTATION.md
└── CHANGELOG.md
```

---

## Data Models

| Model | Purpose |
|-------|---------|
| **User** | Authentication, email, admin status |
| **Session** | Login sessions with device tracking |
| **APIKey** | Home Assistant and integration keys |
| **EmailToken** | Verification and password reset tokens |
| **OIDCConnection** | Linked OAuth provider accounts |
| **Item** | Pantry items with barcode, expiry, location (shared) |
| **ShoppingListItem** | Shopping list entries with check status |
| **LookupCache** | Cached barcode product data |
| **Recipe** | Imported recipes with ingredients (shared) |
| **UserRecipePreference** | Per-user favorites, notes, cooking history |
| **RecipeIntegration** | Connection settings for Mealie/Tandoor (household-level) |

---

## User Flows

### Authentication Flow
```
Landing → Register/Login → Email Verification → Dashboard
                ↓
         OIDC Provider (optional)
                ↓
         Biometric Setup (mobile)
```

### Core User Journey
```
Dashboard (overview)
    ├── Inventory → Scan Barcode → Add Item → Track Expiry
    ├── Shopping List → Add Items → Check Off → Move to Inventory
    ├── Recipes → Connect Mealie/Tandoor → Match Pantry → Add Missing to List
    ├── Insights → View Analytics → Category Breakdown
    └── Settings → API Keys → User Management → Theme
```

### Recipe Flow
```
Recipes Tab
    ├── Setup Integration → Connect Mealie/Tandoor → Test Connection
    ├── Import Recipes → Download to local DB → Cache images in MinIO
    ├── Match Pantry → Calculate ingredient matches → Identify expiring items
    ├── View Recipe → See ingredients (available/missing/expiring) → Instructions
    └── Add Missing → Extract clean ingredient names → Add to shopping list
```

---

## API Structure

Base URL: `/api/`

### Authentication
| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/auth/register` | POST | User registration |
| `/auth/login` | POST | Username/password login |
| `/auth/logout` | POST | Logout (delete session) |
| `/auth/status` | GET | Check auth mode, OIDC config |
| `/auth/me` | GET | Get current user |
| `/auth/forgot-password` | POST | Request password reset |
| `/auth/reset-password` | POST | Reset with token |
| `/auth/verify-email` | POST | Verify email token |
| `/auth/oidc/login` | GET | OIDC redirect |
| `/auth/oidc/callback` | GET | OIDC callback |
| `/auth/keys` | CRUD | API key management |

### Inventory
| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/items` | GET, POST | List/add items |
| `/items/manual` | POST | Manual item entry |
| `/items/{id}` | GET, PUT, DELETE | Item CRUD |
| `/locations` | GET | Get all locations |
| `/categories` | GET | Get all categories |
| `/stats` | GET | Inventory statistics |
| `/stats/expiring` | GET | Expiring items |
| `/lookup/{barcode}` | GET | Barcode lookup |
| `/export/csv` | GET | CSV export |

### Shopping List
| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/shopping-list` | GET, POST | List/add items |
| `/shopping-list/{id}` | GET, PUT, DELETE | Item CRUD |
| `/shopping-list/add-checked-to-inventory` | POST | Move to inventory |
| `/shopping-list/suggest-low-stock` | POST | Smart suggestions |
| `/shopping-list/clear-checked` | DELETE | Clear checked |

### Recipes
| Endpoint | Methods | Purpose | Access |
|----------|---------|---------|--------|
| `/recipes/integration` | GET | Get integration status | All users |
| `/recipes/integration` | POST | Configure integration | **Admin only** |
| `/recipes/integration` | DELETE | Remove integration | **Admin only** |
| `/recipes/import` | POST | Import from Mealie/Tandoor | All users |
| `/recipes/match` | POST | Match recipes to pantry | All users |
| `/recipes/` | GET | List recipes (shared) | All users |
| `/recipes/suggestions` | GET | Get matchable recipes | All users |
| `/recipes/expiring` | GET | Recipes using expiring items | All users |
| `/recipes/favorites` | GET | User's favorite recipes | All users |
| `/recipes/search` | GET | Search recipes | All users |
| `/recipes/{id}` | GET | Recipe details (with user prefs) | All users |
| `/recipes/{id}` | DELETE | Delete recipe (for all users) | All users |
| `/recipes/{id}/favorite` | POST | Toggle favorite (per-user) | All users |
| `/recipes/{id}/notes` | PATCH | Update notes (per-user) | All users |
| `/recipes/{id}/cooked` | POST | Mark as cooked (per-user) | All users |

### Admin
| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/admin/users` | GET | List all users |
| `/admin/users` | POST | Create new user |
| `/admin/users/{user_id}` | GET | Get user details |
| `/admin/users/{user_id}` | PATCH | Update user (email, name, is_active, is_admin) |
| `/admin/users/{user_id}` | DELETE | Delete user |
| `/admin/users/{user_id}/reset-password` | POST | Send password reset email |
| `/admin/stats` | GET | System statistics |

**Admin Safety Features:**
- Cannot modify your own `is_admin` status
- Cannot remove `is_admin` from the last admin user

### Images
| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/images/product/{barcode}` | GET | Get product image by barcode |
| `/images/custom/{item_id}` | GET | Get custom item image |
| `/images/recipe/{recipe_id}` | GET | Get recipe image |
| `/images/upload/custom` | POST | Upload custom item image |
| `/images/upload/recipe` | POST | Upload recipe image |
| `/images/custom/{item_id}` | DELETE | Delete custom item image |
| `/images/recipe/{recipe_id}` | DELETE | Delete recipe image |

### Home Assistant
| Endpoint | Methods | Purpose |
|----------|---------|---------|
| `/homeassistant/shopping-list` | GET, POST | HA format list |
| `/homeassistant/shopping-list/item/{id}` | POST, DELETE | HA item ops |
| `/homeassistant/shopping-list/clear-items` | POST | Clear checked |

---

## Deployment

### Requirements
- Docker & Docker Compose
- 1GB RAM minimum (2GB recommended)
- 2GB disk space

### Quick Start
```bash
# Option 1: Docker Hub (easiest)
curl -O https://raw.githubusercontent.com/harung1993/pantrypal/main/docker-compose-hub.yml
docker-compose -f docker-compose-hub.yml up -d

# Option 2: Build from source
git clone https://github.com/harung1993/pantrypal.git
cd pantrypal/backend
docker-compose up -d

# Access at http://localhost:8888
```

### First-Time Setup
1. Login with default admin: `admin` / `admin`
2. **Change admin password immediately** (Settings → Account)
3. Create user accounts for household members (Admin → Users)
4. Configure recipe integrations if desired (Settings → Recipes)

### Environment Variables
| Variable | Purpose |
|----------|---------|
| `AUTH_MODE` | none, api_key_only, full, smart |
| `ALLOW_REGISTRATION` | Enable/disable signup (default: `false`) |
| `APP_URL` | Base URL for email links |
| `SMTP_HOST`, `SMTP_PORT` | Email server |
| `SMTP_USERNAME`, `SMTP_PASSWORD` | Email credentials |
| `OIDC_ENABLED` | Enable OIDC authentication |
| `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | OIDC credentials |
| `OIDC_DISCOVERY_URL` | OIDC provider URL |
| `CORS_ORIGINS` | Allowed CORS origins |
| `MINIO_*` | MinIO object storage config |

---

## Development

### Backend Services
```bash
cd backend/services/api-gateway
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Web Frontend
```bash
cd backend/services/web-ui
npm install
npm run dev
```

### Mobile App
```bash
cd mobile
npm install
npx expo start
```

### Docker Services
```bash
cd backend

# Build all services
docker-compose build

# Start stack
docker-compose up -d

# View logs
docker-compose logs -f

# Stop stack
docker-compose down
```
