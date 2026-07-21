#!/usr/bin/env bash
# Redeploy the previous known-good tag.
# Usage: TAG=<previous-git-sha> ./rollback.sh
set -euo pipefail

TAG="${TAG:?Set TAG=<previous-git-sha> before running}"
export GHCR_IMAGE_PREFIX="${GHCR_IMAGE_PREFIX:-ghcr.io/alterra}"
cd "$(dirname "$0")/.."
COMPOSE_FILE="docker-compose.prod.yml"

echo "==> Rolling back to TAG=${TAG}"
TAG="${TAG}" GHCR_IMAGE_PREFIX="${GHCR_IMAGE_PREFIX}" docker compose -f "${COMPOSE_FILE}" up -d

echo "==> Smoke test"
COMPOSE_FILE="${COMPOSE_FILE}" ./scripts/smoke-test.sh

echo "==> NOTE: this does not revert Prisma migrations applied after the target tag."
echo "    If the rollback crosses a breaking migration, restore from backup instead (./restore.sh)."
