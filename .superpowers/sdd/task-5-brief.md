### Task 5: Module BE-RBAC — RBAC et audit

**Use Cases:** `UC-BE-RBAC` (×2), `UC-BE-AUDIT`  
**Estimation:** 1.50 j-h (BE)

**Files:**
- Modifier : `backend/src/middleware/rbac.ts`
- Créer : `backend/src/middleware/prisma-rls.ts`
- Créer : `backend/src/middleware/audit.interceptor.ts`
- Créer : `backend/prisma/migrations/*_audit_triggers.sql`

- [ ] **Step 1:** Guard rôles paramétrable (403 typé)
- [ ] **Step 2:** Middleware Prisma filtrage siteId (CDS) / teamId (CDE)
- [ ] **Step 3:** Audit log append-only (interceptor + triggers PostgreSQL sur Worker, Pointage, Payment)
- [ ] **Step 4:** Tests RBAC par rôle
