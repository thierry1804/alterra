#!/usr/bin/env bash
# Rotation des mots de passe d'infrastructure du VPS de dev : Postgres, Redis, MinIO.
# À lancer par l'administrateur : ./infra/scripts/rotate-infra-secrets.sh
#
#  - Postgres : ALTER USER en place (aucun redémarrage du conteneur, données intactes)
#  - Redis    : recréé avec --requirepass (volume conservé)
#  - MinIO    : recréé avec de nouveaux identifiants root (volume conservé, mêmes images/ports)
#  - backend/.env mis à jour (DATABASE_URL, REDIS_URL, MINIO_ACCESS_KEY, MINIO_SECRET_KEY), service redémarré
#
# Les valeurs ne sont jamais affichées ni passées en argument de ligne de commande.
# Coupure : quelques secondes pour Redis et MinIO. Ne touche à aucune autre stack (toa-back, vetbook).
set -euo pipefail
umask 077

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
ENVF="$REPO/backend/.env"
BACKUP="$ENVF.pre-infra-rotation"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

fail() {
  echo
  echo "ÉCHEC : $1"
  echo "Ancien fichier d'environnement : $BACKUP (à restaurer avec : cp $BACKUP $ENVF)"
  echo "Les anciens mots de passe sont ceux du dépôt (.env.example / docker-compose.yml). Relançable après correction."
  exit 1
}

envget() { grep -E "^$1=" "$ENVF" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
gen()    { openssl rand -base64 64 | tr -d '/+=\n' | cut -c1-"$1"; }

echo "==> Vérifications préalables"
command -v psql >/dev/null || fail "psql introuvable (apt install postgresql-client)"
sudo docker ps --format '{{.Names}}' | grep -qx alterra-dev-postgres-1 || fail "conteneur alterra-dev-postgres-1 arrêté"
sudo docker ps --format '{{.Names}}' | grep -qx alterra-dev-redis-1    || fail "conteneur alterra-dev-redis-1 arrêté"
sudo docker ps --format '{{.Names}}' | grep -qx alterra-minio-manual   || fail "conteneur alterra-minio-manual arrêté"
DB_URL_OLD="$(envget DATABASE_URL)"
PG_OLD="$(python3 -c 'import sys,urllib.parse as u;print(u.unquote(u.urlparse(sys.argv[1]).password or ""))' "$DB_URL_OLD")"
PG_USER="$(python3 -c 'import sys,urllib.parse as u;print(u.unquote(u.urlparse(sys.argv[1]).username or ""))' "$DB_URL_OLD")"
PG_NAME="$(python3 -c 'import sys,urllib.parse as u;print(u.urlparse(sys.argv[1]).path.lstrip("/"))' "$DB_URL_OLD")"
PG_HOST="$(python3 -c 'import sys,urllib.parse as u;print(u.urlparse(sys.argv[1]).hostname)' "$DB_URL_OLD")"
PG_PORT="$(python3 -c 'import sys,urllib.parse as u;print(u.urlparse(sys.argv[1]).port or 5432)' "$DB_URL_OLD")"
PGPASSWORD="$PG_OLD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_NAME" -Atc 'select 1' >/dev/null \
  || fail "connexion Postgres impossible avec le mot de passe actuel du .env"

PG_NEW="$(gen 32)"; REDIS_NEW="$(gen 32)"; MINIO_USER_NEW="alt$(gen 13)"; MINIO_PASS_NEW="$(gen 32)"
cp "$ENVF" "$BACKUP"; chmod 600 "$BACKUP"

echo "==> Postgres : nouveau mot de passe pour l'utilisateur applicatif"
printf "ALTER USER \"%s\" WITH PASSWORD '%s';\n" "$PG_USER" "$PG_NEW" \
  | PGPASSWORD="$PG_OLD" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_NAME" -v ON_ERROR_STOP=1 -q >/dev/null \
  || fail "ALTER USER refusé"
PGPASSWORD="$PG_NEW" psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_NAME" -Atc 'select 1' >/dev/null \
  || fail "le nouveau mot de passe Postgres ne fonctionne pas (ancien: $BACKUP)"

echo "==> Redis : recréation avec requirepass (volume conservé)"
REDIS_PASSWORD="$REDIS_NEW" sudo --preserve-env=REDIS_PASSWORD \
  docker compose -p alterra-dev -f "$REPO/docker-compose.yml" up -d --no-deps --force-recreate redis >/dev/null 2>&1 \
  || fail "recréation de Redis impossible"

echo "==> MinIO : recréation avec de nouveaux identifiants root (volume conservé)"
IMG="$(sudo docker inspect -f '{{.Image}}' alterra-minio-manual)"
NET="$(sudo docker inspect -f '{{.HostConfig.NetworkMode}}' alterra-minio-manual)"
printf 'MINIO_ROOT_USER=%s\nMINIO_ROOT_PASSWORD=%s\n' "$MINIO_USER_NEW" "$MINIO_PASS_NEW" > "$TMP/minio.env"
sudo docker stop alterra-minio-manual >/dev/null
sudo docker rm alterra-minio-manual >/dev/null
sudo docker run -d --name alterra-minio-manual --restart unless-stopped --network "$NET" \
  -p 127.0.0.1:9002:9000 -p 127.0.0.1:9003:9001 \
  -v alterra-dev_minio_data:/data --env-file "$TMP/minio.env" \
  "$IMG" server /data --console-address ":9001" >/dev/null \
  || fail "recréation de MinIO impossible (le volume alterra-dev_minio_data est intact)"
shred -u "$TMP/minio.env"

echo "==> backend/.env"
PG_NEW="$PG_NEW" REDIS_NEW="$REDIS_NEW" MINIO_USER_NEW="$MINIO_USER_NEW" MINIO_PASS_NEW="$MINIO_PASS_NEW" ENVF="$ENVF" python3 - <<'PY'
import os, re, urllib.parse as u
p = os.environ["ENVF"]; s = open(p).read()
def setv(key, val):
    global s
    s, n = re.subn(rf'^{key}=.*$', lambda _m: f'{key}="{val}"', s, flags=re.M)
    if n != 1: s += f'\n{key}="{val}"\n'
def current(key):
    m = re.search(rf'^{key}="?([^"\n]*)"?$', s, re.M); return m.group(1) if m else ""
db = u.urlparse(current("DATABASE_URL"))
netloc = f"{u.quote(db.username or '', safe='')}:{os.environ['PG_NEW']}@{db.hostname}" + (f":{db.port}" if db.port else "")
setv("DATABASE_URL", u.urlunparse(db._replace(netloc=netloc)))
rd = u.urlparse(current("REDIS_URL") or "redis://localhost:6380")
setv("REDIS_URL", u.urlunparse(rd._replace(netloc=f":{os.environ['REDIS_NEW']}@{rd.hostname}" + (f":{rd.port}" if rd.port else ""))))
setv("MINIO_ACCESS_KEY", os.environ["MINIO_USER_NEW"]); setv("MINIO_SECRET_KEY", os.environ["MINIO_PASS_NEW"])
open(p, "w").write(s)
PY
chmod 600 "$ENVF"

echo "==> Redémarrage de l'API et vérifications"
sudo systemctl restart alterra-dev.service
sleep 12
curl -fsS http://localhost:3010/health >/dev/null || fail "l'API ne répond pas après redémarrage"
( cd "$REPO/backend" && node -e "
require('dotenv').config();
const { createClient } = require('redis'); const { Client } = require('minio');
(async () => {
  const r = createClient({ url: process.env.REDIS_URL }); await r.connect(); console.log('redis   :', await r.ping()); await r.quit();
  const m = new Client({ endPoint: process.env.MINIO_ENDPOINT, port: Number(process.env.MINIO_PORT), useSSL: process.env.MINIO_USE_SSL === 'true', accessKey: process.env.MINIO_ACCESS_KEY, secretKey: process.env.MINIO_SECRET_KEY });
  console.log('minio   :', (await m.listBuckets()).length, 'bucket(s) lisible(s)');
})().catch((e) => { console.error('VERIF ECHEC', e.message); process.exit(1); });
" ) || fail "Redis ou MinIO refuse les nouveaux identifiants"

echo "==> Sonde de garde au démarrage (ne doit plus signaler de secret par défaut)"
sudo grep -a "Secrets par défaut" /home/debian/alterra-dev.log | tail -1 | grep -o '"time":"[^"]*"' | tail -1 | sed 's/^/dernier signalement : /' || true

shred -u "$BACKUP"
echo
echo "Terminé. Nouveaux identifiants uniquement dans backend/.env (chmod 600)."
echo "Note : POSTGRES_PASSWORD dans docker-compose.yml n'a d'effet qu'à l'initialisation du volume — sans impact ici."
