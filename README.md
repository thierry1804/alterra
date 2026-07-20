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

## Démarrage local

```bash
cp .env.example backend/.env
npm install
docker compose up -d          # postgres, redis, minio
npm run db:setup -w backend   # migrate + seed
npm run dev                   # backend:3001, admin:5173, pwa:5174
```

## Production

Voir [docs/runbook.md](docs/runbook.md) et `infra/docker-compose.prod.yml`.

Architecture cible : serveur on-premise, Nginx + TLS, Cloudflare Tunnel (exposition sans port entrant), PostgreSQL 16, MinIO, Redis, pgBackRest + rclone (backup 3-2-1), Uptime Kuma + Netdata (supervision), GitHub Actions → GHCR (CI/CD).
