### Task 7: Module BE-PNT — Pointages

**Use Cases:** `UC-BE-PNT-SYNC`, `UC-BE-PNT-LIST`, `UC-BE-PNT-VAL`, `UC-BE-PNT-COR`  
**Estimation:** 2.25 j-h (BE)

**Files:**
- Existant partiel : `backend/src/routes/pointages.routes.ts`
- Créer : `backend/src/services/pointages/sync.service.ts`
- Créer : `backend/src/services/pointages/validation.service.ts`

- [ ] **Step 1:** `POST /pointages/sync` — batch ≤100, upsert `clientUuid`, retour par ligne
- [ ] **Step 2:** `GET /pointages` — cursor pagination 50, filtres, sous-requête bio
- [ ] **Step 3:** `PATCH /pointages/:id/validate|reject` — bio OK requis, motif obligatoire au rejet
- [ ] **Step 4:** `PATCH /pointages/:id` — correction Admin avec motif + audit
