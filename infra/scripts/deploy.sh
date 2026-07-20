#!/usr/bin/env bash
# Deploy a given image tag to production: pull, migrate, then bring services up.
# Usage: TAG=<git-sha> ./deploy.sh
set -euo pipefail

TAG="${TAG:?Set TAG=<git-sha> before running}"
cd "$(dirname "$0")/.."

echo "==> Pre-deploy backup"
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U alterra alterra | gzip > "./secrets/pre-deploy-$(date +%F-%H%M).sql.gz"

echo "==> Pulling images (TAG=${TAG})"
TAG="${TAG}" docker compose -f docker-compose.prod.yml pull

echo "==> Applying Prisma migrations"
TAG="${TAG}" docker compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy

echo "==> Rolling update"
TAG="${TAG}" docker compose -f docker-compose.prod.yml up -d

echo "==> Waiting for API health"
for i in $(seq 1 30); do
  if docker compose -f docker-compose.prod.yml exec -T api \
      node -e "fetch('http://localhost:3001/health').then(r=>process.exit(r.ok?0:1))" 2>/dev/null; then
    echo "Deploy OK (TAG=${TAG})"
    exit 0
  fi
  sleep 2
done

echo "Deploy FAILED: API did not become healthy — consider ./rollback.sh" >&2
exit 1
