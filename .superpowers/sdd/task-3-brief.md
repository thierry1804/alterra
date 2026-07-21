### Task 3: Module BE-DB — Modèle de données

**Use Cases:** `UC-BE-SCHEMA`, `UC-BE-MIGR`  
**Estimation:** 1.50 j-h (BE)

**Files:**
- Modifier : `backend/prisma/schema.prisma`
- Modifier : `backend/prisma/seed.ts`
- Créer : migrations Prisma versionnées

**Modèles V1 requis:** User, Site, Activity, Worker, Team, Pointage, Payment, BiometricCheck, AuditLog, RefreshToken, PasswordReset + enums

- [ ] **Step 1:** Compléter schéma Prisma V1 (13 modèles)
- [ ] **Step 2:** Générer migrations `prisma migrate dev`
- [ ] **Step 3:** Seed déterministe : 1 admin, 5 CDS, 15 CDE, 5 sites, 10 activités, 50 MOC test
- [ ] **Step 4:** Vérifier `npm run db:setup -w backend`
