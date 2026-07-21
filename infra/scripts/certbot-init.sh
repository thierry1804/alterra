#!/usr/bin/env bash
# Obtention initiale des certificats Let's Encrypt (standalone — nginx arrêté).
# Usage: CERTBOT_EMAIL=ops@alterra.mg ./certbot-init.sh
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

EMAIL="${CERTBOT_EMAIL:?Set CERTBOT_EMAIL}"
DOMAINS=(app.alterra.mg admin.alterra.mg)

echo "==> Stopping nginx for certbot standalone"
docker compose -f "${COMPOSE_FILE}" stop nginx || true

echo "==> Requesting certificates"
for domain in "${DOMAINS[@]}"; do
  certbot certonly --standalone \
    --non-interactive --agree-tos \
    -m "${EMAIL}" \
    -d "${domain}"
done

echo "==> Starting nginx"
docker compose -f "${COMPOSE_FILE}" up -d nginx

echo "Certbot init OK — configure renew cron via ./install-cron.sh"
