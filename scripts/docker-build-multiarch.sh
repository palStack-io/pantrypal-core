#!/bin/bash

# Multi-Architecture Docker Build Script for PantryPal
# Builds images for both AMD64 (Intel/AMD) and ARM64 (Apple Silicon, Raspberry Pi)

set -e

DOCKER_USER="harung43"
SERVICES=("web-ui" "api-gateway" "inventory-service" "lookup-service" "nginx")
PLATFORMS="linux/amd64,linux/arm64"

echo "🏗️  Building multi-architecture PantryPal images..."
echo "📦 Platforms: $PLATFORMS"
echo ""

# Check if buildx is available
if ! docker buildx version > /dev/null 2>&1; then
  echo "❌ Docker Buildx is not available. Please install Docker Desktop or enable buildx."
  exit 1
fi

# Create and use a new builder if needed
if ! docker buildx inspect multiplatform > /dev/null 2>&1; then
  echo "🔧 Creating new buildx builder 'multiplatform'..."
  docker buildx create --name multiplatform --use
  docker buildx inspect --bootstrap
else
  echo "✅ Using existing buildx builder 'multiplatform'"
  docker buildx use multiplatform
fi

echo ""

# Build each service
for service in "${SERVICES[@]}"; do
  echo "🏗️  Building $service for multiple architectures..."

  case $service in
    "web-ui")
      CONTEXT="./services/web-ui"
      ;;
    "api-gateway")
      CONTEXT="./services/api-gateway"
      ;;
    "inventory-service")
      CONTEXT="./services/inventory-service"
      ;;
    "lookup-service")
      CONTEXT="./services/lookup-service"
      ;;
    "nginx")
      CONTEXT="./nginx"
      ;;
  esac

  docker buildx build \
    --platform $PLATFORMS \
    --tag "$DOCKER_USER/pantrypal-$service:latest" \
    --push \
    $CONTEXT

  echo "✅ $service built and pushed successfully"
  echo ""
done

echo "🎉 All multi-architecture images built and pushed to Docker Hub!"
echo ""
echo "Images available for AMD64 and ARM64 at:"
for service in "${SERVICES[@]}"; do
  echo "  - docker.io/$DOCKER_USER/pantrypal-$service:latest"
done
