### Task 9: Module FE-ADMIN-0 — Setup Admin

**Use Cases:** `UC-FE-ADM-SETUP`, `UC-FE-ADM-AUTH`  
**Estimation:** 2.00 j-h (UI 1.50 · BE 0.50)

**Files:**

- Existant partiel : `admin/src/App.tsx`, `admin/src/pages/Login.tsx`, `admin/src/hooks/useAuth.ts`
- Créer : `admin/src/components/layout/AppLayout.tsx`
- Créer : `admin/src/components/layout/Sidebar.tsx`
- Modifier : `admin/src/lib/api.ts` (intercepteur refresh)

- [ ] **Step 1:** Valider Vite + React + Tailwind + shadcn/ui (Button, Input, Table, Dialog, Toast)
- [ ] **Step 2:** Router + guards vues par rôle
- [ ] **Step 3:** Layout sidebar rétractable + header
- [ ] **Step 4:** Login form + intercepteur axios refresh token
