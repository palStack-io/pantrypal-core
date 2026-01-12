#!/bin/bash

# Docker Push Script for PantryPal
# Tags and pushes all images to Docker Hub

set -e

DOCKER_USER="harung43"
SERVICES=("web-ui" "api-gateway" "inventory-service" "lookup-service" "nginx")

echo "🐳 Tagging and pushing PantryPal images to Docker Hub..."
echo ""

for service in "${SERVICES[@]}"; do
  # Docker Compose uses the directory name, which becomes pantrypal_og-*
  LOCAL_IMAGE="pantrypal_og-$service:latest"
  REMOTE_IMAGE="$DOCKER_USER/pantrypal-$service:latest"

  echo "🏷️  Tagging $LOCAL_IMAGE as $REMOTE_IMAGE..."
  docker tag "$LOCAL_IMAGE" "$REMOTE_IMAGE"

  echo "📤 Pushing $REMOTE_IMAGE..."
  docker push "$REMOTE_IMAGE"

  echo "✅ $service pushed successfully"
  echo ""
done

echo "🎉 All images pushed to Docker Hub!"
echo ""
echo "Images available at:"
for service in "${SERVICES[@]}"; do
  echo "  - docker.io/$DOCKER_USER/pantrypal-$service:latest"
done
