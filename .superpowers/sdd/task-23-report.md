# Task 23 — QA V1

**Module:** QA — Assurance qualité V1  
**Branch:** feat/backlog-implementation  
**Date:** 2026-07-21

## Livrables

| Step | Statut | Détail |
|------|--------|--------|
| 1 — E2E Playwright | ✅ | `e2e/` workspace, 4 specs (admin MVola, CDE pointage, CDS validation, offline simulé) |
| 2 — Offline terrain | ✅ | Spec `offline-day.spec.ts` + procédure `docs/qa/offline-pilot.md` |
| 3 — Recette V1 2 jours | ✅ | Checklist `docs/qa/recette-v1.md` |
| 4 — Corrections J+1 à J+5 | 📋 | Process documenté dans recette (grille P1–P3), exécution post-recette |

## Structure E2E

```
e2e/
├── playwright.config.ts   # webServers backend + admin + pwa
├── helpers/auth.ts        # loginAdmin, loginPwa (+ PIN setup)
├── helpers/env.ts         # comptes seed
└── tests/
    ├── admin-mvola.spec.ts
    ├── cde-pointage.spec.ts
    ├── cds-validation.spec.ts
    └── offline-day.spec.ts
```

## Exécution locale

```bash
npm install
npm run db:setup -w backend    # Postgres requis
npx playwright install chromium -w e2e
npm run test:e2e
```

Variables optionnelles : `E2E_ADMIN_EMAIL`, `E2E_CDE_EMAIL`, `E2E_CDS_EMAIL`, `E2E_USER_PASSWORD`, `E2E_PIN`, `PLAYWRIGHT_SKIP_WEBSERVER=1`.

## Comptes seed

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@alterra.mg | ChangeMe123! |
| CDE | cde.mnk1@alterra.test | test123! |
| CDS | cds.mnk@alterra.test | test123! |
| PIN PWA | — | 1234 |

## CI

Job `e2e` ajouté dans `.github/workflows/ci.yml` (Postgres + migrate + seed + Playwright).

## Notes

- Les steps 3–4 de la recette terrain et corrections post-MEP sont des activités humaines planifiées ; la doc et l’automatisation préparent leur exécution.
- `offline-day.spec.ts` simule le mode avion via Playwright (`context.setOffline`), pas un test device réel.

## Correctifs découverts pendant la QA

| Fichier | Problème | Correction |
|---------|----------|------------|
| `backend/src/middleware/prisma-rls.ts` | RLS bloquait `findUnique` User sans contexte auth | Lecture sans filtre si `!ctx?.role` |
| `backend/src/routes/auth.routes.ts` | `lastLoginAt` bloqué par RLS | `basePrisma` pour login |
| `backend/src/app.ts` | Rate limit auth (10/5min) casse les E2E | Limite 1000 hors production |
| `pwa/src/pages/BatchEntry.tsx` | `enqueuePointageSync` dans transaction Dexie partielle | Enqueue après commit transaction |
| `e2e/playwright.config.ts` | webServers lancés depuis `e2e/` | `cwd: repoRoot` |

**Résultat local :** 4/4 tests Playwright passés (`npm run test:e2e`).
