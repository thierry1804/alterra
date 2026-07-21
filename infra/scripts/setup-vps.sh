#!/usr/bin/env bash
# Provisionnement initial VPS / serveur on-premise ALTERRA.
# Exécuter en root sur Debian/Ubuntu fraîchement installé.
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
REPO_URL="${REPO_URL:-git@github.com:alterra/alterra.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/alterra}"

echo "==> Packages système"
apt-get update
apt-get install -y ca-certificates curl git gnupg certbot rclone ufw

echo "==> Docker Engine"
if ! command -v docker >/dev/null; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

echo "==> Utilisateur déploiement"
if ! id "${DEPLOY_USER}" >/dev/null 2>&1; then
  useradd -m -s /bin/bash "${DEPLOY_USER}"
  usermod -aG docker "${DEPLOY_USER}"
fi

echo "==> Répertoires"
mkdir -p "${INSTALL_DIR}" /var/log
chown -R "${DEPLOY_USER}:${DEPLOY_USER}" "${INSTALL_DIR}"

echo "==> Pare-feu (SSH + HTTP/S pour certbot)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

cat <<EOF

Provisionnement de base terminé.

Étapes manuelles restantes :
  1. Cloner le dépôt : git clone ${REPO_URL} ${INSTALL_DIR}
  2. Copier .env.prod depuis .env.prod.example
  3. Remplir infra/secrets/ (pg_password, minio_user, minio_pass, cloudflared)
  4. cloudflared tunnel login && tunnel create (voir infra/cloudflared/config.yml)
  5. CERTBOT_EMAIL=... ./infra/scripts/certbot-init.sh
  6. TAG=latest ./infra/scripts/deploy.sh
  7. HEALTHCHECK_URL=... ./infra/scripts/install-cron.sh

Voir docs/deploy/production.md pour la checklist complète.
EOF
