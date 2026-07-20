#!/usr/bin/env bash
# Nightly offsite backup: pg dump + MinIO bucket -> rclone crypt -> Backblaze B2.
# Pings a healthcheck URL so a silent failure (the most common failure mode)
# triggers an alert instead of going unnoticed.
set -euo pipefail

cd "$(dirname "$0")/.."
DATE="$(date +%F)"
WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

HEALTHCHECK_URL="${HEALTHCHECK_URL:?Set HEALTHCHECK_URL (Healthchecks.io ping URL)}"
RCLONE_REMOTE="${RCLONE_REMOTE:-b2crypt:alterra-backups}"

echo "==> Dumping PostgreSQL"
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U alterra alterra | gzip > "${WORKDIR}/db-${DATE}.sql.gz"

echo "==> Mirroring MinIO buckets"
docker compose -f docker-compose.prod.yml exec -T minio \
  mc mirror --quiet local/photos-pointages "${WORKDIR}/minio/photos-pointages" || true
docker compose -f docker-compose.prod.yml exec -T minio \
  mc mirror --quiet local/rapports-pdf "${WORKDIR}/minio/rapports-pdf" || true

echo "==> Uploading to Backblaze B2 (client-side encrypted via rclone crypt)"
rclone copy "${WORKDIR}" "${RCLONE_REMOTE}/${DATE}" --transfers 4

echo "==> Pruning offsite backups older than 30 days (12 monthlies kept manually)"
rclone delete --min-age 30d "${RCLONE_REMOTE}" || true

echo "==> Notifying healthcheck"
curl -fsS -m 10 "${HEALTHCHECK_URL}" || echo "WARN: healthcheck ping failed" >&2

echo "Backup OK (${DATE})"
