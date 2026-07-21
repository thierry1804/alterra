### Task 6: Module BE-REF — Référentiels

**Use Cases:** `UC-BE-SITES`, `UC-BE-ACT`, `UC-BE-WORKERS`, `UC-BE-IMPORT`, `UC-BE-USERS`  
**Estimation:** 3.50 j-h (BE)

**Files:**
- Existant partiel : `backend/src/routes/sites.routes.ts`, `workers.routes.ts`
- Créer : `backend/src/routes/activities.routes.ts`
- Créer : `backend/src/routes/users.routes.ts`
- Créer : `backend/src/services/import/workers-import.service.ts`
- Créer : `backend/src/services/storage/presigned-url.service.ts`

- [ ] **Step 1:** CRUD `/sites` (5 endpoints, validation Zod, audit)
- [ ] **Step 2:** CRUD `/activities` avec versioning tarif (RG-04 : fermeture ancien + création nouveau)
- [ ] **Step 3:** CRUD `/workers` (filtres, full-text, upload photo URL pré-signée MinIO)
- [ ] **Step 4:** `POST /workers/import` (exceljs, preview erreurs, insertion transactionnelle)
- [ ] **Step 5:** CRUD `/users` (reset MDP forcé, désactivation + blacklist Redis)
