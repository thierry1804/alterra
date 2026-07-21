# ALTERRA

Plateforme de suivi terrain (pointage, paie journalière) — monorepo npm workspaces.

## Structure

```
alterra/
├── backend/    API Express + Prisma (PostgreSQL, MinIO, Redis)
├── admin/      Back-office React 18 + Vite
├── pwa/        App terrain React 18 + Vite PWA (offline-first, Dexie)
├── infra/      Déploiement : docker-compose prod/staging, nginx, cloudflared, pgBackRest, scripts
├── .github/    CI/CD GitHub Actions
└── docs/       Runbook d'exploitation
```

## Prérequis

- Node.js 20+ (LTS recommandé ; 22+ supporté)
- Docker & Docker Compose
- npm 10+

## Démarrage local

Deux modes sont disponibles selon vos besoins :

| Mode               | Commande infra                              | API                         | Frontends            | Cas d'usage                                   |
| ------------------ | ------------------------------------------- | --------------------------- | -------------------- | --------------------------------------------- |
| **Stack complète** | `docker compose up -d`                      | conteneur `api` (port 3001) | —                    | smoke test, CI local, sans Node pour l'API    |
| **Dev hybride**    | `docker compose up -d postgres redis minio` | `npm run dev -w backend`    | `npm run dev` (Vite) | développement quotidien (hot-reload tsx/vite) |

| Composant   | Stack complète | Dev hybride               | Port                       |
| ----------- | -------------- | ------------------------- | -------------------------- |
| PostgreSQL  | Docker         | Docker                    | 5433                       |
| Redis       | Docker         | Docker                    | 6380                       |
| MinIO       | Docker         | Docker                    | 9000 (API), 9001 (console) |
| API Express | Docker (`api`) | `npm run dev` (tsx watch) | 3001                       |
| Admin       | —              | `npm run dev` (Vite)      | 5173                       |
| PWA         | —              | `npm run dev` (Vite)      | 5174                       |

### Stack complète (Docker)

Lance toute l'infrastructure + l'API conteneurisée (image `backend/Dockerfile`, target `runtime`).

```bash
npm install
docker compose up -d --build    # postgres, redis, minio, api
npm run db:setup -w backend     # migrations + seed (première fois)
curl http://localhost:3001/health
# {"status":"ok","db":"up","timestamp":"..."}
```

> L'API Docker attend Postgres sur le réseau interne (`postgres:5432`). Les frontends restent à lancer en local si besoin : `npm run dev -w admin` / `npm run dev -w pwa`.

### Dev hybride (recommandé)

Sépare l'infrastructure (Docker) des applications (Node local) pour le hot-reload sur l'API et les frontends.

### 1. Variables d'environnement

```bash
cp .env.example backend/.env
```

Le fichier `.env.example` à la racine documente toutes les variables backend : `DATABASE_URL`, `REDIS_URL`, MinIO (`MINIO_*`), JWT (`JWT_SECRET`, `JWT_REFRESH_SECRET`), CORS (`ADMIN_ORIGIN`, `PWA_ORIGIN`).

### 2. Installation

```bash
npm install
```

### 3. Infrastructure Docker (sans conteneur API)

```bash
docker compose up -d postgres redis minio
```

Vérifier que les services sont up : `docker compose ps`. Ne pas démarrer le service `api` en dev hybride (port 3001 réservé à `npm run dev -w backend`).

### 4. Base de données

```bash
npm run db:setup -w backend   # prisma migrate dev + seed
```

### 5. Lancer les applications

```bash
npm run dev   # backend:3001, admin:5173, pwa:5174 en parallèle
```

Ou workspace par workspace :

```bash
npm run dev -w backend
npm run dev -w admin
npm run dev -w pwa
```

### 6. Vérifier l'API

```bash
curl http://localhost:3001/health
# {"status":"ok","db":"up","timestamp":"..."}
```

## Qualité de code

Configuration ESLint + Prettier partagée à la racine (`eslint.config.js`, `.prettierrc`).

```bash
npm run lint              # backend + admin + pwa
npm run lint -w backend   # backend seul
npm run format            # Prettier write
npm run format:check      # Prettier check (CI)
npm run test -w backend   # tests Vitest
```

TypeScript strict activé dans `backend/tsconfig.json`, `admin/tsconfig.json` et `pwa/tsconfig.json`.

## Arrêt

```bash
docker compose down              # toute la stack (ou infra seule si api non démarrée)
docker compose stop api          # libérer le port 3001 avant dev hybride
# Ctrl+C pour npm run dev
```

## Production

Voir [docs/runbook.md](docs/runbook.md) et `infra/docker-compose.prod.yml`.

Architecture cible : serveur on-premise, Nginx + TLS, Cloudflare Tunnel (exposition sans port entrant), PostgreSQL 16, MinIO, Redis, pgBackRest + rclone (backup 3-2-1), Uptime Kuma + Netdata (supervision), GitHub Actions → GHCR (CI/CD).
