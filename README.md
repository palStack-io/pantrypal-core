# PantryPal

**A self-hosted pantry management system built to solve a real household problem**

[![Status](https://img.shields.io/badge/Status-Production%20Ready-success)](https://github.com/harung1993/pantrypal)
[![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Web-blue)](https://github.com/harung1993/pantrypal)
[![License](https://img.shields.io/badge/License-Personal%20Use-orange)](LICENSE)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Ready-41BDF5)](https://www.home-assistant.io/)

---

## The Story Behind PantryPal

My wife and I have a pantry in the basement. Like many couples, we kept buying duplicate items because we genuinely couldn't remember what we already had down there. Worse, we'd regularly discover expired food we'd completely forgotten about—wasted money and wasted food.

One day, after bringing home our third can of tomato sauce in a month, my wife suggested: "Can't you just... build something?"

Well now we have PantryPal to solve our household's very real, very annoying problem. It integrates with our Home Assistant setup and lets us quickly scan barcodes to track what we have. We can check our inventory from anywhere, get alerts before things expire, and finally stop the duplicate-buying madness.

**The Home Automation Touch:** I installed contact sensors on our basement pantry doors. Now, whenever someone opens the pantry, Home Assistant sends me a persistent notification reminding me to update the inventory. No more "I took something out but forgot to log it" moments. It's a gentle nudge that keeps our pantry data accurate without being annoying.

**Learning Through Building:** My background is in data science, not software engineering. I knew Python and could wrangle data all day, but proper software architecture? Microservices? Docker orchestration? That was all new territory. PantryPal became my learning project—a real problem that justified diving deep into backend design, API development, and mobile apps.

I leaned heavily on AI coding assistants to bridge the gap between "data scientist who can code" and "building production-ready applications." These tools didn't write the code for me—they taught me *why* certain architectural decisions matter, helped me debug obscure Docker networking issues at 2 AM, and explained FastAPI patterns I'd never encountered before. Each PalStack project has been a deliberate exercise in learning a new piece of the software development puzzle.

Is it over-engineered? Absolutely. Does it work? Perfectly. Did I learn a ton? Even better.

But here's the thing—once you solve one household problem with code, you start seeing them everywhere. PantryPal became the first piece of something bigger: **PalStack**, a collection of privacy-first, self-hosted tools for managing everyday life.

### The PalStack Family

**Released:**
- **[PantryPal](https://github.com/harung1993/pantryPal_Selfhosted)** - You're here! Never buy duplicate groceries again
- **[DollarDollar Bill Y'all](https://github.com/harung1993/dollardollar)** - The original debt repayment tracker that started it all

**In Development:**
- **PropertyPal** - Track home maintenance, warranties, and that HVAC filter you always forget to change
- **DebtFree** - Gamified debt management (evolved from DollarDollar Bill Y'all with achievements, progress tracking, and motivation)
- **MinglePal** - Club and group management for hobby groups, book clubs, and community organizations
- **BudgetPal** - Comprehensive household budgeting built on the DollarDollar foundation

*Why "Pal"? Because that's what these tools are—friendly helpers for the everyday stuff we all struggle with.*

---

## What PantryPal Does

**The Core Problem:** "Do we have tomato sauce, or should I buy it?"

**The Solution:**
- Scan barcodes with your phone to add items instantly
- Get notified before things expire
- Integrate with Home Assistant for automations
- Voice control: "Hey Google, do we have pasta?" (coming soon)
- Multi-user support so the whole family can contribute

---

## Key Features

### For Everyday Use
- **Barcode Scanning**: Quick item entry via mobile camera
- **Manual Entry**: Add items without barcodes
- **Expiry Tracking**: Know what's expiring before it goes bad
- **Multi-User Support**: Family members can all access and update
- **Beautiful Web Dashboard**: Minimal, clean interface with dark mode
- **Mobile App**: Native iOS app with biometric authentication (Face ID/Touch ID)
- **User Authentication**: Secure account-based access with session management

### For Home Assistant Fans
- **REST API Integration**: Pull pantry data into Home Assistant
- **Automation Support**: Trigger notifications, shopping lists, etc.
- **Voice Control Ready**: Foundation laid for Google Assistant/Alexa integration
- **Self-Hosted**: No cloud dependencies, runs on your network
- **API Key Support**: Secure service-to-service authentication

### Privacy & Control
- **100% Self-Hosted**: Your data never leaves your network
- **No Subscriptions**: Free and open for personal use
- **No Tracking**: No analytics, no telemetry, no phone-home
- **Full Control**: Modify anything you want
- **Secure by Default**: Multiple authentication modes for different use cases

---

## Screenshots

### Web Dashboard (Light Mode)
Clean, minimal interface with warm color scheme showing all your items at a glance

### Web Dashboard (Dark Mode)
Easy on the eyes for evening pantry checks with full dark mode support

### Mobile App
Native iOS experience with barcode scanning and biometric authentication

### Home Assistant Integration
Pantry stats and expiring items right in your dashboard

---

## Quick Start

### Option 1: Docker Hub (Easiest - Recommended)

Pull pre-built images from Docker Hub - no need to clone the repo!
```bash
# Download docker-compose file
curl -O https://raw.githubusercontent.com/harung1993/pantrypal/main/docker-compose-hub.yml

# (Optional) Create .env file for email notifications
cat > .env << 'EOF'
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=PantryPal
SMTP_USE_TLS=true
EOF

# Start PantryPal
docker-compose -f docker-compose-hub.yml up -d

# Access at http://localhost
```

**First Time Setup:**
1. Open http://localhost in your browser
2. Click "Sign Up" to create your account
3. Set your username and password
4. Configure default location and categories in Settings

### Option 2: Build from Source

For developers or if you want to customize:
```bash
# Clone repository
git clone https://github.com/harung1993/pantrypal.git
cd pantrypal

# Start services (builds automatically)
./start-pantrypal.sh

# Or manually
docker-compose up -d
```

### Prerequisites (for both options)
- Docker and Docker Compose
- (Optional) Home Assistant instance
- (Optional) SMTP for email notifications
- For iOS app: Request TestFlight access (email: palstack4u@gmail.com)

**That's it!** Open http://localhost in your browser and create your account.

---

## Architecture

Built with a microservices architecture for easy maintenance and future expansion:
```
nginx (reverse proxy)
├── api-gateway (FastAPI)     # Authentication, routing, email notifications
├── inventory-service         # Item CRUD operations
├── lookup-service            # Barcode to product info lookup
└── web-ui (React)            # Dashboard interface
```

**Tech Stack:**
- Backend: Python 3.11 + FastAPI
- Frontend: React 18 + Vite
- Mobile: React Native + Expo
- Database: SQLite (simple, portable, no setup)
- Reverse Proxy: nginx
- Barcode Data: Open Food Facts API

---

## Authentication Modes

PantryPal supports flexible authentication to fit different use cases. Configure `AUTH_MODE` in `docker-compose.yml`:

| Mode | Best For | Home Network | External Access |
|------|----------|--------------|-----------------|
| **full** | Maximum security (recommended) | Login required | Login required |
| **none** | Single user only | Open | Open (insecure) |
| **api_key_only** | API integrations | API key only | API key only |

**Default Mode:** `full` - All users must create accounts and login, ensuring secure access from anywhere.

### Authentication Features
- **Session-based authentication** for web and mobile
- **API key support** for Home Assistant and service integrations
- **Biometric authentication** on mobile (Face ID, Touch ID, Fingerprint)
- **Password reset** via email
- **Multi-user support** with admin capabilities

---

## Mobile App Access

The iOS app is distributed via TestFlight for family and early testers.

**Features:**
- Native iOS experience
- Barcode scanning with camera
- Biometric authentication (Face ID/Touch ID)
- Self-hosted server configuration
- Full inventory management on the go

**Request Access:**
- Email: palstack4u@gmail.com
- Subject: "PantryPal TestFlight Request"
- Include: Your Apple ID email

You'll receive an invitation within 24-48 hours.

**Note:** This is a personal project for family use, not a commercial app. No App Store release is planned for now.

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

## The PalStack Vision

PantryPal is part of a larger ecosystem of self-hosted life management tools I'm building:

### PantryPal (This Project)
**Status:** Production Ready
**Purpose:** Never buy duplicate groceries again
**Integrations:** Home Assistant, mobile apps

### PropertyPal (In Development)
**Purpose:** Track home maintenance, warranties, and property documents
**Why:** Because I can never remember when I last changed the HVAC filter

### BudgetPal (Planned)
**Purpose:** Household budgeting with focus on debt repayment
**Based on:** DollarDollar Bill Y'all methodology
**Why:** Making finances manageable and transparent for couples

All three share the same philosophy:
- **Privacy-first**: Self-hosted, no cloud dependencies
- **Family-focused**: Multi-user, easy for everyone to use
- **Smart home ready**: Built with Home Assistant integration in mind
- **Open source**: Free for personal use, with commercial hosting reserved

---

## Development

### Local Development
```bash
# Backend services
docker-compose up -d

# Web UI (with hot reload)
cd services/web-ui
npm install
npm run dev

# Mobile app
cd mobile
npm install
npx expo start
```

### Building for Production
```bash
# Build all Docker images
docker-compose up -d --build

# Build iOS app
cd mobile
eas build --platform ios --profile production
```

### Project Structure
```
pantrypal/
├── docker-compose.yml          # Main orchestration file
├── nginx/                      # Reverse proxy configuration
├── services/
│   ├── api-gateway/           # Authentication and routing
│   ├── inventory-service/     # Item management
│   ├── lookup-service/        # Barcode lookup
│   └── web-ui/                # React dashboard
├── mobile/                     # React Native app
└── data/                       # SQLite databases (created on first run)
```

---

## Roadmap

**Near Term:**
- [ ] Home Assistant voice control integration
- [ ] Receipt scanning with LLM processing for bulk entry
- [ ] Android native app (currently Expo Go only)
- [ ] Shopping list generation from pantry

**Future:**
- [ ] Meal planning based on inventory
- [ ] Nutrition tracking
- [ ] Recipe suggestions based on available items
- [ ] PropertyPal & BudgetPal integration

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

This is a personal project built for my household, but:

- **Bug reports** are welcome via GitHub Issues
- **Feature suggestions** appreciated
- **Forks encouraged** for personal customization
- **Pull requests** considered for features that benefit the community

By contributing, you agree that your contributions will be licensed under the same terms as the project.

---

## License

**Personal Use License**

Copyright (c) 2025 PalStack

**Free for Personal Use:** PantryPal is freely available for personal, non-commercial, self-hosted use. You can install it, modify it, and use it in your home.

**Commercial & Hosted Services:** PalStack reserves the exclusive right to offer PantryPal as a hosted service or commercial product. If you want to offer PantryPal as a service, integrate it into a commercial product, or deploy it in a business setting, please contact us for licensing.

**Full License:** See [LICENSE](LICENSE) file for complete terms.

**Questions?** Email palstack4u@gmail.com

---

## Acknowledgments

- **My wife** - For the original suggestion to "just keep a list"
- **Three cans of tomato sauce** - For sitting in my basement and inspiring this entire project
- **AI Coding Assistants** - For being patient teachers when I had no idea what I was doing
- **Open Food Facts** - For the amazing product database API
- **Home Assistant Community** - For building an incredible smart home platform
- **Docker** - For making "but it works on my machine" a thing of the past
- **Everyone who said "just use Google Keep"** - You're not wrong

---

## Contact

**Project Maintainer:** Harun Gunasekaran  
**Email:** palstack4u@gmail.com  
**GitHub:** [@harung1993](https://github.com/harung1993)

**PalStack Projects:**
- PantryPal - This project
- PropertyPal - Coming soon
- DebtFree - Coming soon
- MinglePal - Coming soon
- BudgetPal - Planned

---

*"That's what pals do - they show up and help with the everyday stuff."*

Built for households tired of buying duplicate groceries.
---

## Version Management & Deployment

PantryPal includes automated scripts for version management and deployment across mobile and web platforms.

### Quick Version Bump

Automatically update versions across all platforms:

```bash
npm run bump-version patch   # Bug fixes: 1.3.0 -> 1.3.1
npm run bump-version minor   # New features: 1.3.0 -> 1.4.0
npm run bump-version major   # Breaking changes: 1.3.0 -> 2.0.0
```

This automatically updates:
- Mobile app version (`mobile/app.json`)
- iOS build number (auto-incremented)
- Web UI version (`services/web-ui/package.json`)

### Docker Deployment

```bash
npm run docker:build        # Build all Docker images
npm run docker:push         # Push to Docker Hub (harung43/pantrypal-*)
npm run docker:deploy       # Build and push in one command
```

### Mobile App Builds

```bash
npm run mobile:build:ios       # Build and submit to App Store
npm run mobile:build:android   # Build and submit to Play Store
npm run mobile:build:all       # Build for both platforms
```

### Complete Release Workflow

```bash
# 1. Bump version and build Docker images
npm run release:patch

# 2. Push Docker images to hub
npm run docker:push

# 3. Build and submit mobile apps
npm run mobile:build:all

# 4. Commit and tag
git add .
git commit -m "chore: release v1.3.1"
git tag v1.3.1
git push && git push --tags
```

See `scripts/README.md` for detailed documentation.

