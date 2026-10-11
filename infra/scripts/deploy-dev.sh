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

echo "==> Conteneurs Postgres et Redis"
# docker-compose.yml lit REDIS_PASSWORD depuis le .env de la racine (ignoré par git). S'il est absent ou
# périmé, `docker compose up` recrée Redis SANS mot de passe alors que backend/.env s'attend à s'authentifier :
# toute requête qui touche Redis (dont /auth/login) reste bloquée sans jamais répondre, sans erreur visible.
# On régénère donc ce .env à chaque déploiement à partir de backend/.env, seule source de vérité.
REDIS_PASSWORD="$(sed -n 's#^REDIS_URL="redis://:\([^@]*\)@.*#\1#p' backend/.env | head -1)"
if [ -z "$REDIS_PASSWORD" ]; then
  echo "Mot de passe Redis introuvable dans backend/.env (REDIS_URL) — abandon." >&2
  exit 1
fi
touch .env
if grep -q '^REDIS_PASSWORD=' .env; then
  sed -i "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=${REDIS_PASSWORD}/" .env
else
  echo "REDIS_PASSWORD=${REDIS_PASSWORD}" >> .env
fi
sudo docker compose -f docker-compose.yml up -d postgres redis
sleep 2
if ! sudo docker exec alterra-dev-redis-1 redis-cli -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -q PONG; then
  echo "Redis n'accepte pas le mot de passe attendu, recréation du conteneur…"
  sudo docker compose -f docker-compose.yml up -d --force-recreate redis
  sleep 2
  sudo docker exec alterra-dev-redis-1 redis-cli -a "$REDIS_PASSWORD" ping 2>/dev/null | grep -q PONG \
    || { echo "Échec : Redis toujours inaccessible avec ce mot de passe." >&2; exit 1; }
fi

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
