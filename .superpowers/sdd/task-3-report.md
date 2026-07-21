# Task 3 Report — Module BE-DB : Modèle de données

**Date:** 2026-07-21  
**Branch:** `feat/backlog-implementation`  
**Commit:** `6adb531` — `feat(db): schéma V1 complet + seed déterministe`  
**Status:** ⚠️ Partiel — schéma + seed + migration prêts ; `db:setup` non exécuté (Docker/Postgres indisponible)

---

## Checklist

| Step | Item | Status |
| ---- | ---- | ------ |
| 1 | Schéma Prisma V1 complet (13 modèles) | ✅ |
| 1 | `RefreshToken` (tokenHash, expiresAt, revokedAt, deviceInfo?) | ✅ |
| 1 | `PasswordReset` (tokenHash, expiresAt, usedAt) | ✅ |
| 1 | Relations User ↔ tokens | ✅ |
| 1 | Modèles V2 conservés | ✅ |
| 2 | Migration `v1_refresh_password_reset` | ✅ (SQL versionné) |
| 3 | Seed déterministe (UUIDs fixes) | ✅ |
| 3 | 1 admin, 5 CDS, 15 CDE | ✅ |
| 3 | 5 sites, 10 activités, 50 MOC | ✅ |
| 4 | `npm run db:setup -w backend` | ⚠️ Bloqué — Postgres `:5433` injoignable |
| 5 | Test vitest comptages seed | ✅ (skip si DB down) |
| 6 | `npm run test -w backend` | ✅ PASS |

---

## Changements principaux

### Schéma (`backend/prisma/schema.prisma`)

- Ajout `RefreshToken` : id, userId FK (CASCADE), tokenHash unique, expiresAt, revokedAt?, deviceInfo?, createdAt
- Ajout `PasswordReset` : id, userId FK (CASCADE), tokenHash unique, expiresAt, usedAt?, createdAt
- Relations `User.refreshTokens` et `User.passwordResets`
- Index sur `userId` et `expiresAt` pour les deux tables

### Migration

- `backend/prisma/migrations/20260721164500_v1_refresh_password_reset/migration.sql`
- Créée manuellement car le daemon Docker n'était pas disponible (`prisma migrate dev` nécessite une connexion DB)

### Seed déterministe

- `backend/prisma/seed-data.ts` — constantes, UUIDs fixes, comptages attendus
- `backend/prisma/seed.ts` — upserts idempotents

| Entité | Quantité | Détail |
| ------ | -------- | ------ |
| Admin | 1 | `admin@alterra.mg` / `ChangeMe123!` |
| CDS | 5 | `cds.{site}@alterra.test` — 1 par site |
| CDE | 15 | `cde.{site}{1-3}@alterra.test` — 3 équipes/site |
| Sites | 5 | MNK, ANT, ANJ, MGT, AMB |
| Équipes | 15 | `{SITE}-1`, `{SITE}-2`, `{SITE}-3` |
| Activités | 10 | UUIDs `0006-*`, 5 liées aux sites |
| MOC | 50 | 10 par site, matricules `MOC-{SITE}-01..10` |

Mot de passe CDS/CDE : `test123!`

### Tests

- `backend/src/__tests__/seed.test.ts` — vérifie les comptages post-seed (skip si DB injoignable)
- `backend/vitest.config.ts` — charge `.env` pour `DATABASE_URL`
- `backend/package.json` — bloc `"prisma": { "seed": "tsx prisma/seed.ts" }`

---

## Tests & lint

```
npm run test -w backend   → PASS
  ✓ GET /health responds with status ok or degraded
  ✓ GET /api/v1/health responds with status ok or degraded
  ↷ seed data counts (skipped — DB unavailable)
  (2 passed | 1 skipped, 3 total)
```

---

## Bloqueur environnement

```
docker compose up -d postgres
→ failed to connect to the docker API (daemon not running)

prisma migrate dev
→ P1001: Can't reach database server at localhost:5433
```

**Pour finaliser localement :**

```bash
docker compose up -d postgres
npm run db:setup -w backend
npm run test -w backend
```

---

## Fichiers modifiés

- `backend/prisma/schema.prisma`
- `backend/prisma/seed.ts`
- `backend/prisma/seed-data.ts` (nouveau)
- `backend/prisma/migrations/20260721164500_v1_refresh_password_reset/migration.sql` (nouveau)
- `backend/package.json`
- `backend/vitest.config.ts`
- `backend/src/__tests__/seed.test.ts` (nouveau)

---

## Décisions

1. **Migration SQL manuelle** — Prisma exige une DB pour `migrate dev` ; le SQL a été généré conformément au schéma pour ne pas bloquer le commit.
2. **seed-data.ts séparé** — évite l'exécution du seed à l'import dans les tests.
3. **Test seed skip gracieux** — les tests passent sans Postgres ; le test seed s'active dès que la DB répond.
