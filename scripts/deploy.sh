#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/srv/geosains/app"
PM2_APP="news-portal-core"

cd "$APP_DIR"

TAG="${1:-}"
if [ -z "$TAG" ]; then
  echo "Usage: $0 <tag>"
  echo "Example: $0 v1.0.0"
  exit 1
fi

echo "=== Deploying $TAG ==="

# Fetch latest tags
git fetch --tags origin

# Checkout the tag
git checkout "$TAG"

# Ensure libwebp-dev for Sharp webp support
apt-get install -y libwebp-dev 2>/dev/null || true

# Install dependencies (only if package.json changed)
npm install --prefer-offline

# Rebuild Sharp with webp support (prevents 400 error on webp images)
npm rebuild sharp

# Preserve .env.production (in case checkout overwrote it)
if [ -f /tmp/.env.production.backup ]; then
  cp /tmp/.env.production.backup .env.production
fi

# Remove symlink before build (Turbopack can't handle symlinks outside root)
rm -f public/uploads

# Build
if [ -f scripts/qc_remote_build.sh ]; then
  bash scripts/qc_remote_build.sh
else
  npm run build
fi

# Recreate symlink after build
ln -sf /srv/geosains/storage/uploads public/uploads

# Restart PM2
pm2 restart "$PM2_APP"

echo "=== Deploy $TAG completed ==="