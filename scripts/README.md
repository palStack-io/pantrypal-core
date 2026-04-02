# PantryPal Build & Release Scripts

This directory contains automation scripts for versioning and deployment.

## Version Management

### Bump Version

Automatically increments version numbers across mobile app and web UI:

```bash
# From project root
npm run bump-version patch   # 1.3.0 -> 1.3.1 (bug fixes)
npm run bump-version minor   # 1.3.0 -> 1.4.0 (new features)
npm run bump-version major   # 1.3.0 -> 2.0.0 (breaking changes)
```

This script will:
- Update version in `mobile/app.json`
- Increment iOS build number automatically
- Update version in `services/web-ui/package.json`
- Update version in root `package.json`

### What Gets Updated

**Mobile (`mobile/app.json`):**
```json
{
  "expo": {
    "version": "1.3.0",        // Updated to new version
    "ios": {
      "buildNumber": "4"       // Auto-incremented
    }
  }
}
```

**Web UI (`services/web-ui/package.json`):**
```json
{
  "version": "1.3.0"           // Updated to new version
}
```

## Docker Management

### Build and Push to Docker Hub

```bash
# Build all Docker images
npm run docker:build

# Push all images to Docker Hub
npm run docker:push

# Build and push in one command
npm run docker:deploy
```

### Individual Docker Commands

```bash
npm run docker:up       # Start all containers
npm run docker:down     # Stop all containers
npm run docker:rebuild  # Rebuild and restart
```

## Mobile App Builds

```bash
npm run mobile:build:ios       # Build and submit to App Store
npm run mobile:build:android   # Build and submit to Play Store
npm run mobile:build:all       # Build for both platforms
```

## Complete Release Workflow

### Patch Release (Bug Fixes)

```bash
npm run release:patch
npm run docker:push
npm run mobile:build:all
git add . && git commit -m "chore: release v1.3.1"
git tag v1.3.1
git push && git push --tags
```

### Minor Release (New Features)

```bash
npm run release:minor
npm run docker:push
npm run mobile:build:all
git add . && git commit -m "chore: release v1.4.0"
git tag v1.4.0
git push && git push --tags
```

### Major Release (Breaking Changes)

```bash
npm run release:major
npm run docker:push
npm run mobile:build:all
git add . && git commit -m "chore: release v2.0.0"
git tag v2.0.0
git push && git push --tags
```

## Files Modified by Scripts

- `mobile/app.json` - App version and iOS build number
- `services/web-ui/package.json` - Web UI version
- `package.json` - Root package version

## Notes

- The bump-version script uses the mobile app version as the source of truth
- iOS build numbers are auto-incremented on each version bump
- Docker images are always tagged with `latest`
- All scripts should be run from the project root directory
