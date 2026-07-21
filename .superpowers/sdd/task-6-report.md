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

---

## Review fixes (2026-07-21)

**Commit:** `af3a750`  
**Status:** ✅ DONE — 9 findings corrigés

| # | Finding | Fix |
| - | ------- | --- |
| 1 | `requireAuth` sans check blocklist | `isUserBlocked()` → 401 `USER_BLOCKED` |
| 2 | GET `/activities` sans filtre site non-admin | OR `siteId null` + site utilisateur |
| 3 | PATCH tarif sans champs associés | Overrides `label/unit/siteId/validFrom/active` passés à RG-04 |
| 4 | RG-04 dates incorrectes | `computeRateChangeDates()` basé sur `validFrom` + edge case même jour |
| 5 | Import dry-run incomplet | Doublons fichier + DB, vérif site/team existants |
| 6 | Photo worker non confirmée | `POST /workers/:id/photo` + `photoKey` en PATCH |
| 7 | Reset MDP sans revoke | `resetUserPassword()` revoke tokens + block Redis 15 min |
| 8 | `shortCode` sans validation | Regex `^[A-Z]{2,3}$` + P2002 → 409 |
| 9 | Recherche workers | OR Prisma `mode: insensitive` (documenté) |

### Tests & lint (post-review)

```
npm run lint -w backend  → PASS
npm run test -w backend  → PASS
  ✓ referentials: 12 tests (+ blocked 401, import dupes, reset-password revoke)
  ✓ rbac (×19)
  ✓ auth (×9)
  ✓ health (×2)
  ↷ seed (skipped)
  (42 passed | 1 skipped, 43 total)
```
