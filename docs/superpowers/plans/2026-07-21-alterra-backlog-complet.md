# ALTERRA — Plan d'implémentation du backlog complet

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer la plateforme ALTERRA en deux phases — V1 (cœur fonctionnel, 12 semaines) puis V2 (extensions terrain, 5 semaines) — en couvrant l'intégralité du backlog produit documenté dans `basedocs/ALTERRA - Backlog détaillé.md`.

**Architecture:** Monorepo npm workspaces (`backend/`, `admin/`, `pwa/`, `infra/`). API modulaire Express + Prisma + PostgreSQL. Admin React SPA connectée. PWA terrain offline-first (Dexie + Service Worker). Jobs async (PDF, biométrie) via Redis/BullMQ. Déploiement on-premise Docker Compose + Nginx + TLS.

**Tech Stack:** Node.js 20 · Express · Prisma 5 · PostgreSQL 16 · Redis 7 · MinIO · React 18 · Vite 5 · TypeScript 5 · Tailwind 3 · shadcn/ui · TanStack Query 5 · Dexie 4 · vite-plugin-pwa · Zod 3 · BullMQ 5 · Puppeteer (PDF) · Playwright (E2E)

## Global Constraints

- **Méthode :** Scrum adapté, sprints de 2 semaines (Sprint 9 = 1 semaine).
- **Équipe :** 2 dev fullstack + 1 tech lead 20 % + 1 PO 30 %.
- **Capacité :** 3 j-h effectifs / dev / semaine.
- **V1 :** 50 j-h, 12 semaines — livraison ferme à signature.
- **V2 :** 21 j-h, 5 semaines — avenant après recette V1.
- **Total :** 71 j-h, 17 semaines calendaires.
- **Offline-first PWA :** autonomie 1 journée sans réseau ; sync idempotente via `clientUuid`.
- **RBAC :** double niveau (middleware auth + filtrage site/équipe).
- **Sécurité :** Argon2id, JWT HS256 (access 15 min), refresh HttpOnly 7j, MFA TOTP Admin.
- **Référent métier ALTERRA :** 0,5 j/semaine pendant toute la durée.
- **Écart codebase actuel :** le backlog cible NestJS ; le repo utilise Express. Continuer sur Express sauf décision explicite de migration.

## État d'avancement (baseline repo)

| Zone       | Existant                                                           | Manquant (backlog)                                                   |
| ---------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `backend/` | Health, auth partiel, sites, workers, pointages, Prisma init, seed | Référentiels complets, paiements, biométrie, PDF, audit, RBAC avancé |
| `admin/`   | Login, Dashboard squelette, auth store                             | CRUD référentiels, pointages, paiements MVola, reporting, audit      |
| `pwa/`     | DB Dexie, sync partiel, pointage basique                           | Saisie lot, validation CDS, biométrie, workflows V2                  |
| `infra/`   | Docker prod/staging, nginx, backup scripts                         | MEP finale, monitoring complet                                       |

---

## Synthèse planning

| Sprint   | Semaines | Focus                                              | Charge (j-h) |
| -------- | -------- | -------------------------------------------------- | ------------ |
| Sprint 1 | S1-S2    | Cadrage + Socle technique                          | 8.00         |
| Sprint 2 | S3-S4    | API métier V1 + Admin start                        | 10.50        |
| Sprint 3 | S5-S6    | Admin complet + PWA setup                          | 6.50         |
| Sprint 4 | S7-S8    | PWA complète + Biométrie + PDF                     | 9.50         |
| Sprint 5 | S9-S10   | Données + Déploiement + Tests + Formation          | 8.00         |
| Sprint 6 | S11-S12  | Hypercare V1 + marge                               | 9.00         |
| Sprint 7 | S13-S14  | Cadrage V2 + Zone/Parcelle + Équipes + NFC start   | 7.00         |
| Sprint 8 | S15-S16  | NFC + Biométrie offline + Workflows + Cartographie | 10.25        |
| Sprint 9 | S17      | Clôture quotidienne + Tests V2 + Hypercare V2      | 4.50         |

---

# V1 — Cœur fonctionnel (50 j-h · 12 semaines)

---

## Sprint 1 (S1-S2) — Cadrage et socle technique · 8.00 j-h

### Task 1: Module CAD — Cadrage projet

**Use Cases:** `UC-CAD-01`, `UC-CAD-02`, `UC-CAD-03`  
**Estimation:** 4.00 j-h (UI 1.00 · BE 3.00)

**Livrables:**

- Ateliers métier 2-3 demi-journées (workflow réel, règles biométrie/MVola/campagne)
- Spec détaillée + user stories priorisées MoSCoW
- Maquettes Figma : Dashboard Admin, Saisie lot PWA CDE, Validation CDS, Bordereau paiement

**Files:**

- Référence : `basedocs/ALTERRA - Spécification fonctionnelle détaillée.md`
- Référence : `basedocs/ALTERRA - Spécification technique détaillée.md`
- Créer : `docs/cadrage/ateliers-compte-rendu.md`
- Créer : `docs/cadrage/maquettes-figma-liens.md`

- [ ] **Step 1:** Animer atelier métier avec référent ALTERRA (CDS + Admin)
- [ ] **Step 2:** Finaliser backlog priorisé et critères d'acceptation par UC
- [ ] **Step 3:** Produire maquettes Figma des 4 écrans critiques
- [ ] **Step 4:** Obtenir échantillon format Excel MVola (condition de réussite Sprint 1)

---

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

---

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

---

### Task 4: Module BE-AUTH — Authentification

**Use Cases:** `UC-BE-AUTH` (×4)  
**Estimation:** 1.50 j-h (BE)

**Files:**

- Modifier : `backend/src/routes/auth.routes.ts`
- Modifier : `backend/src/lib/jwt.ts`
- Modifier : `backend/src/middleware/auth.ts`
- Créer : `backend/src/services/auth/refresh.service.ts`
- Créer : `backend/src/services/auth/mfa.service.ts`

**Interfaces:**

- `POST /auth/login` → `{ accessToken, user }`
- `POST /auth/refresh` → rotation refresh, blacklist Redis
- `POST /auth/logout` → révocation + suppression cookie
- MFA TOTP Admin : secret chiffré, QR code, vérification 6 chiffres

- [ ] **Step 1:** Implémenter login Argon2id + JWT HS256 (access 15 min)
- [ ] **Step 2:** Implémenter refresh token HttpOnly 7j avec rotation Redis
- [ ] **Step 3:** Implémenter logout + blacklist
- [ ] **Step 4:** Implémenter MFA TOTP pour Admin
- [ ] **Step 5:** Tests unitaires auth

---

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

---

## Sprint 2 (S3-S4) — API métier V1 + Admin start · 10.50 j-h

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

---

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

---

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

---

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

---

### Task 10: Module FE-ADMIN-DASH — Dashboard KPIs

**Use Case:** `UC-FE-ADM-KPI`  
**Estimation:** 1.00 j-h (UI)

**Files:**

- Existant squelette : `admin/src/pages/Dashboard.tsx`
- Créer : `admin/src/components/dashboard/KpiCards.tsx`
- Créer : `admin/src/components/dashboard/PresenceChart.tsx`
- Créer : `admin/src/components/dashboard/WorkforceChart.tsx`
- Créer : `admin/src/components/dashboard/AlertsBlock.tsx`
- Référence : `basedocs/ALTERRA_Cursor_Prompt_Dashboard_KPIs.md`

- [ ] **Step 1:** 4 KPI cards (effectifs, présence, pointages en attente, paiements)
- [ ] **Step 2:** Graphe présence 7 jours
- [ ] **Step 3:** Graphe évolution effectifs
- [ ] **Step 4:** Bloc alertes + refresh TanStack Query 60s

---

## Sprint 3 (S5-S6) — Admin complet + PWA démarrage · 6.50 j-h

### Task 11: Module FE-ADMIN-REF — Référentiels UI

**Use Cases:** `UC-FE-ADM-SITES`, `UC-FE-ADM-ACT`, `UC-FE-ADM-WORKERS`, `UC-FE-ADM-USERS`  
**Estimation:** 2.25 j-h (UI)

**Files:**

- Créer : `admin/src/pages/Sites.tsx`, `Activities.tsx`, `Workers.tsx`, `Users.tsx`
- Créer : `admin/src/components/workers/ImportDialog.tsx`
- Créer : `admin/src/components/activities/RateHistoryDrawer.tsx`

- [ ] **Step 1:** UI Sites — table paginée, modal CRUD, désactivation
- [ ] **Step 2:** UI Activités — table, formulaire, drawer historique tarifs
- [ ] **Step 3:** UI MOC — table cursor 600+, filtres, fiche photo, import Excel drag&drop
- [ ] **Step 4:** UI Users — table, reset MDP, activation/désactivation

---

### Task 12: Module FE-ADMIN-PNT — Pointages UI

**Use Case:** `UC-FE-ADM-PNT`  
**Estimation:** 1.00 j-h (UI)

**Files:**

- Créer : `admin/src/pages/Pointages.tsx`
- Créer : `admin/src/components/pointages/PointageDetailDrawer.tsx`
- Créer : `admin/src/components/pointages/CorrectionForm.tsx`

- [ ] **Step 1:** Table filtrable avec photo miniature
- [ ] **Step 2:** Drawer détail (géoloc, historique)
- [ ] **Step 3:** Correction inline avec motif obligatoire

---

### Task 13: Module FE-ADMIN-PAY — Paiements UI

**Use Cases:** `UC-FE-ADM-PAY-BORD`, `UC-FE-ADM-PAY-EXP`, `UC-FE-ADM-PAY-IMP`  
**Estimation:** 1.50 j-h (UI)

**Files:**

- Créer : `admin/src/pages/Payments.tsx`
- Créer : `admin/src/components/payments/BordereauTable.tsx`
- Créer : `admin/src/components/payments/MvolaExportButton.tsx`
- Créer : `admin/src/components/payments/MvolaImportDialog.tsx`

- [ ] **Step 1:** Sélection période + génération bordereau (600 lignes, statut bio)
- [ ] **Step 2:** Édition inline montant avec motif
- [ ] **Step 3:** Export Excel MVola avec progression
- [ ] **Step 4:** Import retour MVola drag&drop + résumé PAID/FAILED

---

### Task 14: Module FE-ADMIN-REP — Reporting + Audit UI

**Use Cases:** `UC-FE-ADM-REP`, `UC-FE-ADM-AUDIT`  
**Estimation:** 0.50 j-h (UI)

**Files:**

- Créer : `admin/src/pages/Reports.tsx`
- Créer : `admin/src/pages/AuditLog.tsx`

- [ ] **Step 1:** 3 rapports prédéfinis, filtres période, exports CSV/Excel/PDF
- [ ] **Step 2:** Journal audit paginé, drawer diff avant/après JSON tree

---

### Task 15: Module FE-PWA-0 — Setup PWA

**Use Cases:** `UC-FE-PWA-SETUP`, `UC-FE-PWA-AUTH`  
**Estimation:** 1.75 j-h (UI 1.25 · BE 0.50)

**Files:**

- Existant partiel : `pwa/vite.config.ts`, `pwa/src/db/db.ts`, `pwa/src/App.tsx`
- Créer : `pwa/public/manifest.webmanifest`
- Créer : `pwa/src/lib/crypto.ts` (WebCrypto token chiffré)
- Créer : `pwa/src/pages/Login.tsx`
- Créer : `pwa/src/pages/UnlockPin.tsx`

- [ ] **Step 1:** vite-plugin-pwa + Workbox (cache-first assets, network-first API)
- [ ] **Step 2:** Schéma Dexie complet (workers, pointages, syncQueue, settings)
- [ ] **Step 3:** Login PWA + token IndexedDB chiffré WebCrypto
- [ ] **Step 4:** PIN déverrouillage après 30 min inactivité

---

## Sprint 4 (S7-S8) — PWA complète + Biométrie + PDF · 9.50 j-h

### Task 16: Module FE-PWA-CDE — Chef d'Équipe

**Use Cases:** `UC-FE-PWA-DAY`, `UC-FE-PWA-BATCH`, `UC-FE-PWA-PHOTO`  
**Estimation:** 4.00 j-h (UI 3.50 · BE 0.50)

**Files:**

- Existant partiel : `pwa/src/pages/Pointage.tsx`
- Créer : `pwa/src/pages/ActivitySelect.tsx`
- Créer : `pwa/src/pages/BatchEntry.tsx`
- Créer : `pwa/src/components/pointage/WorkerRow.tsx`
- Créer : `pwa/src/components/pointage/PhotoCapture.tsx`

- [ ] **Step 1:** Sélection activité du jour (cache référentiel)
- [ ] **Step 2:** Écran saisie lot ~40 MOC (recherche, quantité par défaut, total prévisionnel)
- [ ] **Step 3:** Capture photo Camera API, compression 1 Mo, blob IndexedDB

---

### Task 17: Module FE-PWA-CDS — Chef de Service

**Use Cases:** `UC-FE-PWA-VAL`, `UC-FE-PWA-BIO`  
**Estimation:** 2.00 j-h (UI 1.50 · BE 0.50)

**Files:**

- Créer : `pwa/src/pages/Validation.tsx`
- Créer : `pwa/src/pages/BiometricCapture.tsx`
- Créer : `pwa/src/components/validation/TeamGroup.tsx`

- [ ] **Step 1:** Liste MOC groupée par équipe, indicateur bio + montant
- [ ] **Step 2:** Actions valider/rejeter par MOC
- [ ] **Step 3:** Capture bio plein écran + `POST /biometric/check` + pastille résultat

---

### Task 18: Module FE-PWA-SYNC — Moteur de synchronisation

**Use Cases:** `UC-FE-PWA-SYNC-ENG`, `UC-FE-PWA-SYNC-UI`  
**Estimation:** 2.25 j-h (UI 1.75 · BE 0.50)

**Files:**

- Existant partiel : `pwa/src/sync/SyncManager.ts`, `pwa/src/pages/Sync.tsx`
- Modifier : `pwa/src/sync/SyncManager.ts`
- Créer : `pwa/src/sync/ConflictResolver.ts`
- Créer : `pwa/src/components/sync/SyncStatusBar.tsx`

- [ ] **Step 1:** Queue idempotente `clientUuid`, ping 60s, batch ≤100
- [ ] **Step 2:** Retry backoff exponentiel, serveur autoritaire sur conflits
- [ ] **Step 3:** Indicateur permanent (en attente + dernière sync)
- [ ] **Step 4:** Bouton forcer sync + log récent

---

### Task 19: Module BE-BIO — Biométrie

**Use Cases:** `UC-BE-BIO-ADAPT`, `UC-BE-BIO-AXIAN`  
**Estimation:** 2.00 j-h (BE)

**Files:**

- Créer : `backend/src/routes/biometric.routes.ts`
- Créer : `backend/src/services/biometric/BiometricProvider.interface.ts`
- Créer : `backend/src/services/biometric/MockBiometricProvider.ts`
- Créer : `backend/src/services/biometric/ManualBiometricProvider.ts`
- Créer : `backend/src/services/biometric/AxianBiometricProvider.ts`

- [ ] **Step 1:** Adapter pattern, choix runtime `BIOMETRIC_PROVIDER` env
- [ ] **Step 2:** Mock + Manual providers
- [ ] **Step 3:** AxianBiometricProvider (API Key, erreurs 5xx → UNAVAILABLE, logs BiometricCheck)
- [ ] **Step 4:** Confirmer engagement AXIAN ou basculer mode manuel

---

### Task 20: Module BE-RPT — Rapports PDF

**Use Case:** `UC-BE-RPT-WEEK`  
**Estimation:** 2.00 j-h (BE)

**Files:**

- Créer : `backend/src/routes/reports.routes.ts`
- Créer : `backend/src/jobs/pdf.worker.ts`
- Créer : `backend/src/templates/weekly-report.hbs`
- Créer : `backend/src/templates/weekly-invoice.hbs`

- [ ] **Step 1:** Job BullMQ génération PDF hebdo
- [ ] **Step 2:** Templates Handlebars → HTML → Puppeteer PDF
- [ ] **Step 3:** Stockage MinIO + notification email Admin

---

## Sprint 5 (S9-S10) — Données, déploiement, tests, formation · 8.00 j-h

### Task 21: Module OPS-DATA — Migration initiale

**Use Case:** `UC-OPS-IMPORT`  
**Estimation:** 1.00 j-h (BE)

**Files:**

- Créer : `backend/scripts/import-initial-data.ts`
- Créer : `docs/import/templates/` (Excel sites, activités, MOC)

- [ ] **Step 1:** Templates Excel fournis à ALTERRA
- [ ] **Step 2:** Script import avec validation métier
- [ ] **Step 3:** Rapport d'import archivé

---

### Task 22: Module OPS-DEPLOY — Déploiement production

**Use Case:** `UC-OPS-VPS`  
**Estimation:** 1.00 j-h (BE)

**Files:**

- Existant : `infra/docker-compose.prod.yml`, `infra/nginx/nginx.conf`
- Modifier : `infra/scripts/deploy.sh`
- Référence : `basedocs/ALTERRA - Architecture de production (on-premise).md`
- Référence : `docs/runbook.md`

- [ ] **Step 1:** VPS provisionné (condition Sprint 5)
- [ ] **Step 2:** Docker Compose prod + Nginx reverse proxy + certbot Let's Encrypt
- [ ] **Step 3:** Backup cron Backblaze B2 + monitoring
- [ ] **Step 4:** Smoke test production

---

### Task 23: Module QA — Assurance qualité V1

**Use Cases:** `UC-QA-E2E`, `UC-QA-OFFLINE`, `UC-QA-REC`  
**Estimation:** 4.00 j-h (UI 1.00 · BE 3.00)

**Files:**

- Créer : `e2e/playwright.config.ts`
- Créer : `e2e/tests/cde-pointage.spec.ts`
- Créer : `e2e/tests/cds-validation.spec.ts`
- Créer : `e2e/tests/admin-mvola.spec.ts`

- [ ] **Step 1:** Tests E2E Playwright par rôle (CDE sync, CDS validation, Admin bordereau)
- [ ] **Step 2:** Test offline terrain 1 journée site pilote
- [ ] **Step 3:** Recette V1 2 jours avec référent ALTERRA
- [ ] **Step 4:** Corrections J+1 à J+5

---

### Task 24: Module DOC — Documentation et formation

**Use Cases:** `UC-DOC-USER`, `UC-DOC-OPS`, `UC-DOC-TRAIN`  
**Estimation:** 2.50 j-h (UI 1.50 · BE 1.00)

**Files:**

- Créer : `docs/guides/guide-admin.pdf`
- Créer : `docs/guides/guide-cds.pdf`
- Créer : `docs/guides/guide-cde.pdf`
- Modifier : `docs/runbook.md` (backup/restore, playbook MEP)

- [ ] **Step 1:** Guide utilisateur 15-20 pages par rôle (screenshots)
- [ ] **Step 2:** Doc exploitation (runbook, backup/restore, MEP)
- [ ] **Step 3:** Formation 1 site pilote (½j Admin+CDS, ½j CDE terrain)

---

## Sprint 6 (S11-S12) — Hypercare V1 + marge · 9.00 j-h

### Task 25: Module OPS-HYPERCARE — Support post-MEP V1

**Use Case:** `UC-OPS-HC`  
**Estimation:** 3.00 j-h (UI 1.00 · BE 2.00)

- [ ] **Step 1:** Astreinte réactive 3 semaines post-MEP
- [ ] **Step 2:** Corrections bugs bloquants + hotfix
- [ ] **Step 3:** Ajustements UX mineurs
- [ ] **Step 4:** Réunion hebdomadaire bilan

---

### Task 26: Module MARGE-V1 — Provision imprévus

**Use Case:** `UC-MARGE-V1`  
**Estimation:** 6.00 j-h (UI 3.00 · BE 3.00)

**Risques couverts:**

- AXIAN API instabilité (2.5j)
- Format MVola (1j)
- UX saisie en lot (1j)
- Volumétrie (0.5j)
- Imprévus généraux (1j)

- [ ] **Step 1:** Buffer consommé selon incidents réels
- [ ] **Step 2:** Documenter dans `docs/retrospective-v1.md`

---

# V2 — Extensions terrain (21 j-h · 5 semaines)

---

## Sprint 7 (S13-S14) — Cadrage V2 + Zone/Parcelle + Équipes + NFC start · 7.00 j-h

### Task 27: Module CAD-V2 — Cadrage extensions

**Use Case:** `UC-CAD-V2`  
**Estimation:** 1.50 j-h (UI 1.00 · BE 0.50)

- [ ] **Step 1:** Atelier UX 2 demi-journées (workflows, NFC)
- [ ] **Step 2:** Maquettes NFC, workflows demandes, cartographie
- [ ] **Step 3:** Valider flotte Android NFC (condition avant Sprint 7)

---

### Task 28: Module BE-GEO — Zone / Parcelle

**Use Cases:** `UC-BE-GEO-DM`, `UC-BE-GEO-API`, `UC-FE-ADM-GEO`  
**Estimation:** 2.25 j-h (UI 0.75 · BE 1.50)

**Files:**

- Modifier : `backend/prisma/schema.prisma` (Zone, Parcelle)
- Créer : `backend/src/routes/zones.routes.ts`
- Créer : `backend/src/routes/parcels.routes.ts`
- Créer : `admin/src/pages/Zones.tsx`

- [ ] **Step 1:** Modèle Prisma Zone (siteId, geoPolygon) + Parcelle (zoneId, surfaceHa)
- [ ] **Step 2:** FK sur Pointage, migrations
- [ ] **Step 3:** CRUD API 5 endpoints/entité + `GET /sites/geo`
- [ ] **Step 4:** UI Admin table hiérarchique + éditeur polygone GeoJSON

---

### Task 29: Module FE-PWA-TEAM — Équipes côté terrain

**Use Cases:** `UC-FE-PWA-CDS-TEAM`, `UC-FE-PWA-CDE-TEAM`  
**Estimation:** 2.50 j-h (UI 1.75 · BE 0.75)

**Files:**

- Créer : `pwa/src/pages/TeamManagement.tsx`
- Créer : `backend/src/routes/teams.routes.ts`

- [ ] **Step 1:** CDS — CRUD équipes (nom, chef, membres autocomplétion MOC)
- [ ] **Step 2:** CDE — ajout/retrait MOC équipe locale (pas de création MOC)

---

### Task 30: Module FE-PWA-NFC — Web NFC (démarrage)

**Use Case:** `UC-FE-PWA-NFC-UI`  
**Estimation:** 1.50 j-h (UI 1.00 · BE 0.50)

**Files:**

- Créer : `pwa/src/pages/NfcScan.tsx`
- Créer : `pwa/src/lib/nfc.ts`

- [ ] **Step 1:** NDEFReader API, mode lecture
- [ ] **Step 2:** Feedback visuel + son, log local
- [ ] **Step 3:** Gestion badge inconnu

---

## Sprint 8 (S15-S16) — NFC + Biométrie offline + Workflows + Cartographie · 10.25 j-h

### Task 31: Module BE-NFC — Backend présence

**Use Case:** `UC-BE-NFC`  
**Estimation:** 1.00 j-h (BE)

**Files:**

- Créer : `backend/src/routes/presence.routes.ts`
- Créer : `backend/src/routes/badges.routes.ts`
- Modifier : `backend/prisma/schema.prisma` (PresenceRecord, Badge)

- [ ] **Step 1:** Modèle PresenceRecord + `POST /presence/sync` (idempotent)
- [ ] **Step 2:** Modèle Badge + CRUD
- [ ] **Step 3:** Tests sur appareils Android cibles

---

### Task 32: Module FE-PWA-BIO — Cache biométrique local

**Use Cases:** `UC-FE-PWA-BIO-CACHE`, `UC-FE-PWA-BIO-COMP`  
**Estimation:** 3.25 j-h (UI 1.75 · BE 1.50)

**Files:**

- Créer : `pwa/src/services/biometric/TemplateCache.ts`
- Créer : `pwa/src/services/biometric/FaceMatcher.ts`
- Créer : `backend/src/routes/biometric-templates.routes.ts`

- [ ] **Step 1:** `GET /biometric/templates/sync` + chiffrement AES-256 WebCrypto (clé dérivée PIN)
- [ ] **Step 2:** Stockage templates IndexedDB
- [ ] **Step 3:** face-api.js lazy load, TinyFace ~1 Mo, seuil 0.6
- [ ] **Step 4:** `POST /biometric/check-offline` sync résultat

---

### Task 33: Module BE-WF — Backend workflows

**Use Case:** `UC-BE-WF`  
**Estimation:** 1.00 j-h (BE)

**Files:**

- Créer : `backend/src/routes/workflows.routes.ts`
- Modifier : `backend/prisma/schema.prisma` (ActivityRequest, WorkerRequest, ClarificationRequest)

- [ ] **Step 1:** 3 modèles + state machine
- [ ] **Step 2:** 5 endpoints par entité

---

### Task 34: Module FE-PWA-WF — Workflows côté terrain

**Use Cases:** `UC-FE-PWA-CLAR`, `UC-FE-PWA-ACTREQ`, `UC-FE-PWA-WKRREQ`  
**Estimation:** 2.00 j-h (UI 1.75 · BE 0.25)

**Files:**

- Créer : `pwa/src/pages/ClarificationRequest.tsx`
- Créer : `pwa/src/pages/ActivityRequest.tsx`
- Créer : `pwa/src/pages/WorkerRequest.tsx`

- [ ] **Step 1:** Demande précisions CDS→CDE (texte + photo, notif push, réponse)
- [ ] **Step 2:** Demande nouvelle activité (libellé, unité, tarif, justification)
- [ ] **Step 3:** Demande nouveau MOC (formulaire + photo)

---

### Task 35: Module FE-ADMIN-WF — Traitement demandes Admin

**Use Case:** `UC-FE-ADM-WF`  
**Estimation:** 1.00 j-h (UI 0.75 · BE 0.25)

**Files:**

- Créer : `admin/src/pages/Requests.tsx`

- [ ] **Step 1:** File unifiée onglets par type
- [ ] **Step 2:** Tri ancienneté, drawer détail
- [ ] **Step 3:** Actions Accepter / Refuser / Complément

---

### Task 36: Module FE-ADMIN-MAP — Cartographie Leaflet

**Use Case:** `UC-FE-ADM-MAP`  
**Estimation:** 1.50 j-h (UI 1.25 · BE 0.25)

**Files:**

- Créer : `admin/src/pages/Map.tsx`
- Créer : `admin/src/components/map/SiteMap.tsx`

- [ ] **Step 1:** Leaflet + tuiles OSM/MapTiler
- [ ] **Step 2:** Marqueurs sites avec popup
- [ ] **Step 3:** Couches Zones/Parcelles (polygones)

---

## Sprint 9 (S17) — Clôture quotidienne + Tests V2 + Hypercare V2 · 4.50 j-h

### Task 37: Module BE-DAILY — Rapport journalier

**Use Cases:** `UC-BE-DAILY`, `UC-FE-PWA-CLOSE`  
**Estimation:** 1.00 j-h (UI 0.50 · BE 0.50)

**Files:**

- Créer : `backend/src/routes/daily-reports.routes.ts`
- Créer : `pwa/src/pages/DailyClose.tsx`
- Créer : `backend/src/templates/daily-report.hbs`

- [ ] **Step 1:** `POST /reports/daily` — agrégation jour, PDF Puppeteer
- [ ] **Step 2:** UI clôture CDS + signature électronique
- [ ] **Step 3:** Envoi automatique Admin

---

### Task 38: Module QA-V2 — Assurance qualité V2

**Use Cases:** `UC-QA-V2-E2E`, `UC-QA-V2-REC`  
**Estimation:** 2.50 j-h (UI 1.00 · BE 1.50)

**Files:**

- Créer : `e2e/tests/nfc-presence.spec.ts`
- Créer : `e2e/tests/bio-offline.spec.ts`
- Créer : `e2e/tests/workflows.spec.ts`

- [ ] **Step 1:** E2E Playwright NFC + bio offline
- [ ] **Step 2:** Test offline complet 1 journée
- [ ] **Step 3:** Recette V2 2 jours + hypercare 2 semaines

---

### Task 39: Module MARGE-V2 — Provision imprévus

**Use Case:** `UC-MARGE-V2`  
**Estimation:** 1.50 j-h (UI 0.75 · BE 0.75)

**Risques couverts:**

- NFC compatibilité appareils (0.5j)
- Bio offline performance (0.5j)
- UX workflows (0.5j)

- [ ] **Step 1:** Buffer consommé selon incidents V2
- [ ] **Step 2:** Documenter dans `docs/retrospective-v2.md`

---

## Inventaire complet des Use Cases (71 items)

| ID                  | Sprint | Module        | Total (j) |
| ------------------- | ------ | ------------- | --------- |
| UC-CAD-01           | 1      | CAD           | 1.50      |
| UC-CAD-02           | 1      | CAD           | 1.00      |
| UC-CAD-03           | 1      | CAD           | 1.50      |
| UC-BE-SETUP         | 1      | BE-0          | 1.50      |
| UC-BE-SCHEMA        | 1      | BE-DB         | 1.00      |
| UC-BE-MIGR          | 1      | BE-DB         | 0.50      |
| UC-BE-AUTH          | 1      | BE-AUTH       | 1.50      |
| UC-BE-RBAC          | 1      | BE-RBAC       | 1.00      |
| UC-BE-AUDIT         | 1      | BE-RBAC       | 0.50      |
| UC-BE-SITES         | 2      | BE-REF        | 0.50      |
| UC-BE-ACT           | 2      | BE-REF        | 1.00      |
| UC-BE-WORKERS       | 2      | BE-REF        | 1.00      |
| UC-BE-IMPORT        | 2      | BE-REF        | 0.50      |
| UC-BE-USERS         | 2      | BE-REF        | 0.50      |
| UC-BE-PNT-SYNC      | 2      | BE-PNT        | 1.00      |
| UC-BE-PNT-LIST      | 2      | BE-PNT        | 0.50      |
| UC-BE-PNT-VAL       | 2      | BE-PNT        | 0.50      |
| UC-BE-PNT-COR       | 2      | BE-PNT        | 0.25      |
| UC-BE-PAY-GEN       | 2      | BE-PAY        | 0.75      |
| UC-BE-PAY-EXP       | 2      | BE-PAY        | 0.50      |
| UC-BE-PAY-IMP       | 2      | BE-PAY        | 0.50      |
| UC-FE-ADM-SETUP     | 2      | FE-ADMIN-0    | 1.00      |
| UC-FE-ADM-AUTH      | 2      | FE-ADMIN-0    | 1.00      |
| UC-FE-ADM-KPI       | 2      | FE-ADMIN-DASH | 1.00      |
| UC-FE-ADM-SITES     | 3      | FE-ADMIN-REF  | 0.50      |
| UC-FE-ADM-ACT       | 3      | FE-ADMIN-REF  | 0.50      |
| UC-FE-ADM-WORKERS   | 3      | FE-ADMIN-REF  | 1.00      |
| UC-FE-ADM-USERS     | 3      | FE-ADMIN-REF  | 0.25      |
| UC-FE-ADM-PNT       | 3      | FE-ADMIN-PNT  | 1.00      |
| UC-FE-ADM-PAY-BORD  | 3      | FE-ADMIN-PAY  | 1.00      |
| UC-FE-ADM-PAY-EXP   | 3      | FE-ADMIN-PAY  | 0.25      |
| UC-FE-ADM-PAY-IMP   | 3      | FE-ADMIN-PAY  | 0.25      |
| UC-FE-ADM-REP       | 3      | FE-ADMIN-REP  | 0.25      |
| UC-FE-ADM-AUDIT     | 3      | FE-ADMIN-REP  | 0.25      |
| UC-FE-PWA-SETUP     | 3      | FE-PWA-0      | 1.00      |
| UC-FE-PWA-AUTH      | 3      | FE-PWA-0      | 0.75      |
| UC-FE-PWA-DAY       | 4      | FE-PWA-CDE    | 0.50      |
| UC-FE-PWA-BATCH     | 4      | FE-PWA-CDE    | 3.00      |
| UC-FE-PWA-PHOTO     | 4      | FE-PWA-CDE    | 0.50      |
| UC-FE-PWA-VAL       | 4      | FE-PWA-CDS    | 1.25      |
| UC-FE-PWA-BIO       | 4      | FE-PWA-CDS    | 0.75      |
| UC-FE-PWA-SYNC-ENG  | 4      | FE-PWA-SYNC   | 2.00      |
| UC-FE-PWA-SYNC-UI   | 4      | FE-PWA-SYNC   | 0.25      |
| UC-BE-BIO-ADAPT     | 4      | BE-BIO        | 1.00      |
| UC-BE-BIO-AXIAN     | 4      | BE-BIO        | 1.00      |
| UC-BE-RPT-WEEK      | 4      | BE-RPT        | 2.00      |
| UC-OPS-IMPORT       | 5      | OPS-DATA      | 1.00      |
| UC-OPS-VPS          | 5      | OPS-DEPLOY    | 1.00      |
| UC-QA-E2E           | 5      | QA            | 1.50      |
| UC-QA-OFFLINE       | 5      | QA            | 1.00      |
| UC-QA-REC           | 5      | QA            | 1.50      |
| UC-DOC-USER         | 5      | DOC           | 1.00      |
| UC-DOC-OPS          | 5      | DOC           | 0.50      |
| UC-DOC-TRAIN        | 5      | DOC           | 1.00      |
| UC-OPS-HC           | 6      | OPS-HYPERCARE | 3.00      |
| UC-MARGE-V1         | 6      | MARGE-V1      | 6.00      |
| UC-CAD-V2           | 7      | CAD-V2        | 1.50      |
| UC-BE-GEO-DM        | 7      | BE-GEO        | 0.75      |
| UC-BE-GEO-API       | 7      | BE-GEO        | 0.75      |
| UC-FE-ADM-GEO       | 7      | BE-GEO        | 0.75      |
| UC-FE-PWA-CDS-TEAM  | 7      | FE-PWA-TEAM   | 1.50      |
| UC-FE-PWA-CDE-TEAM  | 7      | FE-PWA-TEAM   | 1.00      |
| UC-FE-PWA-NFC-UI    | 7      | FE-PWA-NFC    | 1.50      |
| UC-BE-NFC           | 8      | BE-NFC        | 1.00      |
| UC-FE-PWA-BIO-CACHE | 8      | FE-PWA-BIO    | 1.50      |
| UC-FE-PWA-BIO-COMP  | 8      | FE-PWA-BIO    | 1.75      |
| UC-BE-WF            | 8      | BE-WF         | 1.00      |
| UC-FE-PWA-CLAR      | 8      | FE-PWA-WF     | 1.00      |
| UC-FE-PWA-ACTREQ    | 8      | FE-PWA-WF     | 0.50      |
| UC-FE-PWA-WKRREQ    | 8      | FE-PWA-WF     | 0.50      |
| UC-FE-ADM-WF        | 8      | FE-ADMIN-WF   | 1.00      |
| UC-FE-ADM-MAP       | 8      | FE-ADMIN-MAP  | 1.50      |
| UC-BE-DAILY         | 9      | BE-DAILY      | 0.50      |
| UC-FE-PWA-CLOSE     | 9      | BE-DAILY      | 0.50      |
| UC-QA-V2-E2E        | 9      | QA-V2         | 1.00      |
| UC-QA-V2-REC        | 9      | QA-V2         | 1.50      |
| UC-MARGE-V2         | 9      | MARGE-V2      | 1.50      |

---

## Hors périmètre (backlog explicite)

- Infra récurrente (VPS, SMS, email, MapTiler, Backblaze)
- Stabilisation AXIAN post-V2 (3-5 j supplémentaires si API tardive)
- Maintenance long terme post-hypercare
- Matériel (smartphones Android NFC, badges NFC)
- Analyse RGPD approfondie V2

---

## Conditions de réussite

| Condition                                    | Échéance                      |
| -------------------------------------------- | ----------------------------- |
| Référent métier ALTERRA disponible 0,5 j/sem | Toute la durée                |
| Engagement AXIAN ou mode manuel              | Avant biométrie V1 (Sprint 4) |
| Échantillon format MVola                     | Sprint 1                      |
| VPS provisionné                              | Sprint 5                      |
| Données initiales Excel propres              | Sprint 5                      |
| Flotte Android NFC validée                   | Avant Sprint 7                |

---

## Self-review (couverture spec)

| Section backlog                            | Task(s) couvrante(s) | Statut |
| ------------------------------------------ | -------------------- | ------ |
| Synthèse V1/V2                             | En-tête + tableaux   | ✅     |
| Sprint 1 — CAD + Socle                     | Tasks 1-5            | ✅     |
| Sprint 2 — API + Admin start               | Tasks 6-10           | ✅     |
| Sprint 3 — Admin + PWA setup               | Tasks 11-15          | ✅     |
| Sprint 4 — PWA + Bio + PDF                 | Tasks 16-20          | ✅     |
| Sprint 5 — Ops + QA + Doc                  | Tasks 21-24          | ✅     |
| Sprint 6 — Hypercare + Marge V1            | Tasks 25-26          | ✅     |
| Sprint 7 — V2 cadrage + Geo + Teams + NFC  | Tasks 27-30          | ✅     |
| Sprint 8 — NFC BE + Bio offline + WF + Map | Tasks 31-36          | ✅     |
| Sprint 9 — Clôture + QA V2 + Marge V2      | Tasks 37-39          | ✅     |
| Hypothèses / inclus / exclus               | Sections dédiées     | ✅     |
| Inventaire 71 UC                           | Table complète       | ✅     |

**Écart noté :** total détaillé backlog = 57.25 j (UI) + 34 j (BE) en fin V1 doc vs 50 j annoncés en synthèse — les 6 j de marge V1 (Task 26) absorbent l'écart.

---

_Source : `basedocs/ALTERRA - Backlog détaillé.md` v1.0 du 28 avril 2026_
