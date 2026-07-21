#!/usr/bin/env bash
# Deploy a given image tag to production: pull, migrate, then bring services up.
# Usage: TAG=<git-sha> [GHCR_IMAGE_PREFIX=ghcr.io/org/alterra] ./deploy.sh
set -euo pipefail

TAG="${TAG:?Set TAG=<git-sha> before running}"
export GHCR_IMAGE_PREFIX="${GHCR_IMAGE_PREFIX:-ghcr.io/alterra}"
cd "$(dirname "$0")/.."
COMPOSE_FILE="docker-compose.prod.yml"

compose() {
  TAG="${TAG}" GHCR_IMAGE_PREFIX="${GHCR_IMAGE_PREFIX}" docker compose -f "${COMPOSE_FILE}" "$@"
}

echo "==> Pre-deploy backup (skip if postgres not running)"
if compose ps postgres 2>/dev/null | grep -q "running"; then
  mkdir -p ./secrets
  compose exec -T postgres \
    pg_dump -U alterra alterra | gzip > "./secrets/pre-deploy-$(date +%F-%H%M).sql.gz"
else
  echo "    Postgres not running — first deploy, skipping dump"
fi

echo "==> Pulling images (TAG=${TAG}, prefix=${GHCR_IMAGE_PREFIX})"
compose pull

echo "==> Applying Prisma migrations"
compose run --rm api npx prisma migrate deploy

echo "==> Rolling update"
compose up -d

echo "==> Smoke test"
if [[ "${SKIP_SMOKE:-}" != "1" ]]; then
  COMPOSE_FILE="${COMPOSE_FILE}" ./scripts/smoke-test.sh
else
  echo "    SKIP_SMOKE=1 — smoke test ignored"
fi

echo "Deploy OK (TAG=${TAG})"
