#!/usr/bin/env bash
# Smoke tests post-déploiement — API, Postgres, fronts statiques.
# Usage: ./smoke-test.sh
# Variables optionnelles :
#   SMOKE_APP_URL=https://app.alterra.mg
#   SMOKE_ADMIN_URL=https://admin.alterra.mg
set -euo pipefail

cd "$(dirname "$0")/.."
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

failures=0

check() {
  local name="$1"
  shift
  if "$@"; then
    echo "OK  ${name}"
  else
    echo "FAIL ${name}" >&2
    failures=$((failures + 1))
  fi
}

check "API health (internal)" \
  docker compose -f "${COMPOSE_FILE}" exec -T api \
    node -e "fetch('http://localhost:3001/health').then(async r=>{if(!r.ok)process.exit(1);const b=await r.json();process.exit(b.status==='ok'?0:1)}).catch(()=>process.exit(1))"

check "PostgreSQL ready" \
  docker compose -f "${COMPOSE_FILE}" exec -T postgres pg_isready -U alterra

check "Redis ping" \
  docker compose -f "${COMPOSE_FILE}" exec -T redis redis-cli ping | grep -q PONG

check "MinIO reachable" \
  docker compose -f "${COMPOSE_FILE}" exec -T minio \
    sh -c 'wget -qO- http://127.0.0.1:9000/minio/health/live >/dev/null 2>&1 || exit 1'

check "PWA static" \
  docker compose -f "${COMPOSE_FILE}" exec -T pwa-static \
    wget -qO- http://127.0.0.1:80/ | grep -qi html

check "Admin static" \
  docker compose -f "${COMPOSE_FILE}" exec -T admin-static \
    wget -qO- http://127.0.0.1:80/ | grep -qi html

if [[ -n "${SMOKE_APP_URL:-}" ]]; then
  check "App URL ${SMOKE_APP_URL}/api/v1/health" \
    curl -fsS "${SMOKE_APP_URL}/api/v1/health" | grep -q '"status":"ok"'
fi

if [[ -n "${SMOKE_ADMIN_URL:-}" ]]; then
  check "Admin URL ${SMOKE_ADMIN_URL}/api/v1/health" \
    curl -fsS "${SMOKE_ADMIN_URL}/api/v1/health" | grep -q '"status":"ok"'
fi

if [[ "${failures}" -gt 0 ]]; then
  echo "Smoke test FAILED (${failures} check(s))" >&2
  exit 1
fi

echo "Smoke test OK"
