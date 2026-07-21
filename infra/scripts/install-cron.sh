#!/usr/bin/env bash
# Installe les tâches cron : backup offsite (02h00) + renouvellement TLS (03h00).
# Usage: HEALTHCHECK_URL=https://hc-ping.com/xxx ./install-cron.sh
set -euo pipefail

INFRA_DIR="$(cd "$(dirname "$0")/.." && pwd)"
HEALTHCHECK_URL="${HEALTHCHECK_URL:?Set HEALTHCHECK_URL for backup monitoring}"

BACKUP_LINE="0 2 * * * cd ${INFRA_DIR} && HEALTHCHECK_URL=${HEALTHCHECK_URL} ${INFRA_DIR}/scripts/backup-offsite.sh >> /var/log/alterra-backup.log 2>&1"
RENEW_LINE="0 3 * * * certbot renew --quiet --deploy-hook 'cd ${INFRA_DIR} && docker compose -f docker-compose.prod.yml restart nginx'"

TMP="$(mktemp)"
crontab -l 2>/dev/null | grep -v "alterra-backup" | grep -v "certbot renew" > "${TMP}" || true
echo "${BACKUP_LINE}" >> "${TMP}"
echo "${RENEW_LINE}" >> "${TMP}"
crontab "${TMP}"
rm "${TMP}"

echo "Cron installé :"
crontab -l | grep -E "alterra|certbot"
