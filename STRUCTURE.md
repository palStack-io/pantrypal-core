# PantryPal Directory Structure

```
pantrypal/
├── archive/                    # Old scripts (archived)
├── backups/                    # Database backups
├── postgres_data/              # PostgreSQL data (Docker volume, gitignored)
├── minio_data/                 # MinIO object storage (Docker volume, gitignored)
├── mobile/                     # React Native mobile app
│   ├── assets/                # App icons, splash screens
│   ├── src/
│   │   ├── screens/           # App screens
│   │   ├── services/          # API client, notifications
│   │   ├── styles/            # Color schemes, themes
│   │   └── utils/             # Helper functions
│   ├── app.json               # Expo configuration
│   └── package.json
├── nginx/                      # Nginx reverse proxy
│   ├── nginx.conf             # Nginx configuration
│   └── Dockerfile
├── scripts/                    # Automation scripts
│   ├── bump-version.js        # Version management
│   ├── docker-push.sh         # Docker Hub deployment
│   └── README.md              # Scripts documentation
├── services/
│   ├── api-gateway/           # Main API gateway (port 8000)
│   │   ├── app/
│   │   │   ├── routes/        # API endpoints
│   │   │   ├── models/        # Database models
│   │   │   ├── services/      # Business logic
│   │   │   └── main.py        # FastAPI app
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   ├── inventory-service/     # Inventory microservice (port 8001)
│   ├── lookup-service/        # Barcode lookup (port 8002)
│   └── web-ui/                # React web interface
│       ├── src/
│       │   ├── components/    # Reusable components
│       │   ├── pages/         # Page components
│       │   ├── hooks/         # Custom React hooks
│       │   ├── utils/         # Utilities
│       │   └── App.jsx        # Main app component
│       ├── Dockerfile
│       └── package.json
├── docker-compose.yml          # Docker orchestration
├── package.json               # Root scripts & automation
├── README.md                  # Project documentation
├── RELEASE.md                 # Release checklist
└── STRUCTURE.md               # This file

```

## Key Files

### Configuration Files
- `docker-compose.yml` - Docker service orchestration
- `package.json` - NPM scripts for automation
- `mobile/app.json` - Mobile app configuration
- `nginx/nginx.conf` - Reverse proxy configuration

### Documentation
- `README.md` - Main project README
- `RELEASE.md` - Release workflow checklist
- `STRUCTURE.md` - Directory structure (this file)
- `scripts/README.md` - Automation scripts guide

### Automation Scripts
- `scripts/bump-version.js` - Version management
- `scripts/docker-push.sh` - Docker Hub deployment

## Service Ports

| Service | Internal Port | External Port | Description |
|---------|--------------|---------------|-------------|
| nginx | 80 | 8888 | Reverse proxy & web UI |
| api-gateway | 8000 | - | Main API |
| inventory-service | 8001 | - | Inventory management |
| lookup-service | 8002 | - | Barcode lookup |
| web-ui | 5173 | - | React dev server (via nginx) |
| postgres | 5432 | - | PostgreSQL database |
| minio | 9000 | - | Object storage (recipe images) |

## Data Persistence

All persistent data is stored in Docker volumes:
- `postgres_data/` - PostgreSQL database (users, inventory, recipes)
- `minio_data/` - MinIO object storage (recipe images)

**Important:** These volumes are gitignored and should be backed up separately.

## Docker Images

All images are published to Docker Hub under `harung43/pantrypal-*`:
- `harung43/pantrypal-nginx:latest`
- `harung43/pantrypal-web-ui:latest`
- `harung43/pantrypal-api-gateway:latest`
- `harung43/pantrypal-inventory-service:latest`
- `harung43/pantrypal-lookup-service:latest`

## Development Workflow

1. Make code changes
2. Test locally: `npm run docker:rebuild`
3. Bump version: `npm run bump-version patch`
4. Build & push: `npm run docker:deploy:multiarch`
5. Build mobile: `npm run mobile:build:all`
6. Commit and tag release

See `RELEASE.md` for detailed release workflow.

## NPM Scripts

### Docker Commands
- `npm run docker:build` - Build Docker images for current architecture
- `npm run docker:build:multiarch` - Build multi-architecture images (AMD64 + ARM64)
- `npm run docker:up` - Start Docker containers
- `npm run docker:down` - Stop Docker containers
- `npm run docker:push` - Push images to Docker Hub
- `npm run docker:rebuild` - Stop, rebuild, and restart containers
- `npm run docker:deploy` - Build and push (single architecture)
- `npm run docker:deploy:multiarch` - Build and push multi-architecture images

### Mobile App Commands
- `npm run mobile:build:ios` - Build and submit iOS app to TestFlight
- `npm run mobile:build:android` - Build and submit Android app
- `npm run mobile:build:all` - Build and submit both platforms

### Release Commands
- `npm run bump-version patch` - Increment patch version (1.3.0 → 1.3.1)
- `npm run release:patch` - Bump patch version + build multiarch images
- `npm run release:minor` - Bump minor version + build multiarch images
- `npm run release:major` - Bump major version + build multiarch images
