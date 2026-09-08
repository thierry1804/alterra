# ALTERRA — Backlog détaillé

**Backlog produit organisé par sprint > section > module.**

Chaque user story est identifiée par un Use Case ID, un rôle utilisateur, une tâche technique et une estimation en jours-homme (UI + Backend + Total).

Préparé par : Thierry — NextA. 28 avril 2026 — v1.0.

---

## Synthèse

| Version                     | Jours-homme | Semaines        | Contenu                                                                                                                           |
| --------------------------- | ----------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **V1 — Cœur fonctionnel**   | 50.00       | 12 semaines     | Auth, référentiels, pointage à la tâche offline, validation hebdomadaire, biométrie online, Excel MVola, rapports PDF.            |
| **V2 — Extensions terrain** | 21.00       | 5 semaines      | NFC, biométrie offline, workflows demandes, composition équipes PWA, hiérarchie Zone/Parcelle, cartographie, clôture quotidienne. |
| **TOTAL V1 + V2**           | **71.00**   | **17 semaines** | Livraison en 2 phases : V1 ferme + V2 en avenant après recette V1.                                                                |

### Sprints (17 semaines calendaires)

| Sprint       | Semaines | Focus                                              | Charge (j-h) |
| ------------ | -------- | -------------------------------------------------- | ------------ |
| **Sprint 1** | S1-S2    | Cadrage + Socle technique                          | 8.00         |
| **Sprint 2** | S3-S4    | API métier V1 + Admin start                        | 10.50        |
| **Sprint 3** | S5-S6    | Admin complet + PWA setup                          | 6.50         |
| **Sprint 4** | S7-S8    | PWA complète + Biométrie + PDF                     | 9.50         |
| **Sprint 5** | S9-S10   | Données + Déploiement + Tests + Formation          | 8.00         |
| **Sprint 6** | S11-S12  | Hypercare V1 + marge                               | 9.00         |
| **Sprint 7** | S13-S14  | Cadrage V2 + Zone/Parcelle + Équipes + NFC start   | 7.00         |
| **Sprint 8** | S15-S16  | NFC + Biométrie offline + Workflows + Cartographie | 10.25        |
| **Sprint 9** | S17      | Clôture quotidienne + Tests V2 + Hypercare V2      | 4.50         |

---

# Backlog V1 — Cœur fonctionnel

---

## SPRINT 1 (S1-S2) — Cadrage et socle technique · Objectif : spec figée, backend démarrable

### SECTION A — CADRAGE ET DESIGN

#### Module CAD — Cadrage projet

| Use Case    | User Story                                                                                      | Acteur         | Tâche           | Description                                                                                                                                                    | UI (j)   | BE (j)   | Total (j) |
| ----------- | ----------------------------------------------------------------------------------------------- | -------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-CAD-01` | En tant que PO, je veux animer un atelier métier avec ALTERRA afin de figer le workflow réel    | PO / Tech Lead | Atelier métier  | Ateliers de cadrage sur 2-3 demi-journées. Écoute des CDS et Admin. Modélisation processus. Identification règles précises (biométrie, MVola, cycle campagne). | 0.00     | 1.50     | **1.50**  |
| `UC-CAD-02` | En tant que dev, je veux une spec détaillée + user stories priorisées afin de savoir quoi coder | PO             | Spec + backlog  | Rédaction user stories par module, critères d'acceptation, priorisation MoSCoW, découpage sprints.                                                             | 0.00     | 1.00     | **1.00**  |
| `UC-CAD-03` | En tant que dev, je veux des maquettes Figma des écrans clés afin d'avoir une cible visuelle    | UX / Tech Lead | Maquettes Figma | Wireframes puis maquettes des écrans critiques : Dashboard Admin, Saisie en lot PWA CDE, Validation CDS, Bordereau paiement.                                   | 1.00     | 0.50     | **1.50**  |
|             |                                                                                                 |                |                 | **Sous-total Module CAD — Cadrage projet**                                                                                                                     | **1.00** | **3.00** | **4.00**  |

### SECTION B — BACKEND SOCLE (NestJS · Prisma · PostgreSQL)

#### Module BE-0 — Setup et infrastructure

| Use Case      | User Story                                                                                                  | Acteur      | Tâche              | Description                                                                                                              | UI (j)   | BE (j)   | Total (j) |
| ------------- | ----------------------------------------------------------------------------------------------------------- | ----------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------ | -------- | -------- | --------- |
| `UC-BE-SETUP` | En tant que dev, je veux un monorepo pnpm workspaces avec Turborepo afin de partager code et types          | Développeur | Init monorepo      | pnpm-workspace.yaml, turbo.json, ESLint/Prettier partagés, tsconfig strict, path aliases @alterra/ui @alterra/api-types. | 0.00     | 0.50     | **0.50**  |
| `UC-BE-SETUP` | En tant que dev, je veux NestJS 10 + Fastify + Prisma initialisés afin de démarrer l'API                    | Développeur | Init NestJS        | nest new, migration Fastify, Prisma init, connection PostgreSQL, healthcheck endpoint /health.                           | 0.00     | 0.50     | **0.50**  |
| `UC-BE-SETUP` | En tant que DevOps, je veux un Docker Compose local afin de développer en environnement identique à la prod | Développeur | Docker Compose dev | Compose avec api + postgres + redis + minio. .env.example. Documentation démarrage.                                      | 0.00     | 0.50     | **0.50**  |
|               |                                                                                                             |             |                    | **Sous-total Module BE-0 — Setup et infrastructure**                                                                     | **0.00** | **1.50** | **1.50**  |

#### Module BE-DB — Modèle de données

| Use Case       | User Story                                                                                                      | Acteur      | Tâche             | Description                                                                                                                          | UI (j)   | BE (j)   | Total (j) |
| -------------- | --------------------------------------------------------------------------------------------------------------- | ----------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------- | --------- |
| `UC-BE-SCHEMA` | En tant que dev, je veux un schéma Prisma V1 complet afin de coder sur des types stables                        | Développeur | Schéma Prisma V1  | 13 modèles V1 : User, Site, Activity, Worker, Team, Pointage, Payment, BiometricCheck, AuditLog, RefreshToken, PasswordReset. Enums. | 0.00     | 1.00     | **1.00**  |
| `UC-BE-MIGR`   | En tant que dev, je veux les migrations Prisma versionnées + seed déterministe afin de reproduire l'état de dev | Développeur | Migrations + seed | prisma migrate dev + fichier seed.ts avec fixtures : 1 admin, 5 CDS, 15 CDE, 5 sites, 10 activités, 50 MOC test.                     | 0.00     | 0.50     | **0.50**  |
|                |                                                                                                                 |             |                   | **Sous-total Module BE-DB — Modèle de données**                                                                                      | **0.00** | **1.50** | **1.50**  |

#### Module BE-AUTH — Authentification

| Use Case     | User Story                                                                                          | Acteur      | Tâche              | Description                                                                                             | UI (j)   | BE (j)   | Total (j) |
| ------------ | --------------------------------------------------------------------------------------------------- | ----------- | ------------------ | ------------------------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-BE-AUTH` | En tant qu'utilisateur, je veux me connecter avec email/mot de passe afin d'accéder à la plateforme | Admin / CDS | POST /auth/login   | Argon2id password, JWT HS256 access 15 min + refresh cookie 7j HttpOnly. Réponse { accessToken, user }. | 0.00     | 0.50     | **0.50**  |
| `UC-BE-AUTH` | En tant qu'utilisateur, je veux rafraîchir mon token silencieusement afin de rester connecté        | Tous        | POST /auth/refresh | Rotation refresh token, blacklist ancien en Redis. Renvoi nouveau access.                               | 0.00     | 0.50     | **0.50**  |
| `UC-BE-AUTH` | En tant qu'utilisateur, je veux me déconnecter et invalider mes sessions                            | Tous        | POST /auth/logout  | Révoque refresh, blacklist Redis. Suppression cookie.                                                   | 0.00     | 0.25     | **0.25**  |
| `UC-BE-AUTH` | En tant qu'Admin, je veux activer MFA TOTP sur mon compte afin de renforcer la sécurité             | Admin       | MFA TOTP           | Génération secret, QR code, vérification 6 chiffres. Secret chiffré en base.                            | 0.00     | 0.25     | **0.25**  |
|              |                                                                                                     |             |                    | **Sous-total Module BE-AUTH — Authentification**                                                        | **0.00** | **1.50** | **1.50**  |

#### Module BE-RBAC — RBAC et audit

| Use Case      | User Story                                                                                             | Acteur      | Tâche                 | Description                                                                                          | UI (j)   | BE (j)   | Total (j) |
| ------------- | ------------------------------------------------------------------------------------------------------ | ----------- | --------------------- | ---------------------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-BE-RBAC`  | En tant que dev, je veux un guard @Roles() paramétrable afin de contrôler l'accès aux endpoints        | Développeur | RolesGuard NestJS     | Décorateur @Roles + RolesGuard vérifiant JWT payload. Erreur 403 typée.                              | 0.00     | 0.25     | **0.25**  |
| `UC-BE-RBAC`  | En tant que dev, je veux un middleware Prisma qui injecte les filtres par site/équipe                  | Développeur | Prisma RLS middleware | AsyncLocalStorage stocke user. Middleware ajoute WHERE siteId=user.siteId pour CDS, teamId pour CDE. | 0.00     | 0.75     | **0.75**  |
| `UC-BE-AUDIT` | En tant qu'Admin, je veux un audit log complet des actions sensibles afin de tracer toute modification | Admin       | Audit log             | Interceptor global + triggers PostgreSQL sur Worker, Pointage, Payment. Table audit_log append-only. | 0.00     | 0.50     | **0.50**  |
|               |                                                                                                        |             |                       | **Sous-total Module BE-RBAC — RBAC et audit**                                                        | **0.00** | **1.50** | **1.50**  |

---

## SPRINT 2 (S3-S4) — API métier V1 · Objectif : API fonctionnelle en sandbox

### SECTION B — BACKEND API MÉTIER

#### Module BE-REF — Référentiels

| Use Case        | User Story                                                                                                       | Acteur | Tâche                | Description                                                                                           | UI (j)   | BE (j)   | Total (j) |
| --------------- | ---------------------------------------------------------------------------------------------------------------- | ------ | -------------------- | ----------------------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-BE-SITES`   | En tant qu'Admin, je veux CRUD sur les sites afin de gérer les 5 sites ALTERRA                                   | Admin  | CRUD /sites          | 5 endpoints REST. Validation Zod : nom, shortCode unique, geo. Audit.                                 | 0.00     | 0.50     | **0.50**  |
| `UC-BE-ACT`     | En tant qu'Admin, je veux CRUD sur les activités avec versioning tarif afin de gérer trouaison, défrichage, etc. | Admin  | CRUD /activities     | 5 endpoints. Modification tarif = fermeture ancien + création nouveau (RG-04). Historique préservé.   | 0.00     | 1.00     | **1.00**  |
| `UC-BE-WORKERS` | En tant qu'Admin, je veux CRUD sur les MOC afin de gérer la base des travailleurs                                | Admin  | CRUD /workers        | 5 endpoints. Filtres site/team/status. Recherche full-text. Upload photo via URL pré-signée.          | 0.00     | 1.00     | **1.00**  |
| `UC-BE-IMPORT`  | En tant qu'Admin, je veux importer une liste de MOC depuis Excel afin d'onboarder rapidement                     | Admin  | POST /workers/import | Parse xlsx via exceljs. Validation ligne par ligne. Preview avec erreurs. Insertion transactionnelle. | 0.00     | 0.50     | **0.50**  |
| `UC-BE-USERS`   | En tant qu'Admin, je veux CRUD sur les comptes utilisateurs afin de gérer les CDS et CDE                         | Admin  | CRUD /users          | 5 endpoints. Réinitialisation mot de passe forcée. Désactivation immédiate + blacklist Redis.         | 0.00     | 0.50     | **0.50**  |
|                 |                                                                                                                  |        |                      | **Sous-total Module BE-REF — Référentiels**                                                           | **0.00** | **3.50** | **3.50**  |

#### Module BE-PNT — Pointages

| Use Case         | User Story                                                                                       | Acteur      | Tâche                         | Description                                                                                              | UI (j)                                                            | BE (j)   | Total (j) |
| ---------------- | ------------------------------------------------------------------------------------------------ | ----------- | ----------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------- | --------- |
| `UC-BE-PNT-SYNC` | En tant que CDE, je veux synchroniser un batch de pointages afin de remonter mes saisies offline | CDE         | POST /pointages/sync          | Batch ≤100. Upsert via clientUuid @unique. Retour par ligne created/already_exists/rejected. Idempotent. | 0.00                                                              | 1.00     | **1.00**  |
| `UC-BE-PNT-LIST` | En tant que CDS/Admin, je veux consulter les pointages filtrés afin de préparer la validation    | CDS / Admin | GET /pointages                | Cursor pagination 50. Filtres période, worker, activity, status. Sous-requête bio.                       | 0.00                                                              | 0.50     | **0.50**  |
| `UC-BE-PNT-VAL`  | En tant que CDS, je veux valider/rejeter un pointage unitaire                                    | CDS         | PATCH /pointages/:id/validate | reject                                                                                                   | Vérification bio OK avant validation. Motif obligatoire au rejet. | 0.00     | 0.50      | **0.50** |
| `UC-BE-PNT-COR`  | En tant qu'Admin, je veux corriger un pointage avec motif afin de gérer les erreurs              | Admin       | PATCH /pointages/:id          | Modification quantité, activity, date. Motif obligatoire. Trace complète audit.                          | 0.00                                                              | 0.25     | **0.25**  |
|                  |                                                                                                  |             |                               | **Sous-total Module BE-PNT — Pointages**                                                                 | **0.00**                                                          | **2.25** | **2.25**  |

#### Module BE-PAY — Paiements

| Use Case        | User Story                                                                                               | Acteur | Tâche                        | Description                                                                                                  | UI (j)   | BE (j)   | Total (j) |
| --------------- | -------------------------------------------------------------------------------------------------------- | ------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------ | -------- | -------- | --------- |
| `UC-BE-PAY-GEN` | En tant qu'Admin, je veux générer le bordereau de paiement d'une période afin d'établir les montants dus | Admin  | POST /payments/generate      | Agrégation pointages VALIDATED. Calcul quantity * unitRateSnapshot. Création lignes Payment. Statut PENDING. | 0.00     | 0.75     | **0.75**  |
| `UC-BE-PAY-EXP` | En tant qu'Admin, je veux exporter le fichier Excel MVola afin de soumettre le paiement                  | Admin  | GET /payments/:period/export | Génération xlsx via exceljs. 5 colonnes MVola. Description tronquée si > limite. Statut EXPORTED.            | 0.00     | 0.50     | **0.50**  |
| `UC-BE-PAY-IMP` | En tant qu'Admin, je veux importer le fichier retour MVola afin de mettre à jour les statuts             | Admin  | POST /payments/import-status | Parse xlsx. Match par numéro MVola + montant. Update PAID/FAILED. Rapport d'import.                          | 0.00     | 0.50     | **0.50**  |
|                 |                                                                                                          |        |                              | **Sous-total Module BE-PAY — Paiements**                                                                     | **0.00** | **1.75** | **1.75**  |

### SECTION C — FRONTEND ADMIN (React SPA)

#### Module FE-ADMIN-0 — Setup

| Use Case          | User Story                                                                                | Acteur      | Tâche               | Description                                                                                          | UI (j)   | BE (j)   | Total (j) |
| ----------------- | ----------------------------------------------------------------------------------------- | ----------- | ------------------- | ---------------------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-FE-ADM-SETUP` | En tant que dev, je veux React + Vite + shadcn/ui + Tailwind + TanStack Query initialisés | Développeur | Init frontend Admin | Vite React TS. Tailwind. shadcn/ui components de base (Button, Input, Table, Dialog, Toast). Router. | 0.75     | 0.25     | **1.00**  |
| `UC-FE-ADM-AUTH`  | En tant qu'Admin, je veux une page de connexion et navigation post-login                  | Admin       | Login + navigation  | Login form, intercepteur axios refresh, guards vues, layout avec sidebar rétractable + header.       | 0.75     | 0.25     | **1.00**  |
|                   |                                                                                           |             |                     | **Sous-total Module FE-ADMIN-0 — Setup**                                                             | **1.50** | **0.50** | **2.00**  |

#### Module FE-ADMIN-DASH — Dashboard

| Use Case        | User Story                                                              | Acteur | Tâche          | Description                                                                                            | UI (j)   | BE (j)   | Total (j) |
| --------------- | ----------------------------------------------------------------------- | ------ | -------------- | ------------------------------------------------------------------------------------------------------ | -------- | -------- | --------- |
| `UC-FE-ADM-KPI` | En tant qu'Admin, je veux voir les KPI et graphes clés en un coup d'œil | Admin  | Dashboard KPIs | 4 KPI cards, graphe présence 7j, graphe évolution effectifs, bloc alertes. Refresh 60s TanStack Query. | 1.00     | 0.00     | **1.00**  |
|                 |                                                                         |        |                | **Sous-total Module FE-ADMIN-DASH — Dashboard**                                                        | **1.00** | **0.00** | **1.00**  |

---

## SPRINT 3 (S5-S6) — Frontend Admin complet + PWA démarrage · Objectif : Admin utilisable

#### Module FE-ADMIN-REF — Référentiels

| Use Case            | User Story                                                            | Acteur | Tâche        | Description                                                                                                  | UI (j)   | BE (j)   | Total (j) |
| ------------------- | --------------------------------------------------------------------- | ------ | ------------ | ------------------------------------------------------------------------------------------------------------ | -------- | -------- | --------- |
| `UC-FE-ADM-SITES`   | En tant qu'Admin, je veux CRUD Sites côté UI                          | Admin  | UI Sites     | Table paginée, actions Nouveau/Modifier/Désactiver, formulaire modal avec validation.                        | 0.50     | 0.00     | **0.50**  |
| `UC-FE-ADM-ACT`     | En tant qu'Admin, je veux CRUD Activités avec historique tarifs       | Admin  | UI Activités | Table, formulaire, historique versioning tarif dans un drawer.                                               | 0.50     | 0.00     | **0.50**  |
| `UC-FE-ADM-WORKERS` | En tant qu'Admin, je veux gérer les MOC avec recherche/filtres/import | Admin  | UI MOC       | Table 600+ lignes cursor-based, filtres avancés, formulaire fiche avec upload photo, import Excel drag&drop. | 1.00     | 0.00     | **1.00**  |
| `UC-FE-ADM-USERS`   | En tant qu'Admin, je veux gérer les comptes utilisateurs              | Admin  | UI Users     | Table, formulaire, réinitialisation mot de passe, activation/désactivation.                                  | 0.25     | 0.00     | **0.25**  |
|                     |                                                                       |        |              | **Sous-total Module FE-ADMIN-REF — Référentiels**                                                            | **2.25** | **0.00** | **2.25**  |

#### Module FE-ADMIN-PNT — Pointages

| Use Case        | User Story                                                    | Acteur | Tâche        | Description                                                                                     | UI (j)   | BE (j)   | Total (j) |
| --------------- | ------------------------------------------------------------- | ------ | ------------ | ----------------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-FE-ADM-PNT` | En tant qu'Admin, je veux consulter et corriger les pointages | Admin  | UI Pointages | Table filtrable, photo miniature, drawer détail avec géoloc, correction avec motif obligatoire. | 1.00     | 0.00     | **1.00**  |
|                 |                                                               |        |              | **Sous-total Module FE-ADMIN-PNT — Pointages**                                                  | **1.00** | **0.00** | **1.00**  |

#### Module FE-ADMIN-PAY — Paiements

| Use Case             | User Story                                                 | Acteur | Tâche             | Description                                                                             | UI (j)   | BE (j)   | Total (j) |
| -------------------- | ---------------------------------------------------------- | ------ | ----------------- | --------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-FE-ADM-PAY-BORD` | En tant qu'Admin, je veux générer et corriger le bordereau | Admin  | UI Bordereau      | Sélection période, table 600 lignes avec statut bio, édition inline montant avec motif. | 1.00     | 0.00     | **1.00**  |
| `UC-FE-ADM-PAY-EXP`  | En tant qu'Admin, je veux exporter le fichier Excel MVola  | Admin  | UI Export MVola   | Bouton Exporter, download progression, historique exports téléchargeables.              | 0.25     | 0.00     | **0.25**  |
| `UC-FE-ADM-PAY-IMP`  | En tant qu'Admin, je veux importer le fichier retour MVola | Admin  | UI Import statuts | Drag&drop, preview, résumé PAID/FAILED avec motifs.                                     | 0.25     | 0.00     | **0.25**  |
|                      |                                                            |        |                   | **Sous-total Module FE-ADMIN-PAY — Paiements**                                          | **1.50** | **0.00** | **1.50**  |

#### Module FE-ADMIN-REP — Reporting + Audit

| Use Case          | User Story                                                   | Acteur | Tâche        | Description                                                             | UI (j)   | BE (j)   | Total (j) |
| ----------------- | ------------------------------------------------------------ | ------ | ------------ | ----------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-FE-ADM-REP`   | En tant qu'Admin, je veux des rapports prédéfinis et exports | Admin  | UI Reporting | 3 rapports prédéfinis, filtres période, exports CSV/Excel/PDF via jobs. | 0.25     | 0.00     | **0.25**  |
| `UC-FE-ADM-AUDIT` | En tant qu'Admin, je veux consulter le journal d'audit       | Admin  | UI Audit log | Table paginée, filtres, drawer avec diff avant/après en JSON tree.      | 0.25     | 0.00     | **0.25**  |
|                   |                                                              |        |              | **Sous-total Module FE-ADMIN-REP — Reporting + Audit**                  | **0.50** | **0.00** | **0.50**  |

### SECTION D — FRONTEND PWA (React + PWA + Dexie)

#### Module FE-PWA-0 — Setup PWA

| Use Case          | User Story                                                                   | Acteur      | Tâche             | Description                                                                                       | UI (j)   | BE (j)   | Total (j) |
| ----------------- | ---------------------------------------------------------------------------- | ----------- | ----------------- | ------------------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-FE-PWA-SETUP` | En tant que dev, je veux la PWA Vite avec vite-plugin-pwa + Workbox + Dexie  | Développeur | Init PWA          | manifest, Service Worker cache-first assets + network-first API, Dexie schema, dérivation icônes. | 0.75     | 0.25     | **1.00**  |
| `UC-FE-PWA-AUTH`  | En tant qu'utilisateur PWA, je veux me connecter avec cache offline du token | CDE / CDS   | Login PWA offline | Login form, storage token en IndexedDB chiffré WebCrypto, PIN de déverrouillage 30min.            | 0.50     | 0.25     | **0.75**  |
|                   |                                                                              |             |                   | **Sous-total Module FE-PWA-0 — Setup PWA**                                                        | **1.25** | **0.50** | **1.75**  |

---

## SPRINT 4 (S7-S8) — PWA complète + Biométrie + Rapports · Objectif : cycle end-to-end démo

#### Module FE-PWA-CDE — Chef d'Équipe

| Use Case          | User Story                                                       | Acteur | Tâche               | Description                                                                                                                          | UI (j)   | BE (j)   | Total (j) |
| ----------------- | ---------------------------------------------------------------- | ------ | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- | -------- | --------- |
| `UC-FE-PWA-DAY`   | En tant que CDE, je veux sélectionner l'activité du jour         | CDE    | Sélection activité  | Liste activités du référentiel cache, sélection unique avec confirmation.                                                            | 0.50     | 0.00     | **0.50**  |
| `UC-FE-PWA-BATCH` | En tant que CDE, je veux saisir en lot les quantités des ~40 MOC | CDE    | Écran saisie en lot | Liste MOC avec photo miniature, recherche instantanée, champ numérique par MOC, quantité par défaut appliquable, total prévisionnel. | 2.50     | 0.50     | **3.00**  |
| `UC-FE-PWA-PHOTO` | En tant que CDE, je veux ajouter une photo à un pointage         | CDE    | Capture photo       | Camera API, compression 1MB, prévisualisation, stockage blob IndexedDB.                                                              | 0.50     | 0.00     | **0.50**  |
|                   |                                                                  |        |                     | **Sous-total Module FE-PWA-CDE — Chef d'Équipe**                                                                                     | **3.50** | **0.50** | **4.00**  |

#### Module FE-PWA-CDS — Chef de Service

| Use Case        | User Story                                                           | Acteur | Tâche               | Description                                                                                      | UI (j)   | BE (j)   | Total (j) |
| --------------- | -------------------------------------------------------------------- | ------ | ------------------- | ------------------------------------------------------------------------------------------------ | -------- | -------- | --------- |
| `UC-FE-PWA-VAL` | En tant que CDS, je veux consulter et valider les pointages          | CDS    | Écran validation    | Liste MOC groupée par équipe, indicateur bio + montant, actions par MOC.                         | 1.00     | 0.25     | **1.25**  |
| `UC-FE-PWA-BIO` | En tant que CDS, je veux prendre une photo pour contrôle biométrique | CDS    | Capture bio + envoi | Camera plein écran avec repère facial, envoi POST /biometric/check, affichage pastille résultat. | 0.50     | 0.25     | **0.75**  |
|                 |                                                                      |        |                     | **Sous-total Module FE-PWA-CDS — Chef de Service**                                               | **1.50** | **0.50** | **2.00**  |

#### Module FE-PWA-SYNC — Moteur de synchronisation

| Use Case             | User Story                                                                 | Acteur    | Tâche                   | Description                                                                                                               | UI (j)   | BE (j)   | Total (j) |
| -------------------- | -------------------------------------------------------------------------- | --------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-FE-PWA-SYNC-ENG` | En tant que CDE/CDS, je veux que mes données synchronisent automatiquement | Tous PWA  | Sync engine             | Queue idempotente avec clientUuid, ping 60s, batch ≤100, retry backoff exponentiel, gestion conflits serveur autoritaire. | 1.50     | 0.50     | **2.00**  |
| `UC-FE-PWA-SYNC-UI`  | En tant que CDE, je veux voir mon statut de sync et forcer la sync         | CDE / CDS | UI sync + bouton forcer | Indicateur permanent nombre en attente + dernière sync, bouton forcer, log récent.                                        | 0.25     | 0.00     | **0.25**  |
|                      |                                                                            |           |                         | **Sous-total Module FE-PWA-SYNC — Moteur de synchronisation**                                                             | **1.75** | **0.50** | **2.25**  |

### SECTION E — MODULES SPÉCIFIQUES

#### Module BE-BIO — Biométrie

| Use Case          | User Story                                                                        | Acteur      | Tâche                  | Description                                                                                              | UI (j)   | BE (j)   | Total (j) |
| ----------------- | --------------------------------------------------------------------------------- | ----------- | ---------------------- | -------------------------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-BE-BIO-ADAPT` | En tant que dev, je veux un adapter biométrique interchangeable Mock/Manual/AXIAN | Développeur | Adapter pattern        | Interface BiometricProvider. 3 implémentations. Choix runtime via env BIOMETRIC_PROVIDER.                | 0.00     | 1.00     | **1.00**  |
| `UC-BE-BIO-AXIAN` | En tant que dev, je veux intégrer l'API AXIAN afin de valider les identités       | Développeur | AxianBiometricProvider | Axios client, authentification API Key, gestion erreurs 5xx → UNAVAILABLE, logs raw dans BiometricCheck. | 0.00     | 1.00     | **1.00**  |
|                   |                                                                                   |             |                        | **Sous-total Module BE-BIO — Biométrie**                                                                 | **0.00** | **2.00** | **2.00**  |

#### Module BE-RPT — Rapports PDF

| Use Case         | User Story                                                               | Acteur | Tâche                | Description                                                                                  | UI (j)   | BE (j)   | Total (j) |
| ---------------- | ------------------------------------------------------------------------ | ------ | -------------------- | -------------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-BE-RPT-WEEK` | En tant que CDS, je veux générer le rapport et facture hebdomadaires PDF | CDS    | Génération PDF hebdo | Job BullMQ. Templates Handlebars → HTML → Puppeteer PDF. Stockage MinIO + notif email Admin. | 0.00     | 2.00     | **2.00**  |
|                  |                                                                          |        |                      | **Sous-total Module BE-RPT — Rapports PDF**                                                  | **0.00** | **2.00** | **2.00**  |

---

## SPRINT 5 (S9-S10) — Données, déploiement, tests, formation · Objectif : produit livrable

### SECTION F — DONNÉES ET DÉPLOIEMENT

#### Module OPS-DATA — Migration initiale

| Use Case        | User Story                                                              | Acteur | Tâche          | Description                                                                                                   | UI (j)   | BE (j)   | Total (j) |
| --------------- | ----------------------------------------------------------------------- | ------ | -------------- | ------------------------------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-OPS-IMPORT` | En tant qu'Admin, je veux importer les données initiales de la campagne | Admin  | Import initial | Templates Excel fournis à ALTERRA. Import sites, activités, MOC. Validation métier. Rapport d'import archivé. | 0.00     | 1.00     | **1.00**  |
|                 |                                                                         |        |                | **Sous-total Module OPS-DATA — Migration initiale**                                                           | **0.00** | **1.00** | **1.00**  |

#### Module OPS-DEPLOY — Déploiement

| Use Case     | User Story                                                                | Acteur | Tâche                  | Description                                                                                                 | UI (j)   | BE (j)   | Total (j) |
| ------------ | ------------------------------------------------------------------------- | ------ | ---------------------- | ----------------------------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-OPS-VPS` | En tant que DevOps, je veux déployer sur VPS Docker Compose + Nginx + TLS | DevOps | Déploiement production | Docker Compose prod, Nginx reverse proxy, certbot Let's Encrypt, backup cron vers Backblaze B2, monitoring. | 0.00     | 1.00     | **1.00**  |
|              |                                                                           |        |                        | **Sous-total Module OPS-DEPLOY — Déploiement**                                                              | **0.00** | **1.00** | **1.00**  |

### SECTION G — TESTS ET RECETTE

#### Module QA — Assurance qualité

| Use Case        | User Story                                                      | Acteur       | Tâche                | Description                                                                                             | UI (j)   | BE (j)   | Total (j) |
| --------------- | --------------------------------------------------------------- | ------------ | -------------------- | ------------------------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-QA-E2E`     | En tant que QA, je veux tester bout en bout par rôle            | QA           | Tests E2E V1         | Playwright : parcours CDE (pointage sync), CDS (validation), Admin (bordereau MVola). Rejeu automatisé. | 0.50     | 1.00     | **1.50**  |
| `UC-QA-OFFLINE` | En tant que QA, je veux tester le mode offline réel sur un site | QA           | Test offline terrain | 1 journée terrain avec CDE sur site pilote. Vérification sync au retour. Corrections bugs.              | 0.50     | 0.50     | **1.00**  |
| `UC-QA-REC`     | En tant qu'ALTERRA, je veux recetter la V1 sur 1 site pilote    | ALTERRA + PO | Recette V1           | Session recette 2j avec référent ALTERRA. Corrections J+1 à J+5.                                        | 0.00     | 1.50     | **1.50**  |
|                 |                                                                 |              |                      | **Sous-total Module QA — Assurance qualité**                                                            | **1.00** | **3.00** | **4.00**  |

### SECTION H — FORMATION ET DOCUMENTATION

#### Module DOC — Documentation

| Use Case       | User Story                                                             | Acteur           | Tâche                   | Description                                                                           | UI (j)   | BE (j)   | Total (j) |
| -------------- | ---------------------------------------------------------------------- | ---------------- | ----------------------- | ------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-DOC-USER`  | En tant qu'utilisateur, je veux un guide utilisateur illustré par rôle | PO / Tech Writer | Guide utilisateur       | Guide PDF 15-20 pages par rôle. Screenshots. Cas d'usage courants.                    | 1.00     | 0.00     | **1.00**  |
| `UC-DOC-OPS`   | En tant qu'ALTERRA, je veux une documentation d'exploitation           | DevOps           | Doc exploitation        | Runbook, procédures backup/restore, playbook MEP.                                     | 0.00     | 0.50     | **0.50**  |
| `UC-DOC-TRAIN` | En tant qu'utilisateur, je veux être formé à l'outil sur mon site      | PO / Tech Lead   | Formation 1 site pilote | 1 demi-journée Admin + CDS. 1 demi-journée CDE terrain. Support présentiel semaine 1. | 0.50     | 0.50     | **1.00**  |
|                |                                                                        |                  |                         | **Sous-total Module DOC — Documentation**                                             | **1.50** | **1.00** | **2.50**  |

---

## SPRINT 6 (S11-S12) — Hypercare V1 · Objectif : stabilisation en production

### SECTION I — HYPERCARE

#### Module OPS-HYPERCARE — Support post-MEP

| Use Case    | User Story                                                                 | Acteur      | Tâche        | Description                                                                                    | UI (j)   | BE (j)   | Total (j) |
| ----------- | -------------------------------------------------------------------------- | ----------- | ------------ | ---------------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-OPS-HC` | En tant qu'ALTERRA, je veux un support prioritaire sur 3 semaines post-MEP | PO / DevOps | Hypercare V1 | Astreinte réactive, corrections bugs bloquants, ajustements UX mineurs, hotfix. Réunion hebdo. | 1.00     | 2.00     | **3.00**  |
|             |                                                                            |             |              | **Sous-total Module OPS-HYPERCARE — Support post-MEP**                                         | **1.00** | **2.00** | **3.00**  |

### SECTION J — MARGE PRUDENTIELLE V1

#### Module MARGE-V1 — Provision imprévus

| Use Case      | User Story                                                               | Acteur | Tâche   | Description                                                                                               | UI (j)   | BE (j)   | Total (j) |
| ------------- | ------------------------------------------------------------------------ | ------ | ------- | --------------------------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-MARGE-V1` | Provision pour imprévus V1 (voir Chiffrage.xlsx onglet Marge et risques) | PO     | Réserve | AXIAN API instabilité (2.5j), format MVola (1j), UX saisie en lot (1j), volumétrie (0.5j), imprévus (1j). | 3.00     | 3.00     | **6.00**  |
|               |                                                                          |        |         | **Sous-total Module MARGE-V1 — Provision imprévus**                                                       | **3.00** | **3.00** | **6.00**  |

---

## Total V1

| Estimation            | Valeur (j-h) |
| --------------------- | ------------ |
| **UI / Frontend**     | 23.25        |
| **Backend / Logique** | 34.00        |
| **TOTAL V1**          | **57.25**    |

---

# Backlog V2 — Extensions terrain

---

## SPRINT 7 (S13-S14) — Cadrage V2, Zone/Parcelle, Équipes, NFC démarrage · Objectif : socle V2

### SECTION K — CADRAGE V2

#### Module CAD-V2 — Cadrage extensions

| Use Case    | User Story                                                      | Acteur  | Tâche                  | Description                                                               | UI (j)   | BE (j)   | Total (j) |
| ----------- | --------------------------------------------------------------- | ------- | ---------------------- | ------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-CAD-V2` | En tant que PO, je veux un atelier UX pour les workflows et NFC | PO / UX | Atelier V2 + maquettes | Atelier 2 demi-journées. Maquettes NFC, workflows demandes, cartographie. | 1.00     | 0.50     | **1.50**  |
|             |                                                                 |         |                        | **Sous-total Module CAD-V2 — Cadrage extensions**                         | **1.00** | **0.50** | **1.50**  |

### SECTION L — HIÉRARCHIE GÉOGRAPHIQUE

#### Module BE-GEO — Zone / Parcelle

| Use Case        | User Story                                                                 | Acteur      | Tâche                | Description                                                                          | UI (j)   | BE (j)   | Total (j) |
| --------------- | -------------------------------------------------------------------------- | ----------- | -------------------- | ------------------------------------------------------------------------------------ | -------- | -------- | --------- |
| `UC-BE-GEO-DM`  | En tant que dev, je veux le modèle Zone/Parcelle en Prisma avec migrations | Développeur | Modèle Zone/Parcelle | Migrations Zone (siteId, geoPolygon), Parcelle (zoneId, surfaceHa). FK sur Pointage. | 0.00     | 0.75     | **0.75**  |
| `UC-BE-GEO-API` | En tant qu'Admin, je veux CRUD Zones/Parcelles + intégration pointages     | Admin       | API Zones/Parcelles  | 5 endpoints par entité. Endpoint /sites/geo pour cartographie.                       | 0.00     | 0.75     | **0.75**  |
| `UC-FE-ADM-GEO` | En tant qu'Admin, je veux gérer les Zones/Parcelles côté UI                | Admin       | UI Zones/Parcelles   | Table hiérarchique, formulaire, éditeur polygone GeoJSON simple.                     | 0.75     | 0.00     | **0.75**  |
|                 |                                                                            |             |                      | **Sous-total Module BE-GEO — Zone / Parcelle**                                       | **0.75** | **1.50** | **2.25**  |

### SECTION M — GESTION D'ÉQUIPES

#### Module FE-PWA-TEAM — Équipes côté terrain

| Use Case             | User Story                                                     | Acteur | Tâche                   | Description                                                                 | UI (j)   | BE (j)   | Total (j) |
| -------------------- | -------------------------------------------------------------- | ------ | ----------------------- | --------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-FE-PWA-CDS-TEAM` | En tant que CDS, je veux composer les équipes côté PWA         | CDS    | Composition équipes CDS | CRUD équipes : nom, chef d'équipe, ajout membres depuis autocomplétion MOC. | 1.00     | 0.50     | **1.50**  |
| `UC-FE-PWA-CDE-TEAM` | En tant que CDE, je veux ajouter/retirer des MOC de mon équipe | CDE    | Gestion équipe locale   | Ajout/retrait depuis base MOC existants (autocomplétion). Aucune création.  | 0.75     | 0.25     | **1.00**  |
|                      |                                                                |        |                         | **Sous-total Module FE-PWA-TEAM — Équipes côté terrain**                    | **1.75** | **0.75** | **2.50**  |

### SECTION N — NFC POINTAGE DE PRÉSENCE

#### Module FE-PWA-NFC — Web NFC

| Use Case           | User Story                                                                   | Acteur | Tâche          | Description                                                                            | UI (j)   | BE (j)   | Total (j) |
| ------------------ | ---------------------------------------------------------------------------- | ------ | -------------- | -------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-FE-PWA-NFC-UI` | En tant que CDE, je veux scanner des badges NFC pour enregistrer la présence | CDE    | Module NFC PWA | NDEFReader API, mode lecture, feedback visuel + son, log local, gestion badge inconnu. | 1.00     | 0.50     | **1.50**  |
|                    |                                                                              |        |                | **Sous-total Module FE-PWA-NFC — Web NFC**                                             | **1.00** | **0.50** | **1.50**  |

---

## SPRINT 8 (S15-S16) — Biométrie offline, Workflows, Cartographie · Objectif : richesse fonctionnelle

#### Module BE-NFC — Backend présence

| Use Case    | User Story                                                    | Acteur      | Tâche       | Description                                                                                                         | UI (j)   | BE (j)   | Total (j) |
| ----------- | ------------------------------------------------------------- | ----------- | ----------- | ------------------------------------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-BE-NFC` | En tant que dev, je veux les endpoints PresenceRecord + Badge | Développeur | Backend NFC | PresenceRecord model + endpoint /presence/sync (idempotent). Badge model + CRUD. Test sur appareils cibles Android. | 0.00     | 1.00     | **1.00**  |
|             |                                                               |             |             | **Sous-total Module BE-NFC — Backend présence**                                                                     | **0.00** | **1.00** | **1.00**  |

### SECTION O — BIOMÉTRIE OFFLINE

#### Module FE-PWA-BIO — Cache biométrique local

| Use Case              | User Story                                                                        | Acteur | Tâche                  | Description                                                                                                              | UI (j)   | BE (j)   | Total (j) |
| --------------------- | --------------------------------------------------------------------------------- | ------ | ---------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------- | -------- | --------- |
| `UC-FE-PWA-BIO-CACHE` | En tant que CDE, je veux pré-charger les templates biométriques chiffrés le matin | CDE    | Pré-fetch templates    | GET /biometric/templates/sync + chiffrement WebCrypto AES-256 avec clé dérivée PIN. Stockage IndexedDB.                  | 0.75     | 0.75     | **1.50**  |
| `UC-FE-PWA-BIO-COMP`  | En tant que CDE, je veux comparer une photo capturée avec le template en local    | CDE    | Face matching embarqué | face-api.js chargé lazy. Modèle TinyFace ~1Mo. Comparaison score seuil 0.6. Sync résultat POST /biometric/check-offline. | 1.00     | 0.75     | **1.75**  |
|                       |                                                                                   |        |                        | **Sous-total Module FE-PWA-BIO — Cache biométrique local**                                                               | **1.75** | **1.50** | **3.25**  |

### SECTION P — WORKFLOWS DE DEMANDES

#### Module BE-WF — Backend workflows

| Use Case   | User Story                                                | Acteur      | Tâche         | Description                                                                                          | UI (j)   | BE (j)   | Total (j) |
| ---------- | --------------------------------------------------------- | ----------- | ------------- | ---------------------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-BE-WF` | En tant que dev, je veux les endpoints workflows demandes | Développeur | API workflows | 3 modèles ActivityRequest/WorkerRequest/ClarificationRequest. 5 endpoints par entité. State machine. | 0.00     | 1.00     | **1.00**  |
|            |                                                           |             |               | **Sous-total Module BE-WF — Backend workflows**                                                      | **0.00** | **1.00** | **1.00**  |

#### Module FE-PWA-WF — Workflows côté terrain

| Use Case           | User Story                                                               | Acteur    | Tâche              | Description                                                                              | UI (j)   | BE (j)   | Total (j) |
| ------------------ | ------------------------------------------------------------------------ | --------- | ------------------ | ---------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-FE-PWA-CLAR`   | En tant que CDS, je veux demander des précisions au CDE avant validation | CDS / CDE | Demande précisions | CDS crée demande (texte + photo optionnelle). CDE reçoit notif push, répond. Retour CDS. | 0.75     | 0.25     | **1.00**  |
| `UC-FE-PWA-ACTREQ` | En tant que CDS, je veux demander la création d'une nouvelle activité    | CDS       | Demande activité   | Formulaire proposition (libellé, unité, tarif, justification). Envoi Admin.              | 0.50     | 0.00     | **0.50**  |
| `UC-FE-PWA-WKRREQ` | En tant que CDS, je veux demander l'ajout d'un nouveau MOC               | CDS       | Demande MOC        | Formulaire complet avec photo. Envoi Admin.                                              | 0.50     | 0.00     | **0.50**  |
|                    |                                                                          |           |                    | **Sous-total Module FE-PWA-WF — Workflows côté terrain**                                 | **1.75** | **0.25** | **2.00**  |

#### Module FE-ADMIN-WF — Traitement côté Admin

| Use Case       | User Story                                                            | Acteur | Tâche               | Description                                                                           | UI (j)   | BE (j)   | Total (j) |
| -------------- | --------------------------------------------------------------------- | ------ | ------------------- | ------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-FE-ADM-WF` | En tant qu'Admin, je veux traiter les demandes terrain (file unifiée) | Admin  | File demandes Admin | Onglets par type. Tri ancienneté. Drawer détail. Actions Accepter/Refuser/Complément. | 0.75     | 0.25     | **1.00**  |
|                |                                                                       |        |                     | **Sous-total Module FE-ADMIN-WF — Traitement côté Admin**                             | **0.75** | **0.25** | **1.00**  |

### SECTION Q — CARTOGRAPHIE

#### Module FE-ADMIN-MAP — Cartographie Leaflet

| Use Case        | User Story                                                           | Acteur | Tâche              | Description                                                                                     | UI (j)   | BE (j)   | Total (j) |
| --------------- | -------------------------------------------------------------------- | ------ | ------------------ | ----------------------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-FE-ADM-MAP` | En tant qu'Admin, je veux visualiser sites/zones/parcelles sur carte | Admin  | Cartographie Admin | Leaflet + tuiles OSM/MapTiler. Marqueurs sites avec popup. Couches Zones/Parcelles (polygones). | 1.25     | 0.25     | **1.50**  |
|                 |                                                                      |        |                    | **Sous-total Module FE-ADMIN-MAP — Cartographie Leaflet**                                       | **1.25** | **0.25** | **1.50**  |

---

## SPRINT 9 (S17) — Clôture quotidienne, tests V2, hypercare V2 · Objectif : recette V2 réussie

### SECTION R — CLÔTURE QUOTIDIENNE

#### Module BE-DAILY — Rapport journalier

| Use Case          | User Story                                                          | Acteur      | Tâche                  | Description                                                                       | UI (j)   | BE (j)   | Total (j) |
| ----------------- | ------------------------------------------------------------------- | ----------- | ---------------------- | --------------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-BE-DAILY`     | En tant que dev, je veux l'endpoint /reports/daily                  | Développeur | API rapport journalier | Endpoint POST /reports/daily. Agrégation jour. Template court. PDF via Puppeteer. | 0.00     | 0.50     | **0.50**  |
| `UC-FE-PWA-CLOSE` | En tant que CDS, je veux clôturer une journée et générer le rapport | CDS         | UI clôture journalière | Écran clôture, signature électronique, envoi automatique Admin.                   | 0.50     | 0.00     | **0.50**  |
|                   |                                                                     |             |                        | **Sous-total Module BE-DAILY — Rapport journalier**                               | **0.50** | **0.50** | **1.00**  |

### SECTION S — TESTS V2 ET RECETTE

#### Module QA-V2 — Assurance qualité V2

| Use Case       | User Story                                                        | Acteur       | Tâche                  | Description                                                                 | UI (j)   | BE (j)   | Total (j) |
| -------------- | ----------------------------------------------------------------- | ------------ | ---------------------- | --------------------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-QA-V2-E2E` | En tant que QA, je veux tester V2 E2E incluant NFC et bio offline | QA           | Tests V2               | Playwright + tests appareils physiques NFC. Test offline complet 1 journée. | 0.50     | 0.50     | **1.00**  |
| `UC-QA-V2-REC` | En tant qu'ALTERRA, je veux recetter la V2                        | ALTERRA + PO | Recette V2 + hypercare | Recette 2j + hypercare 2 semaines réactif.                                  | 0.50     | 1.00     | **1.50**  |
|                |                                                                   |              |                        | **Sous-total Module QA-V2 — Assurance qualité V2**                          | **1.00** | **1.50** | **2.50**  |

### SECTION T — MARGE PRUDENTIELLE V2

#### Module MARGE-V2 — Provision imprévus

| Use Case      | User Story                                                  | Acteur | Tâche      | Description                                                      | UI (j)   | BE (j)   | Total (j) |
| ------------- | ----------------------------------------------------------- | ------ | ---------- | ---------------------------------------------------------------- | -------- | -------- | --------- |
| `UC-MARGE-V2` | Provision pour imprévus V2 (NFC, bio offline, UX workflows) | PO     | Réserve V2 | NFC compat (0.5j), bio offline perf (0.5j), UX workflows (0.5j). | 0.75     | 0.75     | **1.50**  |
|               |                                                             |        |            | **Sous-total Module MARGE-V2 — Provision imprévus**              | **0.75** | **0.75** | **1.50**  |

---

## Total V2

| Estimation            | Valeur (j-h) |
| --------------------- | ------------ |
| **UI / Frontend**     | 12.25        |
| **Backend / Logique** | 10.25        |
| **TOTAL V2**          | **22.50**    |

---

## Hypothèses de chiffrage et de planning

### MÉTHODE ET ORGANISATION

- **Méthode** : Scrum adapté. Sprints de 2 semaines. Une exception : Sprint 9 (S17) sur 1 semaine.
- **Équipe** : 2 développeurs fullstack + 1 tech lead 20 % + 1 PO 30 %.
- **Capacité** : 3 j-h effectifs par développeur par semaine (10 j × 60 % de focus).
- **Cérémonies** : Daily 15 min, sprint planning 2h, sprint review 1h, rétrospective 1h.

### ESTIMATION

- **Unité** : Jour-homme (j/h) exprimé en fraction (0.25, 0.5, 0.75, 1.0, etc.).
- **Méthode** : Estimation à dire d'expert par le Tech Lead, ajustée en Sprint Planning.
- **Répartition** : Colonne UI/Frontend pour interface, colonne Backend/Logique pour serveur et logique métier.
- **Total** : Somme automatique des deux colonnes.

### PÉRIMÈTRE

- **V1** : 50 j-h sur 12 semaines. Cœur fonctionnel opérationnel.
- **V2** : 21 j-h sur 5 semaines. Extensions terrain (NFC, bio offline, workflows, Zone/Parcelle, cartographie, clôture quotidienne).
- **Total** : 71 j-h sur 17 semaines calendaires enchaînées.
- **V2 optionnelle** : V1 ferme à signature. V2 en avenant après recette V1.

### INCLUS

- **Cadrage** : Ateliers, spec fonctionnelle, spec technique, backlog, maquettes.
- **Développement** : Backend NestJS + Prisma, Frontend Admin React, PWA Terrain React.
- **Modules** : Excel MVola, PDF rapports, biométrie adapter, NFC, workflows.
- **Migration** : Import données initiales format Excel propre fourni par ALTERRA.
- **Déploiement** : VPS Linux Docker Compose, backup, monitoring.
- **Tests** : Unitaires, intégration, E2E, test offline terrain, recette.
- **Formation** : 1 site pilote. Guide utilisateur PDF, doc exploitation.
- **Hypercare** : 3 semaines après MEP V1, 2 semaines après MEP V2.

### NON INCLUS

- **Infra récurrente** : VPS, services tiers (SMS, email, MapTiler, Backblaze).
- **Stabilisation AXIAN post-V2** : 3-5 j en sus si API livrée après V2.
- **Maintenance long terme** : Forfait post-hypercare à chiffrer séparément.
- **Matériel** : Smartphones Android NFC + badges NFC à la charge d'ALTERRA.
- **Analyse RGPD approfondie V2** : Recommandée, à chiffrer séparément.

### CONDITIONS DE RÉUSSITE

- **Référent métier ALTERRA** : 0,5 j/semaine disponible pendant toute la durée.
- **Engagement AXIAN** : Confirmation avant phase biométrique V1 ou décision mode manuel.
- **Format MVola** : Échantillon obtenu en Sprint 1.
- **VPS** : Provisionné en Sprint 5.
- **Données initiales** : Fournies en Sprint 5 au format Excel propre.
- **Flotte Android NFC** : Validée avant Sprint 7 (V2).

---

_Fin du document — v1.0 du 28 avril 2026_
