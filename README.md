<div align="center">
  <img width="200" height="200" alt="pantryPal" src="https://github.com/user-attachments/assets/093c2a98-c327-4d28-be71-210840f69893" />
  
  <h1>pantryPal</h1>
  <h3>Never waste food again</h3>
  
  <p>
    <a href="https://pantrydemo.palstack.io"><strong>Try Demo →</strong></a> |
    <a href="https://palstack.io/pantrypal/docs">Documentation</a> |
    <a href="https://palstack.io">More Tools</a>
  </p>
</div>

> [!WARNING]
> **pantryPal is under active, constant development.** This repo changes frequently —
> features, configuration, environment variables, and APIs may change between releases
> without notice. Pin an image tag (e.g. `pantrypal-api-gateway:api-gateway-<sha>`)
> rather than `latest` if you need stability, back up before upgrading, and check the
> commit history before pulling new images.

---

**Open source, privacy-first pantry management from palStack**

[![Status](https://img.shields.io/badge/Status-Production%20Ready-success)](https://github.com/palStack-io/pantrypal-core)
[![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Web-blue)](https://github.com/palStack-io/pantrypal-core)
[![License](https://img.shields.io/badge/License-AGPL--3.0-blue)](LICENSE)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Ready-41BDF5)](https://www.home-assistant.io/)
[![GHCR](https://img.shields.io/badge/GHCR-Containers-2496ED)](https://github.com/orgs/palStack-io/packages)
[![Docs](https://img.shields.io/badge/Docs-palstack.io%2Fpantrypal-orange)](https://palstack.io/pantrypal/docs)

**Part of [palStack](https://palstack.io)** - Privacy-first tools for everyday life

---

## The Story Behind pantryPal

We're **palStack**—a small team building privacy-first tools for everyday life. pantryPal is where it all started.

The problem was simple and annoying: one of us kept buying duplicate groceries. Three cans of tomato sauce in a month. Expired food forgotten in the basement. Wasted money, wasted food, endless frustration.

"Can't you just... build something?"

So we did. 

What started as a fix for one household's pantry chaos quickly caught on with friends. They saw it working and wanted in. Before we knew it, we were running pantryPal for multiple households—each with their own setup, preferences, and stories about the food waste they'd avoided.

That's when it clicked: this isn't just our problem. It's *everyone's* problem.

**The Home Automation Touch**  
We added contact sensors to pantry doors. Open the pantry, get a gentle Home Assistant notification reminding you to log what you took out. No more "I grabbed something but forgot to update it" moments. Our friends loved this trick and started doing it too.

**Learning as We Go**  
Here's the honest truth: none of us came from software engineering backgrounds. We're learning this stuff as we build it—backend design, microservices, mobile apps, Docker networking. Some days it's FastAPI patterns. Other days it's debugging why containers won't talk to each other at 2 AM.

We use AI coding assistants heavily. Not to write the code *for* us, but to help us understand *why* things work the way they do. It's like having a patient teacher who doesn't judge when you ask the same question three different ways.

Is pantryPal over-engineered for what it does? Probably. Does it work? Absolutely. Are we still figuring things out? Every single day.

**Why Open Source?**  
As more friends adopted pantryPal, we kept refining it—better multi-user support, smoother mobile experience, easier self-hosting. Eventually we realized: why keep this just for people we know?

We founded **palStack** to share these tools with anyone who wants them. pantryPal is our first production-ready Pal, built on a simple idea: everyday problems deserve privacy-first, self-hosted solutions that actually work.

Once you solve one household problem with code, you start seeing opportunities everywhere. pantryPal was just the beginning—a collection of practical tools for managing everyday life without giving up your data.

### The palStack Family

**Production Ready:**
- **[pantryPal](https://palstack.io/pantrypal)** - You're here! Never buy duplicate groceries again

**Final Testing Stage:**
- **[finPal](https://finpal.palstack.io)** - Personal finance tracking with privacy-first design (web ready, mobile in development)

**In Active Development:**
- **[propertyPal](https://propertypal.palstack.io)** - Track home maintenance, warranties, documents, plus **petPal** (pet care) and **carPal** (vehicle maintenance)
- **[clubPal](https://clubpal.palstack.io)** - Group coordination for dining, activities, and social clubs

**Learn more at [palstack.io](https://palstack.io)**

*Why "Pal"? Because that's what these tools are—friendly helpers for the everyday stuff we all struggle with.*

---

## 🚀 Core vs Premium

pantryPal comes in two editions:

- **Core (self-hosted)**: this repository. Free, runs on your own server with Docker, and your data never leaves your network. Everything in this README describes Core.
- **Premium (hosted)**: the managed service at [pantrypal.palstack.io](https://pantrypal.palstack.io), run by palStack. It adds AI and multi-pantry features on top of Core. There's a Free plan, and Personal, Family and Professional plans are coming soon ([pricing](https://palstack.io/pantrypal#pricing)). Premium's code is proprietary and can't be self-hosted.

| Feature | Core (self-hosted) | Premium (hosted) |
|---|---|---|
| Inventory, barcode scanning, expiry alerts, locations, categories, QR labels | ✅ | ✅ |
| Shared shopping list | ✅ | ✅ |
| Web app (PWA) and iOS / Android app | ✅ | ✅ |
| Home Assistant integration and API keys | ✅ | ✅ |
| Household members | ✅ One shared pantry per server | ✅ Member limit depends on plan |
| Multiple pantries | — | ✅ Family and Professional |
| Sign-in | ✅ Password, Google, Apple, any OIDC provider | ✅ Password, Google, Apple |
| Mealie / Tandoor recipe import and pantry matching | ✅ Bring your own server | ✅ Personal and up |
| AI-assisted recipe finding | — | ✅ Personal and up (monthly quota) |
| Receipt scanning (photo → pantry items) | — | ✅ Personal and up (monthly quota) |
| Nutrition info and portion scaling | — | ✅ Personal and up |
| Backups | ✅ Built-in backup container you manage | ✅ Managed daily backups |
| Where your data lives | Your own server | palStack's servers |

The mobile app works with both. It detects which edition it's connected to, and on a Core server premium-only features are hidden or shown as locked (**PRO**).
- ✅ Subscription-based pricing

**Stay updated:** [palstack.io](https://palstack.io) | Email: support@palstack.io

---

## Screenshots

<div align="center">
  
  ### Dashboard & Inventory
  <img width="45%" alt="Dashboard Overview" src="https://github.com/user-attachments/assets/b3109d68-cfad-4234-8929-0f2a85dcd975" />
  <img width="45%" alt="Inventory Management" src="https://github.com/user-attachments/assets/82579f65-7769-4e30-8530-4d9dea269c6d" />
  
  ### Recipe Matching & Analytics
  <img width="45%" alt="Recipe Matching" src="https://github.com/user-attachments/assets/9059608b-95a3-417d-9103-a86e3120d863" />
  <img width="45%" alt="Pantry Insights" src="https://github.com/user-attachments/assets/1efefdf3-7e99-4436-a7db-8ae5a857d03c" />
  
</div>

> **Try it live:** [pantrydemo.palstack.io](https://pantrydemo.palstack.io)

---

## What pantryPal Does

**The Core Problem:** "Do we have tomato sauce, or should I buy it?"

**The Solution:**
- Scan barcodes with your phone to add items instantly
- Get notified before things expire
- Integrate with Home Assistant for automations
- Voice control ready (foundation in place)
- Multi-user support so the whole family can contribute
- Built by people who actually use it daily

---

## Key Features

### For Everyday Use
- **Barcode Scanning**: Real-time camera-based scanning with product lookup from Open Food Facts
- **Manual Entry**: Add items without barcodes for custom products
- **Multi-location Support**: Track items across fridge, pantry, freezer, and custom locations
- **Expiry Tracking**: 4-level severity alerts (expired, critical, warning, upcoming)
- **Shared Household Pantry**: One pantry for the whole family to access and update
- **Smart Shopping Lists**: Auto-suggest low-stock items, move checked items to inventory
- **Drag-to-Reorder Shopping List**: Rearrange shopping list items by dragging (mobile)
- **Recipe Integration**: Import recipes from Mealie or Tandoor recipe managers
- **Pantry Matching**: See which recipes you can make with available ingredients
- **Expiring Recipes**: Find recipes that use items about to expire
- **Personal Preferences**: Your favorites and notes are private to you
- **Category Organization**: Organize items by dairy, produce, grains, and custom categories
- **CSV Export**: Download your entire inventory for backup
- **Beautiful Web Dashboard**: Minimal, clean interface with dark mode and virtual-scrolled inventory table
- **Progressive Web App (PWA)**: Install on desktop/mobile, works offline — mutations queue in the background and sync when connectivity returns
- **Native Mobile App**: iOS & Android (React Native) with biometric authentication (Face ID/Touch ID)
- **Image Caching**: Recipe images stored on local disk for fast loading

### For Home Assistant Fans
- **REST API Integration**: Pull pantry data and expiring items into Home Assistant
- **Shopping List Access**: Read, add, check off and clear shopping-list items from Home Assistant
- **Automation Support**: Trigger notifications, shopping lists, and custom automations
- **Voice Control Ready**: Foundation laid for Google Assistant/Alexa integration
- **Self-Hosted**: No cloud dependencies, runs entirely on your network
- **API Key Support**: Secure service-to-service authentication

### Privacy & Control
- **100% Self-Hosted**: Your data never leaves your network
- **No Subscriptions**: Free and open source (AGPL-3.0)
- **No Tracking**: No analytics, no telemetry, no phone-home
- **Full Control**: Modify anything you want, it's your code
- **Secure by Default**: Multiple authentication modes for different use cases
- **SSO Support**: Google and Apple sign-in, plus any OIDC provider (Authentik, Keycloak, Authelia, Okta, Azure AD)

### Advanced Features
- **Local Image Storage**: Recipe, product, and user photos stored on disk — no external object storage required
- **Prebuilt Images**: AMD64 images on GHCR (build from source for ARM64)
- **Microservices Architecture**: Separate services for inventory, lookup, and gateway
- **30-day Barcode Cache**: Reduce API calls with intelligent caching
- **Account Emails**: Password recovery, account verification, and welcome emails (expiry alerts are mobile notifications)
- **Session Management**: Sessions extend automatically while in use, with IP/device info recorded
- **Batch Operations**: Bulk edit, delete, and filter inventory items
- **TypeScript Throughout**: Full TypeScript codebase on web and mobile for type safety

---

## System Requirements

**Minimum:**
- 1GB RAM
- 2GB disk space
- Docker & Docker Compose
- (Optional) Home Assistant instance
- (Optional) SMTP server for email notifications

**Recommended:**
- 2GB RAM for better performance
- 5GB disk space (includes recipe images)
- Home server, NAS, or VPS
- Reverse proxy with SSL (Nginx, Caddy, Traefik)

---

## Quick Start

### Deploy with GitHub Container Registry (Recommended)

Pull pre-built images from GitHub Container Registry:

```bash
# 1. Download the compose file and the example config
curl -O https://raw.githubusercontent.com/palStack-io/pantrypal-core/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/palStack-io/pantrypal-core/main/.env.example

# 2. Generate your own secrets (required — pantryPal ships with none)
for v in DB_PASSWORD SECRET_KEY INTERNAL_SERVICE_TOKEN ENCRYPTION_SALT; do
  sed -i.bak "s/^$v=\$/$v=$(openssl rand -hex 32)/" .env
done && rm .env.bak

# 3. (Optional) Edit .env to set APP_URL, SMTP for email, and SSO

# 4. Start pantryPal
docker compose up -d

# Access at http://localhost:8888
```

> **Required secrets:** `docker compose` won't start until `DB_PASSWORD`, `SECRET_KEY`,
> `INTERNAL_SERVICE_TOKEN`, and `ENCRYPTION_SALT` are set in `.env`. There are no defaults —
> every install must generate its own (step 2 above does this). Set them once, before the
> first start, and keep them: changing `DB_PASSWORD` later locks you out of the existing
> database, and changing `SECRET_KEY` or `ENCRYPTION_SALT` makes saved Mealie/Tandoor
> credentials unreadable. Keep `.env` out of git.

**First Time Setup:**
1. Open http://localhost:8888 in your browser
2. Login with default admin credentials: `admin` / `admin`
3. **Change the admin password immediately** via Settings → Account
4. Create user accounts for your household via Admin → Users
5. Configure recipe integrations (Mealie/Tandoor) if desired via Settings

**📚 For comprehensive installation, configuration, and deployment guides, visit:**
**[palstack.io/pantrypal/docs](https://palstack.io/pantrypal/docs)**

### Prerequisites
- Docker and Docker Compose installed
- Port 8888 available (default, or configure custom port)
- (Optional) SMTP server for email features:
  - Account verification
  - Password reset
  - User invitations
- (Optional) Home Assistant instance for smart home integration
- (Optional) Mealie or Tandoor for recipe management
- For iOS app: Request TestFlight access (email: support@palstack.io)
- For SSO: a Google client ID, or OIDC client credentials from your identity provider

**📚 Detailed setup guides available at [palstack.io/pantrypal/docs](https://palstack.io/pantrypal/docs)**

**That's it!** Open http://localhost:8888 and login as `admin` / `admin` (change password immediately!).

---

## Architecture

Built with a microservices architecture for easy maintenance and future expansion:

```
nginx (reverse proxy)
├── api-gateway (FastAPI)          # Authentication, routing, email, OIDC, recipes, local image storage
├── inventory-service              # Item CRUD, shopping lists, locations
├── lookup-service                 # Barcode to product info (cached)
├── web-ui (React + TypeScript)    # PWA dashboard interface
└── backup                         # Scheduled PostgreSQL + image backups (opt-in)
```

**Tech Stack:**
- **Backend**: Python 3.11+ / FastAPI 0.104
- **Frontend**: React 19.2 + Vite + TypeScript — PWA with offline support (Workbox)
- **Mobile**: React Native 0.81 / Expo SDK 54 — TypeScript, iOS & Android
- **Database**: PostgreSQL 15
- **Object Storage**: Local filesystem (no external dependency)
- **Reverse Proxy**: nginx
- **Barcode Data**: Open Food Facts API + UPCitemDB fallback
- **Authentication**: bcrypt, session tokens, OIDC (Authlib 1.3)
- **Email**: aiosmtplib 3.0 (async SMTP)
- **Images**: AMD64 (prebuilt on GHCR)

---

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
No defaults — generate each with `openssl rand -hex 32`. See [Quick Start](#quick-start).

| Variable | Description |
|----------|-------------|
| `DB_PASSWORD` | PostgreSQL password. Fixed at first start — don't change it afterwards |
| `SECRET_KEY` | Encryption key for stored integration credentials; also signs the SSO login round-trip |
| `INTERNAL_SERVICE_TOKEN` | Shared token the internal services use to authenticate each other |
| `ENCRYPTION_SALT` | Salt for encrypting stored integration credentials |

#### Authentication & Security
| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_MODE` | `full` | Authentication mode: `full`, `smart`, `api_key_only`, `none` |
| `ALLOW_REGISTRATION` | `false` | Enable public user registration |
| `APP_URL` | `http://localhost:8888` | Base URL for email links |

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

1. Admin logs in and goes to **Admin → Users**
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

## Mobile App Access

The iOS app is currently in TestFlight for community testing. The app is built with React Native (Expo SDK 54) and runs on both iOS and Android.

**Features:**
- Full TypeScript codebase — React Native with Expo SDK 54
- Barcode scanning with camera
- Biometric authentication (Face ID / Touch ID / Fingerprint)
- Drag-to-reorder shopping list items
- Self-hosted server configuration
- Full inventory management on the go
- Tested and refined by our growing community of users

**iOS:** Available on TestFlight — email support@palstack.io to request access  
**Android:** In active development

---

## Home Assistant Integration

### Quick Setup

Add this to your `configuration.yaml`:

```yaml
sensor:
  - platform: rest
    name: Pantry Expiring Items
    resource: http://YOUR_SERVER_IP/api/stats/expiring?days=7
    headers:
      X-API-Key: YOUR_API_KEY_HERE
    value_template: "{{ value_json.summary.total_expiring }}"
    json_attributes:
      - summary
      - items
    scan_interval: 3600
```

### Generate API Key

1. Log in to PantryPal web interface
2. Go to Settings
3. Scroll to "API Keys" section
4. Click "Generate New API Key"
5. Give it a name (e.g., "Home Assistant")
6. Copy the key and use it in your Home Assistant configuration

### Example Automation

```yaml
automation:
  - alias: "Morning Pantry Check"
    trigger:
      - platform: time
        at: "09:00:00"
    condition:
      - condition: numeric_state
        entity_id: sensor.pantry_expiring_items
        above: 0
    action:
      - service: notify.mobile_app
        data:
          title: "Pantry Alert"
          message: "{{ states('sensor.pantry_expiring_items') }} items expiring soon"
```

---

## Roadmap

**Near Term:**
- [ ] Android native app (currently in development)
- [ ] Home Assistant voice control integration
- [ ] Receipt scanning with LLM processing for bulk entry
- [ ] Shopping list generation from pantry

**Future:**
- [ ] Meal planning based on inventory
- [ ] Nutrition tracking
- [x] Recipe suggestions based on available items (via Mealie/Tandoor integration)
- [ ] Cross-Pal integration (propertyPal, finPal, clubPal)

**palStack Vision:**
All our Pals will eventually work together seamlessly—imagine your grocery spending syncing with finPal, or maintenance costs flowing into your budget automatically.

---

## Why Self-Hosted?

Because your pantry inventory is your personal data. You shouldn't need:
- A subscription to track your own groceries
- Permission from a cloud service to access your data
- Internet connectivity to know what's in your basement

Self-hosting means:
- Complete privacy and control
- No recurring costs
- Works offline
- Integrate with anything
- Modify as needed

---

## Contributing

pantryPal is open source and welcomes contributions!

**How to Contribute:**
- **Bug reports** - Submit via [GitHub Issues](https://github.com/palStack-io/pantrypal-core/issues)
- **Feature requests** - Open a discussion to propose new features
- **Pull requests** - Code contributions welcome (see requirements below)

**Pull Request Requirements:**
- All PRs require approval from **2 palStack developers**
- Review process typically takes **24-48 hours**
- Include clear description of changes and why they're needed
- Ensure all tests pass and documentation is updated
- Follow existing code patterns and style

**📚 For detailed contribution guidelines, visit [palstack.io/pantrypal/docs](https://palstack.io/pantrypal/docs)**

By contributing, you agree that your contributions will be licensed under AGPL-3.0.

---

## License

**Dual Licensed: Open Source Core + Proprietary Premium**

### pantryPal Core (AGPL-3.0) - This Repository

The self-hosted version is **free and open source** under AGPL-3.0:
- ✅ **Free for personal use** - No cost, ever
- ✅ **Free for commercial use** - Use in your business
- ✅ **All core features included** - Nothing held back
- ✅ **Modify and distribute freely** - Fork it, customize it
- ⚠️ **Must share modifications** - AGPL copyleft requirement
- ⚠️ **Network use counts as distribution** - Must provide source to users

**What's included in Core:**
- All barcode scanning and inventory management
- Expiry tracking with alerts
- Recipe integration (Mealie/Tandoor)
- Shopping list management
- Home Assistant integration
- Multi-user household support
- All current features you see in this repository

### pantryPal Premium (Proprietary) - Managed Hosting Only

The hosted service at [pantrypal.palstack.io](https://pantrypal.palstack.io) adds **proprietary premium features** on top of Core (see [Core vs Premium](#-core-vs-premium)):
- 🤖 **AI-assisted recipe finding** - Real, attributed recipes built around what's in your pantry
- 🧾 **Receipt scanning** - Photograph a receipt, get pantry items with expiry dates
- 🥗 **Nutrition info and portion scaling**
- 🏠 **Multiple pantries** - For bigger households
- 💾 **Managed daily backups**
- ⚡ **Priority support** on Family and Professional plans

**Premium features are:**
- Available **only** via managed hosting subscription
- **Not open source** (proprietary code)
- Used to fund development of the free Core version
- Live at [pantrypal.palstack.io](https://pantrypal.palstack.io): Free plan now, paid plans coming soon

### Why Dual Licensing?

We believe in **both** open source **and** sustainable business:

**Self-hosters get:** Powerful pantry tools, free forever, full control  
**Managed subscribers get:** Extra convenience features + support our work  
**Everyone wins:** Premium revenue funds Core development

**Full License:** See [LICENSE](LICENSE) file for complete terms.

**Questions?** Email support@palstack.io

---

## Acknowledgments

- **Our friends** - For enthusiastically adopting pantryPal and providing invaluable feedback that shaped it into a real product
- **Three cans of tomato sauce** - For sitting in a basement and inspiring this entire journey
- **The open source community** - For showing us that building in public and sharing freely creates better software
- **AI Coding Assistants** - For being patient teachers bridging the gap from data science to software engineering
- **Open Food Facts** - For the amazing product database API that makes barcode scanning possible
- **Home Assistant Community** - For building an incredible smart home platform and proving privacy-first automation works
- **Docker** - For making "but it works on my machine" a thing of the past
- **Everyone who said "just use Google Keep"** - You motivated us to prove there's a better way

---

## About palStack

**Privacy-first tools for everyday life.** That's what pals do—they show up and help with the everyday stuff.

We're not building engagement platforms or harvesting data. We solve real problems we've experienced, then share the solution.

**Core Values:**
- **Your Data**: Zero telemetry, no tracking, privacy by design
- **Open Source**: AGPL-3.0, free forever, improvements benefit everyone  
- **Human-Centered**: Plain English, accessible design, forgiving UX
- **AI-Assisted**: LLM-agnostic (Claude, ChatGPT, Qwen), all code human-reviewed
- **Dog-Fooded**: We use what we build daily

**Two Paths:**
1. **Self-Host (Core)** - Free forever, full control, community support
2. **Hosted Premium** - [pantrypal.palstack.io](https://pantrypal.palstack.io): we handle the infrastructure and add AI features

We're building sustainable tools that help people, not chasing unicorns. If we can pay our bills doing it—and sleep well at night—that's success.

---

## The palStack Ecosystem

**Production Ready:**
- **[pantryPal](https://palstack.io/pantrypal)** - Food waste reduction | [Docs](https://palstack.io/pantrypal/docs) | [GitHub](https://github.com/palStack-io/pantrypal-core)

**Final Testing:**
- **[finPal](https://finpal.palstack.io)** - Personal finance tracking | [GitHub](https://github.com/palStack-io/finpal-core)

**In Development:**
- **[propertyPal](https://propertypal.palstack.io)** - Home, pet, and vehicle tracking | [GitHub](https://github.com/palStack-io/propertypal-core)
- **[clubPal](https://clubpal.palstack.io)** - Group coordination | [GitHub](https://github.com/palStack-io/clubpal-core)

*Privacy-first • Family-focused • Home Assistant ready • AGPL-3.0*

**Explore:** [palstack.io](https://palstack.io)

---

## The Team

- **Harun Gunasekaran** - Founder & Lead Developer
- **Chris Macioci** - Co-Founder & Lead DevOps
- **Rachel Surette** - Co-Founder, Marketing & Branding
- **Elle Russel Chopra** - Co-Founder, Lead UI/UX Designer
- **Chaitanya Gunupudi** - Senior Advisor, Cybersecurity & DevOps
- **AI Assistants** - LLM-agnostic: Claude, ChatGPT, Qwen (all code human-reviewed)

---

## Contact & Community

**Get in Touch:**
- 🌐 Website: [palstack.io](https://palstack.io)
- 📧 Email: support@palstack.io
- 💻 GitHub: [@palStack-io](https://github.com/palStack-io)
- 📦 Containers: [GitHub Packages](https://github.com/orgs/palStack-io/packages)
- 📚 Docs: [palstack.io/pantrypal/docs](https://palstack.io/pantrypal/docs)

**Join the Community:**

We're building a community of privacy-focused, self-hosting enthusiasts who believe everyday tools shouldn't compromise your data. Whether you're a developer, a user with ideas, or someone who just wants to reduce food waste—you're welcome here.

**Ways to Get Involved:**
- 🍽️ Use pantryPal and share your food-saving success stories
- 💻 Contribute code via pull requests on GitHub
- 🐛 Report bugs to help us improve
- 💡 Request features that solve real problems
- 📣 Spread the word about privacy-first alternatives

**Support the Project:**
- [GitHub Sponsors](https://github.com/sponsors/harung1993)
- [Buy Me a Coffee](https://buymeacoffee.com/cCFW6gZz28)

**Learn More:**
- [Our Methodology](https://palstack.io/methodology) - How we build
- [The Team](https://palstack.io/team) - Who we are
- [All Projects](https://palstack.io) - Explore the full palStack suite

---

*"That's what pals do - they show up and help with the everyday stuff."*

**Built by the open source community, for the open source community.**