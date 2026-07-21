# Task 7 Report — Module BE-PNT : Pointages

**Date :** 21 juillet 2026  
**Branche :** `feat/backlog-implementation`  
**Commit :** `cb01cbc`  
**Statut :** ✅ Complet

---

## Checklist

| Step | Item | Status |
| ---- | ---- | ------ |
| 1 | `POST /pointages/sync` — batch ≤100, idempotent `clientUuid` | ✅ |
| 2 | `GET /pointages` — cursor 50, filtres, sous-requête bio | ✅ |
| 3 | `PATCH validate/reject` — RG-03 bio OK, motif rejet | ✅ |
| 4 | `PATCH /pointages/:id` — correction Admin + audit | ✅ |
| 5 | Services extraits, routes fines | ✅ |
| 6 | Tests `pointages.test.ts` | ✅ |
| 7 | `npm run lint -w backend && npm run test -w backend` | ✅ PASS |

---

## Endpoints

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| POST | `/pointages/sync` | CDE / CDS / ADMIN | Sync batch offline (≤100 lignes) |
| GET | `/pointages` | auth | Liste paginée + filtres + `bioCheck` |
| PATCH | `/pointages/:id/validate` | CDS / ADMIN | Validation si bio OK (RG-03) |
| PATCH | `/pointages/:id/reject` | CDS / ADMIN | Rejet avec motif ≥3 car. |
| PATCH | `/pointages/:id` | ADMIN | Correction quantité/activité/date + audit |

### Filtres GET

`cursor`, `status`, `workerId`, `activityId`, `dateFrom`, `dateTo`

Chaque pointage inclut `bioCheck: { result, performedAt } | null` — dernière `BiometricCheck` du travailleur pour la semaine ISO du pointage.

---

## Services créés

| Fichier | Rôle |
| ------- | ---- |
| `sync.service.ts` | `syncPointageBatch()` — tarif snapshot RG-04, P2002 → `already_exists` |
| `validation.service.ts` | `assertBioOkForValidation()`, `validatePointage()`, `rejectPointage()` |
| `list.service.ts` | `listPointages()` — filtres + batch bio par semaine ISO |
| `correction.service.ts` | `correctPointage()` — recalcul montant + `writeAuditLog` |
| `lib/week-iso.ts` | `getIsoWeekString()` pour corrélation bio |

---

## Règles métier

- **RG-03** : validation bloquée si pas de `BiometricCheck` OK (`WEEKLY_VALIDATION` ou `POINTAGE_TASK`) pour la semaine du pointage → `422 BIO_NOT_OK`
- **RG-04** : `unitRateSnapshot` et `amount` figés à la sync ; recalculés à la correction si quantité ou activité change
- **Idempotence** : `clientUuid` unique → `created` / `already_exists` / `rejected` par ligne
- **RLS** : client Prisma scoped (worker in scope à la création)

---

## Tests

Fichier : `backend/src/__tests__/pointages.test.ts` — **6 tests PASS**

| Test | Résultat |
| ---- | -------- |
| sync → `already_exists` sur duplicate `clientUuid` | ✅ |
| validate bloquée sans bio OK | ✅ |
| validate réussie avec bio OK | ✅ |
| reject exige `rejectionReason` ≥3 car. | ✅ |
| correction admin exige `correctionReason` ≥10 car. | ✅ |
| correction admin avec audit log | ✅ |

Suite complète backend : **PASS** (lint + vitest)

---

## SHA

```
cb01cbc7f100d6867ebbf2e6a91ba75743aabc06
```

---

## Review fixes (Task 7)

**Commit :** `fix(api): pointages RG-03 latest bio, RLS update, audit correction`

| Finding | Fix |
| ------- | --- |
| RG-03 bio | `assertBioOkForValidation` — dernière `BiometricCheck` (semaine ISO, `performedAt desc`) ; OK requis, sinon `422 BIO_NOT_OK` |
| RLS validate/reject | `validateRelatedIdsInScope` — `workerId` obligatoire à la création uniquement ; updates sans `workerId` autorisés (scope via `where`) |
| Audit correction | `correctionReason` dans payloads `before`/`after` ; update + audit en `prisma.$transaction` |

### Tests ajoutés / mis à jour

| Test | Résultat |
| ---- | -------- |
| validate bloquée si dernière bio KO | ✅ |
| validate bloquée si aucune bio | ✅ |
| correction admin — audit inclut `correctionReason` + transaction | ✅ |
| RLS — Pointage update sans `workerId` | ✅ |
| RLS — Pointage create exige `workerId` | ✅ |

Suite backend : **51 passed, 1 skipped** (lint + vitest)

### SHA review fix

```
15bf57374272bb78049583e50dcdc9735382b69e
```
