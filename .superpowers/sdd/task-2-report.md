# Task 2 Report — Module BE-0 : Setup et infrastructure

**Date:** 2026-07-21  
**Branch:** `feat/backlog-implementation`  
**Commit:** `e40e996` — `chore: valider socle technique Sprint 1`  
**Status:** ✅ Done

---

## Checklist

| Step | Item                                | Status                                      |
| ---- | ----------------------------------- | ------------------------------------------- |
| 1    | Monorepo npm workspaces validé      | ✅ `backend`, `admin`, `pwa`                |
| 1    | ESLint + Prettier partagés (racine) | ✅ `eslint.config.js`, `.prettierrc`        |
| 1    | tsconfig strict                     | ✅ `strict: true` dans backend, admin, pwa  |
| 2    | API Express + Prisma + PostgreSQL   | ✅ existant, inchangé                       |
| 2    | `GET /health` avec check DB         | ✅ monté directement (plus de redirect 307) |
| 2    | `GET /api/v1/health`                | ✅ via `apiRouter`                          |
| 3    | Docker Compose dev documenté        | ✅ mode hybride (infra Docker, apps npm)    |
| 3    | README startup complet              | ✅ cp .env → docker → db:setup → dev        |
| 4    | `.env.example` variables backend    | ✅ DATABASE_URL, REDIS, MINIO, JWT          |
| 4    | Commit demandé                      | ✅ `e40e996`                                |

---

## Changements principaux

### ESLint + Prettier (racine)

- `eslint.config.js` — flat config ESLint 9 + typescript-eslint, overrides backend (Node) et admin/pwa (React hooks/refresh)
- `.prettierrc`, `.prettierignore`
- Dépendances dev à la racine : `eslint`, `typescript-eslint`, `eslint-config-prettier`, `prettier`, plugins React
- Scripts racine : `format`, `format:check`
- `"type": "module"` ajouté au `package.json` racine

### Health endpoint

- `backend/src/app.ts` : `healthRouter` monté à `/health` (réponse JSON directe, check Prisma `SELECT 1`)
- Redirect 307 supprimé — compatible avec `HEALTHCHECK` du Dockerfile (`/health`)
- Test étendu : `/health` + `/api/v1/health`

### Docker / README

- `docker-compose.yml` : commentaire expliquant le dev hybride (pas de conteneur `api` — hot-reload tsx)
- `README.md` : prérequis, tableau ports, étapes numérotées, section qualité de code, curl health

### `.env.example`

- Sections commentées : PostgreSQL, Redis, MinIO, JWT, server/CORS

---

## Tests & lint

```
npm run lint -w backend   → PASS (0 errors)
npm run lint -w admin     → PASS
npm run lint -w pwa       → PASS
npm run lint              → PASS (3 workspaces)

npm run test -w backend   → PASS
  ✓ GET /health responds with status ok or degraded
  ✓ GET /api/v1/health responds with status ok or degraded
  (2 tests, 1 file)
```

> Note : sans Postgres local (port 5433), les tests health retournent 503 `degraded` — comportement attendu et accepté par les assertions.

---

## Fichiers modifiés (commit)

- `.env.example`
- `.prettierignore`, `.prettierrc`
- `README.md`
- `docker-compose.yml`
- `eslint.config.js`
- `package.json`, `package-lock.json`
- `backend/src/app.ts`
- `backend/src/__tests__/health.test.ts`
- `backend/src/middleware/error-handler.ts`

---

## Décisions

1. **Dev hybride** plutôt qu'un service `api` dans docker-compose — préserve le hot-reload tsx/vite, aligné avec le Dockerfile prod existant pour CI/CD.
2. **ESLint à la racine** — les 3 workspaces réutilisent la même config ; pas de duplication par workspace.

---

## Review fixes (2026-07-21)

**Commit:** `e018f9c` — `chore: Task 2 fixes — api service, format, health tests`  
**Status:** ✅ Done

### Corrections appliquées

| Finding                                  | Fix                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Pas de service `api` dans docker-compose | Service `api` ajouté (build `backend/Dockerfile`, target `runtime`), `depends_on postgres: service_healthy` |
| README incomplet sur les modes           | Section « Stack complète » vs « Dev hybride » avec tableau comparatif et commandes                          |
| Prérequis Node 22+ uniquement            | Node.js 20+ (LTS recommandé ; 22+ supporté)                                                                 |
| Tests health sans assertion `db`         | `expect(res.body.db).toMatch(/up\|down/)` sur `/health` et `/api/v1/health`                                 |
| `format:check` en échec                  | `npm run format` exécuté sur tout le monorepo                                                               |

### Tests & lint (post-fix)

```
npm run lint              → PASS (backend, admin, pwa)
npm run format:check      → PASS
npm run test -w backend   → PASS
  ✓ GET /health responds with status ok or degraded (+ db up|down)
  ✓ GET /api/v1/health responds with status ok or degraded (+ db up|down)
  (2 tests, 1 file)
```

### Fichiers modifiés (review fix)

- `docker-compose.yml` — service `api`
- `README.md` — modes stack complète / hybride, Node 20+
- `backend/src/__tests__/health.test.ts` — assertion `db`, timeout 10s
- Fichiers formatés Prettier (backend routes/middleware, admin, pwa, docs, infra)
