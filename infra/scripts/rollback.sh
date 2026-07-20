#!/usr/bin/env bash
# Redeploy the previous known-good tag.
# Usage: TAG=<previous-git-sha> ./rollback.sh
set -euo pipefail

TAG="${TAG:?Set TAG=<previous-git-sha> before running}"
cd "$(dirname "$0")/.."

echo "==> Rolling back to TAG=${TAG}"
TAG="${TAG}" docker compose -f docker-compose.prod.yml up -d

echo "==> NOTE: this does not revert Prisma migrations applied after the target tag."
echo "    If the rollback crosses a breaking migration, restore from backup instead (./restore.sh)."
