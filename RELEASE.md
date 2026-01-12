# Release Checklist

Use this checklist when creating a new release of PantryPal.

## Pre-Release Checklist

- [ ] All code changes committed and pushed
- [ ] Web UI working locally (test at http://localhost)
- [ ] Mobile app tested in Expo Go
- [ ] All tests passing
- [ ] Docker containers running successfully

## Release Steps

### 1. Bump Version

Choose the appropriate bump type:

```bash
# For bug fixes and minor improvements
npm run bump-version patch

# For new features
npm run bump-version minor

# For breaking changes
npm run bump-version major
```

### 2. Review Version Changes

```bash
git diff
```

Verify that versions were updated correctly:
- `mobile/app.json` - version and iOS buildNumber
- `services/web-ui/package.json` - version
- `package.json` - version

### 3. Build and Test Docker Images

```bash
# Build all images
npm run docker:build

# Test locally
npm run docker:up

# Verify all services are running
docker-compose ps
```

Test the web UI at http://localhost to ensure everything works.

### 4. Push Docker Images to Hub

```bash
npm run docker:push
```

This pushes all images to `harung43/pantrypal-*:latest`

### 5. Build Mobile Apps

```bash
# Build for iOS only
npm run mobile:build:ios

# Build for Android only
npm run mobile:build:android

# Build for both platforms
npm run mobile:build:all
```

Wait for EAS builds to complete and automatically submit to stores.

### 6. Commit and Tag Release

```bash
# Get the new version number
VERSION=$(node -p "require('./mobile/app.json').expo.version")

# Commit version bump
git add .
git commit -m "chore: release v$VERSION"

# Create git tag
git tag "v$VERSION"

# Push commits and tags
git push origin main
git push origin "v$VERSION"
```

### 7. Deploy to Remote Server (Optional)

If deploying to your remote server at 100.122.220.35:

```bash
# SSH to remote server
ssh user@100.122.220.35

# Navigate to project
cd /path/to/pantrypal

# Pull latest Docker images
docker-compose pull

# Restart services
docker-compose down
docker-compose up -d
```

## Post-Release

- [ ] Verify Docker Hub images updated: https://hub.docker.com/u/harung43
- [ ] Verify mobile builds submitted to App Store/Play Store
- [ ] Test web UI on remote server (if deployed)
- [ ] Update release notes in GitHub (if applicable)
- [ ] Announce release (if applicable)

## Quick Reference Commands

| Task | Command |
|------|---------|
| Bump patch version | `npm run bump-version patch` |
| Bump minor version | `npm run bump-version minor` |
| Bump major version | `npm run bump-version major` |
| Build Docker images | `npm run docker:build` |
| Push to Docker Hub | `npm run docker:push` |
| Build & push Docker | `npm run docker:deploy` |
| Build iOS app | `npm run mobile:build:ios` |
| Build Android app | `npm run mobile:build:android` |
| Build both platforms | `npm run mobile:build:all` |

## Troubleshooting

### Version bump failed
- Check that `mobile/app.json` exists and is valid JSON
- Ensure you have write permissions to all package files

### Docker push failed
- Check that you're logged in: `docker login`
- Verify images were built: `docker images | grep pantrypal`

### Mobile build failed
- Check you're logged into EAS: `eas whoami`
- Verify `app.json` is valid: `cd mobile && npx expo-doctor`
- Check build logs in EAS dashboard

### Remote deployment failed
- Verify SSH access to server
- Check Docker is installed and running on server
- Ensure docker-compose.yml is present on server
