### Task 8: Module BE-PAY — Paiements

**Use Cases:** `UC-BE-PAY-GEN`, `UC-BE-PAY-EXP`, `UC-BE-PAY-IMP`  
**Estimation:** 1.75 j-h (BE)

**Files:**

- Créer : `backend/src/routes/payments.routes.ts`
- Créer : `backend/src/services/payments/generate.service.ts`
- Créer : `backend/src/services/payments/mvola-export.service.ts`
- Créer : `backend/src/services/payments/mvola-import.service.ts`

- [ ] **Step 1:** `POST /payments/generate` — agrégation VALIDATED, `quantity * unitRateSnapshot`, statut PENDING
- [ ] **Step 2:** `GET /payments/:period/export` — xlsx 5 colonnes MVola, statut EXPORTED
- [ ] **Step 3:** `POST /payments/import-status` — parse retour, match numéro+montant, PAID/FAILED
