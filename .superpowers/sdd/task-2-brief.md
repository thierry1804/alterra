### Task 2: Module BE-0 — Setup et infrastructure

**Use Cases:** `UC-BE-SETUP` (×3)  
**Estimation:** 1.50 j-h (BE)

**Files:**

- Existant : `package.json`, `docker-compose.yml`, `.env.example`
- Modifier : `backend/src/index.ts`, `backend/src/app.ts`
- Vérifier : `backend/src/routes/health.routes.ts`

- [ ] **Step 1:** Valider monorepo workspaces (npm), ESLint/Prettier, tsconfig strict
- [ ] **Step 2:** Confirmer API Express + Prisma + connexion PostgreSQL + `/health`
- [ ] **Step 3:** Docker Compose dev (api + postgres + redis + minio) documenté dans README
- [ ] **Step 4:** Commit : `chore: valider socle technique Sprint 1`
