# ALTERRA — Backlog V1 priorisé MoSCoW

**Statut :** Priorisation documentaire — validation PO après atelier métier  
**Date :** 21 juillet 2026  
**Périmètre :** Tous les Use Cases V1 (Sprints 1 à 6)  
**Budget V1 firm :** **50 j-h** (cœur fonctionnel contractuel — livrable Must Have)  
**Réserve imprévus :** `UC-MARGE-V1` (~7 j-h) — **contingence hors périmètre firm 50 j-h**, non additive au scope Must ; consommée sur décision PO uniquement  
**Légende MoSCoW :** **M** = Must Have · **S** = Should Have · **C** = Could Have · **W** = Won't Have (V1) · **R** = Réserve / contingence (hors budget firm)

> **Nature du document :** synthèse MoSCoW dérivée du backlog détaillé (`basedocs/ALTERRA - Backlog détaillé.md`). Ce fichier ne duplique pas les user stories complètes ni les estimations ligne à ligne ; il priorise et résume les critères d'acceptation par UC pour le cadrage Sprint 1.

---

## Synthèse par priorité

| Priorité                | Nb UC  | Charge (j-h)       | Commentaire                                                                                          |
| ----------------------- | ------ | ------------------ | ---------------------------------------------------------------------------------------------------- |
| **Must Have**           | 38     | **~50**            | **Livrable contractuel firm** — enveloppe 50 j-h garantie V1 (incl. MFA Admin)                       |
| **Should Have**         | 14     | ~8                 | Priorisé backlog ; **non additif** au contrat 50 j-h — négociation scope ou absorption capacité Must |
| **Could Have**          | 2      | ~2                 | Priorisé backlog ; **non additif** — nice-to-have, report V2 si pas de marge                         |
| **Won't Have (V1)**     | —      | —                  | Explicitement V2 (backlog séparé)                                                                    |
| **Total backlog V1**    | **54** | ~60 (ref. interne) | Seul Must = périmètre firm 50 j-h ; Should/Could hors enveloppe contractuelle                        |
| **Réserve (hors firm)** | 1      | ~7                 | `UC-MARGE-V1` — contingence contractuelle, **pas** additive au scope Must                            |

---

## Sprint 1 — Cadrage et socle technique

### Module CAD — Cadrage projet

| UC          | User Story (résumé)                        | MoSCoW | Critères d'acceptation (résumé)                                                                          |
| ----------- | ------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------- |
| `UC-CAD-01` | Atelier métier ALTERRA pour figer workflow | **M**  | CR atelier signé ; workflow campagne/bio/MVola validé ; questions ouvertes ≤ 5                           |
| `UC-CAD-02` | Spec + backlog priorisé MoSCoW             | **M**  | Ce document + specs à jour ; chaque UC V1 a critères testables                                           |
| `UC-CAD-03` | Maquettes Figma écrans clés                | **M**  | 4 écrans wireframés (Dashboard, Saisie lot, Validation CDS, Bordereau) ; specs suffisantes pour designer |

### Module BE-0 — Setup infrastructure

| UC            | User Story (résumé)     | MoSCoW | Critères d'acceptation (résumé)                                                                                                        |
| ------------- | ----------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `UC-BE-SETUP` | Monorepo npm workspaces | **M**  | `npm install` + build packages OK ; packages `@alterra/ui`, `@alterra/api-types` partagés (contrainte globale : pas de pnpm/Turborepo) |
| `UC-BE-SETUP` | API Express + Prisma    | **M**  | Node.js 22 + Express 4 ; `/health` retourne 200 ; Prisma connecté PostgreSQL (contrainte globale : pas de NestJS/Fastify)              |
| `UC-BE-SETUP` | Docker Compose local    | **M**  | `docker compose up` lance api + postgres + redis + minio ; `.env.example` documenté                                                    |

### Module BE-DB — Modèle de données

| UC             | User Story (résumé)            | MoSCoW | Critères d'acceptation (résumé)                                                                                                    |
| -------------- | ------------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `UC-BE-SCHEMA` | Schéma Prisma V1 (13 modèles)  | **M**  | Modèles User, Site, Activity, Worker, Team, Pointage, Payment, BiometricCheck, AuditLog, RefreshToken, PasswordReset ; enums typés |
| `UC-BE-MIGR`   | Migrations + seed déterministe | **M**  | `prisma migrate dev` + seed : 1 admin, 5 CDS, 15 CDE, 5 sites, 10 activités, 50 MOC                                                |

### Module BE-AUTH — Authentification

| UC           | User Story (résumé)      | MoSCoW | Critères d'acceptation (résumé)                                                                                                       |
| ------------ | ------------------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `UC-BE-AUTH` | Login email/mot de passe | **M**  | POST `/auth/login` ; Argon2id ; JWT **HS256** access 15 min + refresh cookie 7 j HttpOnly ; secret ≥ 256 bits                         |
| `UC-BE-AUTH` | Refresh token silencieux | **M**  | Rotation refresh ; blacklist Redis ; nouveau access token                                                                             |
| `UC-BE-AUTH` | Logout                   | **M**  | Révoque refresh ; supprime cookie ; blacklist                                                                                         |
| `UC-BE-AUTH` | MFA TOTP Admin           | **M**  | Obligatoire pour rôle Admin ; secret + QR ; vérif 6 chiffres ; secret chiffré AES-256-GCM en base ; login bloqué si MFA non configuré |

### Module BE-RBAC — RBAC et audit

| UC            | User Story (résumé)         | MoSCoW | Critères d'acceptation (résumé)                                                             |
| ------------- | --------------------------- | ------ | ------------------------------------------------------------------------------------------- |
| `UC-BE-RBAC`  | Middleware `requireRole()`  | **M**  | Middleware Express par route ; 403 typé si rôle insuffisant                                 |
| `UC-BE-RBAC`  | Filtres Prisma site/équipe  | **M**  | CDS filtré par siteId ; CDE par teamId ; double barrière API + Prisma                       |
| `UC-BE-AUDIT` | Audit log actions sensibles | **S**  | Middleware audit + triggers PostgreSQL ; table append-only ; Worker/Pointage/Payment tracés |

---

## Sprint 2 — API métier V1 + Admin start

### Module BE-REF — Référentiels

| UC              | User Story (résumé)                 | MoSCoW | Critères d'acceptation (résumé)                                               |
| --------------- | ----------------------------------- | ------ | ----------------------------------------------------------------------------- |
| `UC-BE-SITES`   | CRUD /sites                         | **M**  | 5 endpoints REST ; shortCode unique ; validation Zod ; audit                  |
| `UC-BE-ACT`     | CRUD /activities + versioning tarif | **M**  | Modification tarif = fermeture ancien + nouveau (RG-04) ; historique préservé |
| `UC-BE-WORKERS` | CRUD /workers                       | **M**  | Filtres site/team/status ; recherche full-text ; upload photo URL pré-signée  |
| `UC-BE-IMPORT`  | Import MOC Excel                    | **S**  | Parse xlsx ; preview erreurs ligne par ligne ; insertion transactionnelle     |
| `UC-BE-USERS`   | CRUD /users                         | **M**  | Reset mot de passe forcé ; désactivation + blacklist Redis                    |

### Module BE-PNT — Pointages

| UC               | User Story (résumé)        | MoSCoW | Critères d'acceptation (résumé)                                                           |
| ---------------- | -------------------------- | ------ | ----------------------------------------------------------------------------------------- |
| `UC-BE-PNT-SYNC` | POST /pointages/sync batch | **M**  | Batch ≤100 ; upsert clientUuid ; retour created/already_exists/rejected ; idempotent      |
| `UC-BE-PNT-LIST` | GET /pointages filtrés     | **M**  | Cursor pagination 50 ; filtres période/worker/activity/status ; sous-requête bio          |
| `UC-BE-PNT-VAL`  | Valider/rejeter pointage   | **M**  | Bio **OK** requis validation (RG-03) ; DOUBT/KO/absent bloquent ; motif obligatoire rejet |
| `UC-BE-PNT-COR`  | Correction Admin           | **S**  | Modification quantité/activity/date ; motif obligatoire ; audit complet                   |

### Module BE-PAY — Paiements

| UC              | User Story (résumé)       | MoSCoW | Critères d'acceptation (résumé)                                                                         |
| --------------- | ------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| `UC-BE-PAY-GEN` | Générer bordereau période | **M**  | Agrégation VALIDATED ; quantity × unitRateSnapshot ; Payment PENDING                                    |
| `UC-BE-PAY-EXP` | Export Excel MVola        | **M**  | 5 colonnes spec ; **uniquement lignes Bio OK** (RG-03) ; mode dégradé Admin hors bulk ; archivage MinIO |
| `UC-BE-PAY-IMP` | Import retour MVola       | **M**  | Match numéro + montant ; PAID/FAILED ; rapport import                                                   |

### Module FE-ADMIN-0 — Setup Admin

| UC                | User Story (résumé)        | MoSCoW | Critères d'acceptation (résumé)                                      |
| ----------------- | -------------------------- | ------ | -------------------------------------------------------------------- |
| `UC-FE-ADM-SETUP` | Init React + Vite + shadcn | **M**  | Build OK ; composants base ; router ; TanStack Query                 |
| `UC-FE-ADM-AUTH`  | Login + navigation         | **M**  | Form login ; intercepteur refresh ; guards ; layout sidebar + header |

### Module FE-ADMIN-DASH — Dashboard

| UC              | User Story (résumé) | MoSCoW | Critères d'acceptation (résumé)                                                  |
| --------------- | ------------------- | ------ | -------------------------------------------------------------------------------- |
| `UC-FE-ADM-KPI` | Dashboard KPIs      | **S**  | 4 KPI cards ; graphe présence 7j ; graphe effectifs ; bloc alertes ; refresh 60s |

---

## Sprint 3 — Admin complet + PWA démarrage

### Module FE-ADMIN-REF — Référentiels UI

| UC                  | User Story (résumé) | MoSCoW | Critères d'acceptation (résumé)                              |
| ------------------- | ------------------- | ------ | ------------------------------------------------------------ |
| `UC-FE-ADM-SITES`   | UI CRUD Sites       | **M**  | Table paginée ; modal formulaire ; validation                |
| `UC-FE-ADM-ACT`     | UI CRUD Activités   | **M**  | Table ; drawer historique tarifs                             |
| `UC-FE-ADM-WORKERS` | UI MOC 600+ lignes  | **M**  | Cursor pagination ; filtres ; fiche ; import Excel drag&drop |
| `UC-FE-ADM-USERS`   | UI Users            | **M**  | CRUD ; reset MDP ; activation/désactivation                  |

### Module FE-ADMIN-PNT — Pointages UI

| UC              | User Story (résumé)                  | MoSCoW | Critères d'acceptation (résumé)                                |
| --------------- | ------------------------------------ | ------ | -------------------------------------------------------------- |
| `UC-FE-ADM-PNT` | UI consultation/correction pointages | **S**  | Table filtrable ; drawer détail ; correction motif obligatoire |

### Module FE-ADMIN-PAY — Paiements UI

| UC                   | User Story (résumé) | MoSCoW | Critères d'acceptation (résumé)                                          |
| -------------------- | ------------------- | ------ | ------------------------------------------------------------------------ |
| `UC-FE-ADM-PAY-BORD` | UI Bordereau        | **M**  | Sélection période ; table 600 lignes ; statut bio ; édition inline motif |
| `UC-FE-ADM-PAY-EXP`  | UI Export MVola     | **M**  | Bouton Exporter ; download ; historique exports                          |
| `UC-FE-ADM-PAY-IMP`  | UI Import statuts   | **M**  | Drag&drop ; preview ; résumé PAID/FAILED                                 |

### Module FE-ADMIN-REP — Reporting + Audit UI

| UC                | User Story (résumé) | MoSCoW | Critères d'acceptation (résumé)                        |
| ----------------- | ------------------- | ------ | ------------------------------------------------------ |
| `UC-FE-ADM-REP`   | UI Reporting        | **C**  | 3 rapports prédéfinis ; exports CSV/Excel/PDF via jobs |
| `UC-FE-ADM-AUDIT` | UI Audit log        | **S**  | Table paginée ; filtres ; drawer diff JSON             |

### Module FE-PWA-0 — Setup PWA

| UC                | User Story (résumé)        | MoSCoW | Critères d'acceptation (résumé)                               |
| ----------------- | -------------------------- | ------ | ------------------------------------------------------------- |
| `UC-FE-PWA-SETUP` | Init PWA + Dexie + Workbox | **M**  | manifest ; SW cache-first assets ; Dexie schema               |
| `UC-FE-PWA-AUTH`  | Login PWA offline          | **M**  | Token IndexedDB chiffré WebCrypto ; PIN déverrouillage 30 min |

---

## Sprint 4 — PWA complète + Biométrie + PDF

### Module FE-PWA-CDE — Chef d'Équipe

| UC                | User Story (résumé)        | MoSCoW | Critères d'acceptation (résumé)                                                                              |
| ----------------- | -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| `UC-FE-PWA-DAY`   | Sélection activité du jour | **M**  | Liste cache ; sélection unique ; confirmation                                                                |
| `UC-FE-PWA-BATCH` | Saisie en lot ~40 MOC      | **M**  | Photo miniature ; recherche ; champ numérique ; défaut applicable ; total prévisionnel ; < 5 min pour 40 MOC |
| `UC-FE-PWA-PHOTO` | Photo pointage             | **S**  | Camera API ; compression 1 Mo ; blob IndexedDB                                                               |

### Module FE-PWA-CDS — Chef de Service

| UC              | User Story (résumé)  | MoSCoW | Critères d'acceptation (résumé)                                   |
| --------------- | -------------------- | ------ | ----------------------------------------------------------------- |
| `UC-FE-PWA-VAL` | Validation pointages | **M**  | Liste par équipe ; indicateur bio ; actions Valider/Rejeter       |
| `UC-FE-PWA-BIO` | Contrôle biométrique | **M**  | Camera plein écran ; POST /biometric/check ; pastille OK/DOUBT/KO |

### Module FE-PWA-SYNC — Synchronisation

| UC                   | User Story (résumé) | MoSCoW | Critères d'acceptation (résumé)                                                |
| -------------------- | ------------------- | ------ | ------------------------------------------------------------------------------ |
| `UC-FE-PWA-SYNC-ENG` | Sync engine auto    | **M**  | Queue clientUuid ; ping 60s ; batch ≤100 ; retry backoff ; serveur autoritaire |
| `UC-FE-PWA-SYNC-UI`  | UI statut sync      | **M**  | Compteur attente ; dernière sync ; bouton Forcer ; log récent                  |

### Module BE-BIO — Biométrie backend

| UC                | User Story (résumé)       | MoSCoW | Critères d'acceptation (résumé)                                   |
| ----------------- | ------------------------- | ------ | ----------------------------------------------------------------- |
| `UC-BE-BIO-ADAPT` | Adapter Mock/Manual/AXIAN | **M**  | Interface BiometricProvider ; choix env BIOMETRIC_PROVIDER        |
| `UC-BE-BIO-AXIAN` | Intégration AXIAN         | **S**  | Axios + API Key ; erreurs 5xx → UNAVAILABLE ; logs BiometricCheck |

### Module BE-RPT — Rapports PDF

| UC               | User Story (résumé)         | MoSCoW | Critères d'acceptation (résumé)                       |
| ---------------- | --------------------------- | ------ | ----------------------------------------------------- |
| `UC-BE-RPT-WEEK` | PDF rapport + facture hebdo | **S**  | BullMQ ; Handlebars → Puppeteer ; MinIO ; email Admin |

---

## Sprint 5 — Données, déploiement, tests, formation

### Module OPS-DATA — Migration initiale

| UC              | User Story (résumé)     | MoSCoW | Critères d'acceptation (résumé)                                |
| --------------- | ----------------------- | ------ | -------------------------------------------------------------- |
| `UC-OPS-IMPORT` | Import données campagne | **M**  | Templates Excel ; import sites/activités/MOC ; rapport archivé |

### Module OPS-DEPLOY — Déploiement

| UC           | User Story (résumé)  | MoSCoW | Critères d'acceptation (résumé)                                    |
| ------------ | -------------------- | ------ | ------------------------------------------------------------------ |
| `UC-OPS-VPS` | Déploiement VPS prod | **M**  | Docker Compose prod ; Nginx ; TLS certbot ; backup B2 ; monitoring |

### Module QA — Assurance qualité

| UC              | User Story (résumé)  | MoSCoW | Critères d'acceptation (résumé)                            |
| --------------- | -------------------- | ------ | ---------------------------------------------------------- |
| `UC-QA-E2E`     | Tests E2E Playwright | **M**  | Parcours CDE sync ; CDS validation ; Admin bordereau MVola |
| `UC-QA-OFFLINE` | Test offline terrain | **M**  | 1 journée site pilote ; sync au retour ; bugs corrigés     |
| `UC-QA-REC`     | Recette ALTERRA      | **M**  | Session 2j ; référent ALTERRA ; corrections J+1 à J+5      |

### Module DOC — Documentation

| UC             | User Story (résumé)        | MoSCoW | Critères d'acceptation (résumé)              |
| -------------- | -------------------------- | ------ | -------------------------------------------- |
| `UC-DOC-USER`  | Guide utilisateur par rôle | **S**  | PDF 15–20 pages ; screenshots ; cas courants |
| `UC-DOC-OPS`   | Doc exploitation           | **S**  | Runbook ; backup/restore ; playbook MEP      |
| `UC-DOC-TRAIN` | Formation site pilote      | **M**  | ½ j Admin+CDS ; ½ j CDE terrain ; support S1 |

---

## Sprint 6 — Hypercare V1

### Module OPS-HYPERCARE

| UC          | User Story (résumé)         | MoSCoW | Critères d'acceptation (résumé)                     |
| ----------- | --------------------------- | ------ | --------------------------------------------------- |
| `UC-OPS-HC` | Support post-MEP 3 semaines | **M**  | Astreinte ; bugs bloquants ; hotfix ; réunion hebdo |

### Module MARGE-V1 — Réserve contingence (hors firm 50 j-h)

| UC            | User Story (résumé) | MoSCoW | Critères d'acceptation (résumé)                                                                                                                                      |
| ------------- | ------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UC-MARGE-V1` | Réserve imprévus V1 | **R**  | Contingence ~7 j-h **hors périmètre firm 50 j-h** — non comptée dans le livrable Must ; consommation sur arbitrage PO ; risques AXIAN/MVola/UX/volumétrie documentés |

---

## Won't Have V1 (explicitement V2)

| Domaine                 | UC V2                                                      | Raison report                     |
| ----------------------- | ---------------------------------------------------------- | --------------------------------- |
| NFC présence            | `UC-FE-PWA-NFC-*`, `UC-BE-NFC`                             | Web NFC Chrome Android uniquement |
| Biométrie offline       | `UC-FE-PWA-BIO-CACHE/COMP`                                 | Complexité RGPD + perf            |
| Workflows demandes      | `UC-BE-WF`, `UC-FE-PWA-CLAR/ACTREQ/WKRREQ`, `UC-FE-ADM-WF` | Admin crée directement en V1      |
| Zone/Parcelle           | `UC-BE-GEO-*`, `UC-FE-ADM-GEO`                             | Hiérarchie géo V2                 |
| Cartographie            | `UC-FE-ADM-MAP`                                            | Leaflet V2                        |
| Clôture quotidienne     | `UC-BE-DAILY`, `UC-FE-PWA-CLOSE`                           | Paiement hebdo V1                 |
| Composition équipes CDS | `UC-FE-PWA-CDS-TEAM`                                       | Admin gère équipes V1             |
| Cadrage V2              | `UC-CAD-V2`                                                | Post-recette V1                   |

---

## Mapping UC fonctionnels → backlog technique

| UC fonctionnel (spec)   | UC backlog associés                                               |
| ----------------------- | ----------------------------------------------------------------- |
| UC-01 Auth              | `UC-BE-AUTH`, `UC-FE-ADM-AUTH`, `UC-FE-PWA-AUTH`                  |
| UC-08–11 Pointage CDE   | `UC-FE-PWA-DAY/BATCH/PHOTO`, `UC-BE-PNT-SYNC`, `UC-FE-PWA-SYNC-*` |
| UC-13–17 Validation CDS | `UC-FE-PWA-VAL/BIO`, `UC-BE-PNT-VAL`, `UC-BE-BIO-*`               |
| UC-22 Clôture semaine   | `UC-BE-RPT-WEEK`                                                  |
| UC-24–27 Paiement MVola | `UC-BE-PAY-*`, `UC-FE-ADM-PAY-*`                                  |
| UC-28 Dashboard         | `UC-FE-ADM-KPI`                                                   |

---

## Critères d'acceptation globaux V1 (rappel)

- CDE : 40 pointages en < 5 minutes
- CDS : validation 120 MOC en < 90 minutes (bio incluse)
- Admin : export MVola 600 MOC en < 30 secondes
- Zéro perte de données offline
- Toute correction manuelle tracée avec motif

---

_Référence : `basedocs/ALTERRA - Backlog détaillé.md` · Spec fonctionnelle §10_
