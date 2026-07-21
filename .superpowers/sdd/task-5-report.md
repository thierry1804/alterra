# Task 5 Report — Module BE-RBAC : RBAC et audit

**Date:** 2026-07-21  
**Branch:** `feat/backlog-implementation`  
**Commit:** _(see git log)_  
**Status:** ✅ Complet — requireRole typé, Prisma RLS, audit log + triggers PostgreSQL

---

## Checklist

| Step | Item | Status |
| ---- | ---- | ------ |
| 1 | Guard rôles paramétrable (403 typé via ApiError) | ✅ |
| 2 | Middleware Prisma filtrage siteId (CDS) / teamId (CDE) | ✅ |
| 3 | Audit log append-only (extension Prisma + triggers PG) | ✅ |
| 4 | Tests RBAC par rôle (vitest, mocks Prisma) | ✅ |
| 5 | `npm run lint -w backend && npm run test -w backend` | ✅ PASS |

---

## Changements principaux

### RBAC (`backend/src/middleware/rbac.ts`)

- `requireRole()` lève `ApiError(403, "FORBIDDEN", …)` avec `details: { requiredRoles, actualRole }`
- `siteScope()` — attache `req.siteScope` pour CDS (complément au filtrage Prisma)
- `teamScope()` — attache `req.teamScope` pour CDE

### Prisma RLS (`backend/src/middleware/prisma-rls.ts`)

- `AsyncLocalStorage` pour `{ userId, role, siteId, teamId, ip, userAgent }`
- `requestContext` middleware (app.ts, après cookieParser)
- `updateRequestContext()` appelé dans `requireAuth` après vérification JWT
- Extension `$extends` sur lectures : Worker, Pointage, Payment, Team, User
  - ADMIN : pas de filtre
  - CHEF_SERVICE : `siteId` (ou `worker.siteId` pour Pointage/Payment)
  - CHEF_EQUIPE : `teamId` (ou `worker.teamId`, `Team.id` pour Team)
- Helpers exportés : `getSiteFilter()`, `getTeamFilter()`

### JWT (`backend/src/lib/jwt.ts`)

- Payload enrichi : `{ sub, role, siteId, teamId }` pour alimenter le contexte RLS

### Audit

- **Service** (`backend/src/services/audit/audit.service.ts`) : `writeAuditLog({ userId, action, entityType, entityId, before, after, ip, userAgent })`
- **Extension Prisma** (`backend/src/middleware/audit.interceptor.ts`) : auto-audit CREATE/UPDATE/DELETE sur Worker, Pointage, Payment
- **Middleware Express** `auditSensitiveRoutes()` : marque les routes sensibles sur `/api/v1`
- **Migration PG** (`backend/prisma/migrations/20260721180000_audit_triggers/migration.sql`) : triggers AFTER INSERT/UPDATE/DELETE (defense in depth)

### Prisma client (`backend/src/lib/prisma-base.ts`, `prisma.ts`)

- Client de base séparé pour éviter la récursion audit
- Client exporté = base + RLS + audit extensions

### Routes simplifiées

- `workers.routes.ts`, `pointages.routes.ts` : suppression du filtrage manuel `req.siteScope` (délégué à l'extension Prisma)

### App wiring (`backend/src/app.ts`)

- `requestContext` après `cookieParser`
- `auditSensitiveRoutes` sur le préfixe `/api/v1`

---

## Tests & lint

```
npm run lint -w backend  → PASS
npm run test -w backend  → PASS
  ✓ rbac: ADMIN allowed on admin-only route
  ✓ rbac: CDE forbidden → 403 FORBIDDEN + details
  ✓ rbac: getSiteFilter / getTeamFilter per role (×4)
  ✓ rbac: writeAuditLog shape
  ✓ auth endpoints (×9)
  ✓ health endpoints (×2)
  ↷ seed data counts (skipped — DB unavailable)
  (18 passed | 1 skipped, 19 total)
```

---

## Fichiers créés / modifiés

| Fichier | Action |
| ------- | ------ |
| `backend/src/middleware/rbac.ts` | Modifié |
| `backend/src/middleware/prisma-rls.ts` | Créé |
| `backend/src/middleware/audit.interceptor.ts` | Créé |
| `backend/src/services/audit/audit.service.ts` | Créé |
| `backend/src/lib/prisma-base.ts` | Créé |
| `backend/src/lib/prisma.ts` | Modifié |
| `backend/src/lib/jwt.ts` | Modifié |
| `backend/src/middleware/auth.ts` | Modifié |
| `backend/src/app.ts` | Modifié |
| `backend/src/routes/auth.routes.ts` | Modifié |
| `backend/src/routes/workers.routes.ts` | Modifié |
| `backend/src/routes/pointages.routes.ts` | Modifié |
| `backend/src/services/auth/refresh.service.ts` | Modifié |
| `backend/prisma/migrations/20260721180000_audit_triggers/migration.sql` | Créé |
| `backend/src/__tests__/rbac.test.ts` | Créé |
| `backend/src/__tests__/auth.test.ts` | Modifié (teamId dans JWT) |

---

## Notes

- Double barrière RBAC : guards Express (`requireRole`) + filtrage Prisma automatique (RLS extension)
- Audit applicatif (userId, ip, userAgent) complété par triggers PostgreSQL pour les accès SQL directs
- Les tokens existants sans `teamId` continueront de fonctionner (`teamId: null` implicite après re-login)
