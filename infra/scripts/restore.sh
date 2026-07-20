#!/usr/bin/env bash
# Restore PostgreSQL from an offsite backup. Run this monthly against staging
# as a drill — an untested backup is not a backup.
# Usage: ./restore.sh 2026-07-01
set -euo pipefail

DATE="${1:?Usage: ./restore.sh <YYYY-MM-DD>}"
RCLONE_REMOTE="${RCLONE_REMOTE:-b2crypt:alterra-backups}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.staging.yml}"

cd "$(dirname "$0")/.."
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

echo "==> Fetching backup for ${DATE} from ${RCLONE_REMOTE}"
rclone copy "${RCLONE_REMOTE}/${DATE}/db-${DATE}.sql.gz" "${WORKDIR}/"

echo "==> Restoring into $(basename "${COMPOSE_FILE}") postgres service"
read -r -p "This will OVERWRITE the target database. Continue? [y/N] " confirm
[[ "${confirm}" == "y" ]] || { echo "Aborted."; exit 1; }

zcat "${WORKDIR}/db-${DATE}.sql.gz" | \
  docker compose -f "${COMPOSE_FILE}" exec -T postgres psql -U alterra alterra

echo "==> Restore complete — verify row counts and log the drill in docs/runbook.md"
