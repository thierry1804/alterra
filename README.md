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

- Node.js 22+
- Docker & Docker Compose
- npm 10+

## Démarrage local (dev hybride)

L'environnement de développement sépare l'infrastructure (Docker) des applications (Node local) pour bénéficier du hot-reload sur l'API et les frontends.

| Composant | Mode dev | Port |
|-----------|----------|------|
| PostgreSQL | Docker | 5433 |
| Redis | Docker | 6380 |
| MinIO | Docker | 9000 (API), 9001 (console) |
| API Express | `npm run dev` (tsx watch) | 3001 |
| Admin | `npm run dev` (Vite) | 5173 |
| PWA | `npm run dev` (Vite) | 5174 |

### 1. Variables d'environnement

```bash
cp .env.example backend/.env
```

Le fichier `.env.example` à la racine documente toutes les variables backend : `DATABASE_URL`, `REDIS_URL`, MinIO (`MINIO_*`), JWT (`JWT_SECRET`, `JWT_REFRESH_SECRET`), CORS (`ADMIN_ORIGIN`, `PWA_ORIGIN`).

### 2. Installation

```bash
npm install
```

### 3. Infrastructure Docker

```bash
docker compose up -d    # postgres, redis, minio
```

Vérifier que les services sont up : `docker compose ps`.

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
docker compose down       # infra Docker
# Ctrl+C pour npm run dev
```

## Production

Voir [docs/runbook.md](docs/runbook.md) et `infra/docker-compose.prod.yml`.

Architecture cible : serveur on-premise, Nginx + TLS, Cloudflare Tunnel (exposition sans port entrant), PostgreSQL 16, MinIO, Redis, pgBackRest + rclone (backup 3-2-1), Uptime Kuma + Netdata (supervision), GitHub Actions → GHCR (CI/CD).
