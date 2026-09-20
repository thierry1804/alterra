#!/usr/bin/env bash
# Déploiement du VPS de dev : les frontends publics sont des BUILDS (vite preview), pas des serveurs de dev.
# À relancer après chaque `git pull` pour que boss-etech.net reflète le code : ./infra/scripts/deploy-dev.sh
#
# Pour développer avec rechargement à chaud, lance `npm run dev` sur TON poste (ou sur le VPS avec
# `npm run dev -w admin -- --host 127.0.0.1 --port 5183`, jamais exposé par le tunnel).
set -euo pipefail
cd "$(dirname "$0")/../.."

PUBLIC_ADMIN_ORIGIN="${PUBLIC_ADMIN_ORIGIN:-https://alterra-admin.boss-etech.net}"
PUBLIC_PWA_ORIGIN="${PUBLIC_PWA_ORIGIN:-https://alterra-pwa.boss-etech.net}"

echo "==> Dépendances + base de données"
npm install --no-audit --no-fund
( cd backend && npx prisma migrate deploy && npx prisma generate )

echo "==> Build des frontends (vérification TypeScript incluse)"
export VITE_ADMIN_ORIGIN="$PUBLIC_ADMIN_ORIGIN" VITE_PWA_ORIGIN="$PUBLIC_PWA_ORIGIN"
npm run build -w admin
npm run build -w pwa

echo "==> Redémarrage du service"
sudo systemctl restart alterra-dev.service
sleep 10
curl -fsS http://localhost:3010/health && echo
echo "Déployé."
