# Task 6 Report — Module BE-REF : Référentiels

**Date:** 2026-07-21  
**Branch:** `feat/backlog-implementation`  
**Commit:** `6d3f967`  
**Status:** ✅ Complet — CRUD sites, activités, workers, users + import Excel

---

## Checklist

| Step | Item | Status |
| ---- | ---- | ------ |
| 1 | CRUD `/sites` (5 endpoints, Zod, audit) | ✅ |
| 2 | CRUD `/activities` avec versioning tarif RG-04 | ✅ |
| 3 | CRUD `/workers` (filtres, recherche, photo presignée) | ✅ |
| 4 | `POST /workers/import` (exceljs, dry-run, transaction) | ✅ |
| 5 | CRUD `/users` (reset MDP, désactivation + Redis) | ✅ |
| 6 | Routes câblées dans `routes/index.ts` | ✅ |
| 7 | Tests `referentials.test.ts` | ✅ |
| 8 | `npm run lint -w backend && npm run test -w backend` | ✅ PASS |

---

## Endpoints livrés

### Sites (`/api/v1/sites`)

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/sites` | auth | Liste (RLS site pour non-admin) |
| GET | `/sites/:id` | auth | Détail |
| POST | `/sites` | ADMIN | Création |
| PATCH | `/sites/:id` | ADMIN | Mise à jour (name, location, geo, active) |
| DELETE | `/sites/:id` | ADMIN | Soft deactivate (`active=false`) |

### Activities (`/api/v1/activities`)

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/activities` | auth | Filtres `siteId`, `active`, `?history=true` |
| GET | `/activities/:id` | auth | Détail |
| POST | `/activities` | ADMIN | Création |
| PATCH | `/activities/:id` | ADMIN | RG-04 si `unitRate` change |
| DELETE | `/activities/:id` | ADMIN | Soft deactivate |

### Workers (`/api/v1/workers`)

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/workers` | auth | Cursor pagination, filtres site/team/status, `q` |
| GET | `/workers/:id` | auth | Détail |
| POST | `/workers` | ADMIN | Création |
| PATCH | `/workers/:id` | ADMIN | Mise à jour |
| DELETE | `/workers/:id` | ADMIN | Soft delete (`deletedAt`) |
| POST | `/workers/:id/photo-upload-url` | ADMIN | URL MinIO presignée |
| POST | `/workers/import?dryRun=` | ADMIN | Import Excel base64 |

### Users (`/api/v1/users`)

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/users` | ADMIN | Liste paginée, filtres role/site/active |
| GET | `/users/:id` | ADMIN | Détail |
| POST | `/users` | ADMIN | Création (MDP temp ou fourni, Argon2id) |
| PATCH | `/users/:id` | ADMIN | Mise à jour |
| POST | `/users/:id/reset-password` | ADMIN | Réinitialisation MDP |
| POST | `/users/:id/deactivate` | ADMIN | Désactivation + revoke tokens + Redis block |

---

## Services

- `activity-version.service.ts` — RG-04 : fermeture `validTo` (J-1) + nouvelle ligne tarif
- `workers-import.service.ts` — parsing ExcelJS, validation lignes, insert transactionnel
- `presigned-url.service.ts` — URL upload photo worker MinIO
- `user-admin.service.ts` — génération MDP, hash, désactivation avec audit
- `redis.ts` — `blockUser()` / `isUserBlocked()` clé `user:blocked:{userId}` TTL 7j

---

## Tests & lint

```
npm run lint -w backend  → PASS
npm run test -w backend  → PASS
  ✓ referentials: validation site 422 (×1)
  ✓ referentials: RG-04 rate change (×2)
  ✓ referentials: import dry-run errors (×2)
  ✓ referentials: user deactivate + Redis (×1)
  ✓ rbac (×19)
  ✓ auth (×9)
  ✓ health (×2)
  ↷ seed (skipped — DB unavailable)
  (36 passed | 1 skipped, 37 total)
```

---

## Fichiers créés / modifiés

| Fichier | Action |
| ------- | ------ |
| `backend/src/routes/sites.routes.ts` | Modifié — CRUD complet |
| `backend/src/routes/activities.routes.ts` | Créé |
| `backend/src/routes/workers.routes.ts` | Modifié — CRUD + import + photo |
| `backend/src/routes/users.routes.ts` | Créé |
| `backend/src/routes/index.ts` | Modifié |
| `backend/src/services/activities/activity-version.service.ts` | Créé |
| `backend/src/services/import/workers-import.service.ts` | Créé |
| `backend/src/services/storage/presigned-url.service.ts` | Créé |
| `backend/src/services/users/user-admin.service.ts` | Créé |
| `backend/src/lib/redis.ts` | Modifié — user blocklist |
| `backend/src/middleware/audit.interceptor.ts` | Modifié — routes sensibles |
| `backend/src/__tests__/referentials.test.ts` | Créé |
| `backend/package.json` | Modifié — dépendance `exceljs` |

---

## Notes

- Import workers : payload JSON `{ contentBase64 }` ; `dryRun=true` par défaut
- Colonnes Excel attendues : matricule, firstName, lastName, mvolaNumber, siteId, hiredAt (+ optionnels teamId, cinNumber, status)
- Audit explicite via `writeAuditLog()` sur actions admin sensibles (CREATE, UPDATE, DEACTIVATE, IMPORT, RESET_PASSWORD)
