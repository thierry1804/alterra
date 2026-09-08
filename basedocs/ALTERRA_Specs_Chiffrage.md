# ALTERRA — Spécifications Fonctionnelles & Techniques + Chiffrage

**Version:** 1.0 — 2026-05-04
**Stack retenue:** React + Vite · Node.js + Express · Prisma ORM · PostgreSQL (self-hosted)

---

## SOMMAIRE

1. [Vue d'ensemble du projet](#1-vue-densemble)
2. [Spécifications fonctionnelles — Plateforme Admin](#2-specs-fonctionnelles--admin)
3. [Spécifications fonctionnelles — PWA Chef de Site](#3-specs-fonctionnelles--pwa-chef-de-site)
4. [Spécifications techniques](#4-specs-techniques)
5. [Modèle de données](#5-modèle-de-données)
6. [API REST — Contrat d'interface](#6-api-rest)
7. [Stratégie offline (PWA)](#7-stratégie-offline)
8. [Chiffrage](#8-chiffrage)
9. [Macroplanning](#9-macroplanning)
10. [Risques & hypothèses](#10-risques--hypothèses)

---

## 1. Vue d'ensemble

### 1.1 Contexte produit

ALTERRA est un système de gestion du personnel de chantier comprenant :

- L'enregistrement centralisé des travailleurs
- Le pointage quotidien offline-first par les Chefs de Site sur le terrain
- Le calcul et la gestion des paiements hebdomadaires
- (V2) La vérification d'identité des travailleurs via l'API MVola

### 1.2 Acteurs et périmètres

| Rôle         | Interface                | Réseau requis           | Criticité offline |
| ------------ | ------------------------ | ----------------------- | ----------------- |
| Admin        | Web desktop (navigateur) | Oui (toujours connecté) | Non               |
| Chef de Site | Mobile PWA (installable) | Non (offline-first)     | **Critique**      |

### 1.3 Périmètre de livraison

| Phase | Contenu                                                 | Durée estimée |
| ----- | ------------------------------------------------------- | ------------- |
| V1    | Pointage offline-first + Admin web complet (sans MVola) | ~56 j         |
| V2-A  | + Vérification MVola numéro/nom (Hypothèse A)           | +10 j         |
| V2-B  | + Vérification MVola avec photo manuelle (Hypothèse B)  | +15 j         |
| V2-C  | + Selfie temps réel + face matching (Hypothèse C)       | +23 j         |

---

## 2. Spécifications Fonctionnelles — Plateforme Admin

### Module 1 — Gestion des Travailleurs

**F-W-01 — Création d'un travailleur**

- Champs obligatoires : Nom, Prénom, Numéro CIN, Site affecté, Taux journalier
- Champs optionnels : Numéro MVola, Photo (upload), Notes
- Validation unicité du CIN en base

**F-W-02 — Liste et recherche**

- Tableau paginé avec filtres : site, statut actif/archivé, nom
- Colonne d'actions rapides : éditer, archiver, voir historique
- Export CSV de la liste filtrée

**F-W-03 — Modification / Archivage**

- Modification de tous les champs sauf CIN (modifiable via confirmation Admin)
- Archivage logique (soft delete) : le travailleur n'apparaît plus dans les listes actives mais ses pointages sont conservés

**F-W-04 — Import CSV**

- Template CSV téléchargeable
- Upload + validation ligne par ligne avec rapport d'erreurs
- Prévisualisation avant import définitif

**F-W-05 — Fiche travailleur**

- Vue détaillée : informations, photo, historique des pointages (30 derniers jours par défaut), total semaine en cours, total mois

---

### Module 2 — Gestion des Sites

**F-S-01 — Création de site**

- Champs : Nom du site, Localisation (texte libre + coordonnées GPS optionnelles), Chef de Site responsable (select)

**F-S-02 — Liste des sites**

- Vue carte ou liste avec statut actif/inactif, nombre de travailleurs, Chef de Site

**F-S-03 — Affectation des travailleurs**

- Interface drag-and-drop ou formulaire multi-select pour affecter/désaffecter des travailleurs à un site
- Un travailleur ne peut être affecté qu'à un seul site actif à la fois

**F-S-04 — Vue site**

- Liste des travailleurs affectés
- Historique des pointages du site (par semaine)
- Présence du jour en temps réel (après sync Chef de Site)

---

### Module 3 — Gestion des Chefs de Site

**F-CS-01 — Création de compte**

- Email (identifiant unique) + mot de passe initial généré
- Attribution du ou des sites gérés
- Envoi email de bienvenue avec lien de connexion

**F-CS-02 — Gestion**

- Activation / désactivation du compte
- Réinitialisation du mot de passe par l'Admin
- Modification des sites assignés

---

### Module 4 — Gestion des Pointages

**F-P-01 — Vue consolidée**

- Tableau croisé : lignes = travailleurs, colonnes = jours de la semaine
- Filtre par site, semaine, Chef de Site
- Code couleur : présent (vert), absent (rouge), demi-journée (orange), non saisi (gris)

**F-P-02 — Correction de pointage**

- L'Admin peut modifier un pointage existant (avec traçabilité : qui a modifié, quand)
- Ajout de notes de correction

**F-P-03 — Export**

- Export CSV ou Excel de la grille de présence pour la période sélectionnée

---

### Module 5 — Gestion des Paiements

**F-PAY-01 — Génération de la liste de paiement**

- Calcul automatique : taux journalier × nombre de jours présents (présent = 1, demi-journée = 0.5, absent = 0)
- Sélection de la semaine (date début — date fin)
- Un bouton "Générer" produit la liste pour tous les travailleurs actifs du site

**F-PAY-02 — Tableau de paiement**

- Colonnes : Travailleur, Site, Jours travaillés, Montant, Numéro MVola, Statut vérification (V2), Statut paiement
- Statuts paiement : À payer / Payé / Litige
- Mise à jour du statut paiement par l'Admin manuellement (paiement effectué dans l'app MVola externe)

**F-PAY-03 — Vérification MVola (V2 — Hypothèse A)**

- Bouton "Vérifier MVola" par ligne ou en batch sur toute la liste
- Appel API MVola Customer Information → retour : nom KYC associé au numéro
- Comparaison automatique nom KYC ↔ nom ALTERRA
- Résultat affiché dans une colonne dédiée : OK (noms concordants) / ÉCART (noms différents, affichage des deux) / ERREUR (numéro non trouvé)

**F-PAY-04 — Export paiements**

- Export CSV/Excel de la liste de paiement avec tous les statuts
- Format compatible import externe si besoin

---

### Module 6 — Dashboard & Reporting

**F-D-01 — KPIs de la semaine**

- Effectif total actif
- Taux de présence global (% présents sur période)
- Masse salariale semaine en cours / mois en cours
- Nombre de pointages en attente de sync (non encore reçus)

**F-D-02 — Graphiques**

- Histogramme de présence par site sur 4 semaines
- Courbe de masse salariale sur 3 mois

**F-D-03 — Export rapport**

- Export PDF du dashboard pour une période donnée

---

## 3. Spécifications Fonctionnelles — PWA Chef de Site

### Module 1 — Authentification

**F-M-AUTH-01 — Connexion**

- Login par email + mot de passe
- Session persistante : token stocké localement, valide 7 jours
- Reconnexion automatique au démarrage si token valide (y compris offline)
- Page de login accessible offline (ne bloque pas le démarrage)

**F-M-AUTH-02 — Mot de passe oublié**

- Nécessite connexion réseau
- Lien de réinitialisation par email

---

### Module 2 — Pointage

**F-M-PTG-01 — Chargement de l'équipe**

- Au premier démarrage connecté : téléchargement et cache local de la liste complète des travailleurs du site (photos incluses)
- Mise à jour de la liste au retour de connexion (diff depuis dernière sync)

**F-M-PTG-02 — Saisie du pointage**

- Vue journalière : date du jour (modifiable sur les 3 derniers jours)
- Pour chaque travailleur : photo + nom + boutons Présent / Absent / Demi-journée
- Saisie rapide : un tap sur le statut → enregistré immédiatement en local
- Travailleur déjà pointé : son statut est pré-rempli et modifiable
- Recherche/filtre par nom dans la liste

**F-M-PTG-03 — Stockage offline**

- Chaque pointage saisi est enregistré dans IndexedDB avec horodatage client
- Statut de sync visible par pointage : icône "en attente" / "synchronisé"

**F-M-PTG-04 — Indicateur de sync global**

- Badge persistent en haut de l'écran : "N élément(s) en attente de synchronisation"
- Si N = 0 et connecté : "Tout synchronisé ✓"
- Bouton de sync manuelle visible

---

### Module 3 — Synchronisation

**F-M-SYNC-01 — Sync automatique**

- Détection de la connexion réseau → sync automatique déclenchée
- Envoi en batch de tous les pointages en attente
- Mise à jour du badge après confirmation serveur

**F-M-SYNC-02 — Sync manuelle**

- Bouton "Synchroniser maintenant" sur l'écran principal
- Feedback visuel : spinner pendant la sync, message de succès/erreur

**F-M-SYNC-03 — Gestion des conflits**

- Règle : last-write-wins sur l'horodatage client (clientTimestamp)
- En cas de conflit signalé par le serveur : affichage d'une alerte avec le détail (rare mais géré)

**F-M-SYNC-04 — Historique des syncs**

- Vue "Dernières synchronisations" : date, nombre d'éléments envoyés, statut (succès/erreur)

---

### Module 4 — Consultation

**F-M-VIEW-01 — Vue du site**

- Récapitulatif : nom du site, effectif, taux de présence du jour

**F-M-VIEW-02 — Fiche travailleur**

- Consultation de la photo, nom, numéro CIN
- Historique des 7 derniers jours de pointage

**F-M-VIEW-03 — Historique de mes pointages**

- Vue hebdomadaire des saisies effectuées par le Chef de Site connecté

---

## 4. Spécifications Techniques

### 4.1 Architecture globale

```
┌──────────────────────────────────────────────────────────────────┐
│                          CLIENT SIDE                              │
│                                                                   │
│  ┌──────────────────────┐     ┌──────────────────────────────┐   │
│  │   Admin Web App      │     │   PWA Chef de Site           │   │
│  │   React 18 + Vite    │     │   React 18 + Vite            │   │
│  │   TailwindCSS        │     │   TailwindCSS + shadcn/ui    │   │
│  │   TanStack Query     │     │   Dexie.js (IndexedDB)       │   │
│  │   React Hook Form    │     │   Workbox (Service Worker)   │   │
│  │   shadcn/ui          │     │   TanStack Query (persist)   │   │
│  │   Recharts           │     │                              │   │
│  └──────────┬───────────┘     └──────────────┬───────────────┘   │
│             │                                │                   │
└─────────────┼────────────────────────────────┼───────────────────┘
              │            HTTPS / REST API    │
              └──────────────┬─────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│                          SERVER SIDE                             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Node.js 20 LTS                        │    │
│  │              Express 4 + middleware Zod                  │    │
│  │              Auth JWT (access 15min + refresh 7j)        │    │
│  │              Multer (upload photos)                      │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────┐    │
│  │                   Prisma ORM 5.x                         │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────┐    │
│  │              PostgreSQL 16 (self-hosted)                  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Infrastructure: VPS Linux · Nginx (reverse proxy) ·             │
│                  PM2 (process manager) · Let's Encrypt (SSL)     │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Stack technique détaillée

#### Backend

| Composant         | Technologie                         | Version |
| ----------------- | ----------------------------------- | ------- |
| Runtime           | Node.js                             | 20 LTS  |
| Framework HTTP    | Express                             | 4.x     |
| ORM               | Prisma                              | 5.x     |
| Validation        | Zod                                 | 3.x     |
| Auth              | jsonwebtoken + bcrypt               | —       |
| Upload fichiers   | Multer                              | 1.x     |
| Stockage fichiers | Local filesystem (ou S3-compatible) | —       |
| Tests             | Vitest + Supertest                  | —       |
| Linter            | ESLint + Prettier                   | —       |
| Logs              | Winston ou Pino                     | —       |

#### Frontend Admin

| Composant             | Technologie                    | Version |
| --------------------- | ------------------------------ | ------- |
| Bundler               | Vite                           | 5.x     |
| Framework             | React                          | 18      |
| Routing               | React Router                   | v6      |
| State / Data fetching | TanStack Query                 | v5      |
| Formulaires           | React Hook Form + Zod          | —       |
| UI Components         | shadcn/ui                      | —       |
| Style                 | TailwindCSS                    | v3      |
| Tableaux              | TanStack Table                 | v8      |
| Graphiques            | Recharts                       | 2.x     |
| Tests                 | Vitest + React Testing Library | —       |

#### Frontend PWA Chef de Site

| Composant        | Technologie                         | Version |
| ---------------- | ----------------------------------- | ------- |
| Bundler          | Vite + vite-plugin-pwa              | 5.x     |
| Framework        | React                               | 18      |
| Service Worker   | Workbox (via vite-plugin-pwa)       | —       |
| Stockage offline | Dexie.js (IndexedDB)                | 3.x     |
| Data fetching    | TanStack Query + persistQueryClient | v5      |
| UI Components    | shadcn/ui (mobile-first)            | —       |
| Style            | TailwindCSS                         | v3      |
| Tests            | Vitest + React Testing Library      | —       |

#### Infrastructure

| Composant       | Technologie                     |
| --------------- | ------------------------------- |
| OS serveur      | Ubuntu 22.04 LTS                |
| Reverse proxy   | Nginx                           |
| Process manager | PM2                             |
| Base de données | PostgreSQL 16                   |
| SSL             | Let's Encrypt + Certbot         |
| CI/CD           | GitHub Actions (optionnel V1)   |
| Monitoring      | PM2 logs + Uptime Kuma (simple) |

### 4.3 Sécurité

- **Auth JWT** : access token 15 min (en mémoire), refresh token 7 jours (httpOnly cookie)
- **Autorisation** : middleware RBAC (`requireRole(['ADMIN'])`, `requireRole(['CHEF_DE_SITE'])`)
- **Validation** : tous les inputs validés avec Zod côté serveur avant traitement Prisma
- **Uploads** : validation MIME type + taille max (5 Mo), stockage hors dossier web
- **CORS** : origines whitelistées explicitement
- **Rate limiting** : express-rate-limit sur les endpoints d'auth
- **Helmet** : headers HTTP sécurisés
- **Logs** : aucun mot de passe ni token en clair dans les logs

---

## 5. Modèle de données

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
// UTILISATEURS
// ─────────────────────────────────────────────

model User {
  id           String     @id @default(cuid())
  email        String     @unique
  phone        String?
  passwordHash String
  role         Role
  isActive     Boolean    @default(true)
  sites        Site[]
  pointages    Pointage[] @relation("CreatedBy")
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}

enum Role {
  ADMIN
  CHEF_DE_SITE
}

// ─────────────────────────────────────────────
// SITES
// ─────────────────────────────────────────────

model Site {
  id           String     @id @default(cuid())
  name         String
  location     String?
  gpsLat       Float?
  gpsLng       Float?
  isActive     Boolean    @default(true)
  chefDeSiteId String
  chefDeSite   User       @relation(fields: [chefDeSiteId], references: [id])
  workers      Worker[]
  pointages    Pointage[]
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}

// ─────────────────────────────────────────────
// TRAVAILLEURS
// ─────────────────────────────────────────────

model Worker {
  id          String     @id @default(cuid())
  firstName   String
  lastName    String
  cinNumber   String     @unique
  mvolaNumber String?
  photoUrl    String?
  dailyRate   Decimal    @default(0) @db.Decimal(10, 2)
  isActive    Boolean    @default(true)
  siteId      String
  site        Site       @relation(fields: [siteId], references: [id])
  pointages   Pointage[]
  payments    Payment[]
  notes       String?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}

// ─────────────────────────────────────────────
// POINTAGES
// ─────────────────────────────────────────────

model Pointage {
  id              String         @id @default(cuid())
  workerId        String
  worker          Worker         @relation(fields: [workerId], references: [id])
  siteId          String
  site            Site           @relation(fields: [siteId], references: [id])
  date            DateTime       @db.Date
  status          PointageStatus
  clientTimestamp DateTime
  serverTimestamp DateTime       @default(now())
  syncedAt        DateTime?
  createdById     String
  createdBy       User           @relation("CreatedBy", fields: [createdById], references: [id])
  editedById      String?
  editedAt        DateTime?
  notes           String?

  @@unique([workerId, date])
}

enum PointageStatus {
  PRESENT
  ABSENT
  DEMI_JOURNEE
}

// ─────────────────────────────────────────────
// PAIEMENTS
// ─────────────────────────────────────────────

model Payment {
  id             String        @id @default(cuid())
  workerId       String
  worker         Worker        @relation(fields: [workerId], references: [id])
  weekStart      DateTime      @db.Date
  weekEnd        DateTime      @db.Date
  daysWorked     Decimal       @db.Decimal(4, 1)
  amount         Decimal       @db.Decimal(10, 2)
  status         PaymentStatus @default(PENDING)
  mvolaVerified  Boolean?
  mvolaKycName   String?
  mvolaVerifNote String?
  paidAt         DateTime?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@unique([workerId, weekStart])
}

enum PaymentStatus {
  PENDING
  VERIFIED
  PAID
  DISPUTE
}

// ─────────────────────────────────────────────
// AUDIT LOG (optionnel V1, recommandé V2)
// ─────────────────────────────────────────────

model AuditLog {
  id         String   @id @default(cuid())
  userId     String
  action     String
  entityType String
  entityId   String
  payload    Json?
  createdAt  DateTime @default(now())
}
```

---

## 6. API REST

### Convention

- Base URL: `https://api.alterra.mg/api/v1`
- Auth: `Authorization: Bearer <access_token>` sur tous les endpoints protégés
- Réponses: JSON `{ data, meta?, error? }`
- Pagination: `?page=1&limit=20`

### Endpoints

```
─── AUTH ───────────────────────────────────────────────────────────
POST   /auth/login                    → { accessToken, refreshToken }
POST   /auth/refresh                  → { accessToken }
POST   /auth/logout
POST   /auth/forgot-password
POST   /auth/reset-password

─── USERS (Admin only) ─────────────────────────────────────────────
GET    /users                         → liste paginée
POST   /users                         → créer Chef de Site
GET    /users/:id
PUT    /users/:id
PATCH  /users/:id/deactivate

─── SITES ───────────────────────────────────────────────────────────
GET    /sites                         → liste (Admin: tous, CDS: les siens)
POST   /sites                         → Admin only
GET    /sites/:id
PUT    /sites/:id                     → Admin only
GET    /sites/:id/workers             → travailleurs du site
GET    /sites/:id/pointages           → pointages du site (filtres: ?date, ?week)

─── WORKERS ─────────────────────────────────────────────────────────
GET    /workers                       → filtres: ?siteId, ?search, ?isActive
POST   /workers                       → Admin only
POST   /workers/import                → CSV upload, Admin only
GET    /workers/:id
PUT    /workers/:id                   → Admin only
PATCH  /workers/:id/archive           → Admin only

─── POINTAGES ───────────────────────────────────────────────────────
GET    /pointages                     → filtres: ?siteId, ?date, ?workerId, ?week
POST   /pointages                     → Chef de Site (création unique)
POST   /pointages/sync                → batch sync depuis IndexedDB (Chef de Site)
                                         body: { pointages: PointageInput[] }
                                         → { synced: [], conflicts: [], errors: [] }
PUT    /pointages/:id                 → correction Admin (avec audit)
GET    /pointages/export              → CSV (Admin)

─── PAYMENTS ────────────────────────────────────────────────────────
GET    /payments                      → filtres: ?siteId, ?weekStart, ?status
POST   /payments/generate             → body: { siteId, weekStart, weekEnd }
PUT    /payments/:id                  → mise à jour statut
GET    /payments/export               → CSV/Excel

─── MVOLA (V2) ──────────────────────────────────────────────────────
POST   /mvola/verify                  → body: { workerId } ou { mvolaNumber, expectedName }
POST   /mvola/verify-batch            → body: { paymentIds: string[] }

─── DASHBOARD ───────────────────────────────────────────────────────
GET    /dashboard/kpis                → effectif, taux présence, masse salariale
GET    /dashboard/presence-chart      → ?siteId, ?weeks=4
GET    /dashboard/payroll-chart       → ?months=3
```

### Endpoint clé — Sync batch (PWA → serveur)

```typescript
// POST /api/v1/pointages/sync
// Body
{
  "pointages": [
    {
      "localId": "uuid-local",
      "workerId": "cuid-worker",
      "siteId": "cuid-site",
      "date": "2026-05-03",
      "status": "PRESENT",
      "clientTimestamp": "2026-05-03T08:14:22.000Z"
    }
  ]
}

// Response 200
{
  "synced": [
    { "localId": "uuid-local", "serverId": "cuid-server", "status": "PRESENT" }
  ],
  "conflicts": [
    {
      "localId": "uuid-local-2",
      "reason": "ALREADY_EXISTS_NEWER",
      "serverRecord": { ... }
    }
  ],
  "errors": []
}
```

---

## 7. Stratégie Offline (PWA)

### 7.1 Service Worker — Cache des assets (Workbox)

```
Stratégie               Ressources cibles
─────────────────────── ──────────────────────────────────────────
Precache (install)      HTML shell, CSS, JS bundles, manifest
CacheFirst (7j TTL)     Photos des travailleurs (/uploads/workers/)
NetworkFirst (fallback) Données API (liste workers, historique)
StaleWhileRevalidate    Icônes, polices
```

### 7.2 Stockage local — Dexie.js (IndexedDB)

```javascript
// db.js
import Dexie from "dexie";

export const db = new Dexie("alterra_cds");

db.version(1).stores({
  workers: "id, siteId, lastName, updatedAt",
  pointages: "++localId, [workerId+date], syncStatus, clientTimestamp",
  syncQueue: "++id, type, retryCount, createdAt",
  meta: "key", // lastSyncAt, currentUser, etc.
});
```

### 7.3 Cycle de synchronisation

```
Chef de Site saisit un pointage (offline)
         │
         ▼
  Stockage IndexedDB
  { ...data, syncStatus: 'PENDING', clientTimestamp: Date.now() }
         │
         ▼
  Badge UI incrémenté ("3 en attente")
         │
  [réseau détecté ou bouton manuel]
         │
         ▼
  SyncManager.push() → POST /api/v1/pointages/sync (batch)
         │
    ┌────┴────┐
  succès    erreur réseau
    │            │
    ▼            ▼
  IndexedDB:  retry après 30s (max 5 tentatives)
  syncStatus  puis marqué 'ERROR' + alerte UI
  → 'SYNCED'
    │
    ▼
  Badge mis à jour → 0 en attente
```

### 7.4 Gestion des conflits

| Scénario                                       | Règle                                            |
| ---------------------------------------------- | ------------------------------------------------ |
| Pointage inexistant côté serveur               | → Insert direct                                  |
| Pointage existant, clientTimestamp plus récent | → Écrase le serveur                              |
| Pointage existant, clientTimestamp plus ancien | → Conflit signalé, conserve serveur, notifie CDS |
| Pointage édité par Admin entre deux syncs      | → Conflit signalé (Admin a priorité)             |

---

## 8. Chiffrage

### 8.1 Hypothèses de chiffrage

- **Profil** : développeur full-stack React/Node.js **senior expérimenté** — boilerplate existant, patterns JWT/Prisma/shadcn/ui maîtrisés, pas de phase de découverte des libs
- **TJM de référence** : à adapter selon le marché (Europe ~400-500 €/j, freelance local : à ajuster)
- **Jours** = jours de travail effectifs (8h/j), hors week-ends et jours fériés
- **Marge sur inconnus** : **+15 %** (réduit vs un profil junior — un senior calibre mieux sur des stacks qu'il connaît ; la marge couvre les imprévus métier et les allers-retours client, pas la découverte technique)
- **Hors périmètre** : coûts infra récurrents (VPS ~30-50 €/mois, domaine, certificat)

> **Pourquoi les estimations sont réduites par rapport à une version standard :**
> Un senior React/Node.js a ses templates de projet prêts, génère les CRUD Prisma en quelques minutes, pose shadcn/ui + TanStack Table sans tâtonnement. Les gains sont surtout sur le setup et les modules CRUD ; la complexité réelle (moteur sync offline, API MVola) conserve son poids.

---

### 8.2 Décomposition V1 (sans MVola)

#### Backend Node.js + Prisma

| Tâche                                                                      | Estimation (j) | Note senior                          |
| -------------------------------------------------------------------------- | -------------- | ------------------------------------ |
| Setup projet (template Express + Prisma + Zod + JWT + Helmet + rate-limit) | 1.0            | Template existant, adapté en < 1j    |
| Module Auth (login, refresh, logout, reset, RBAC middleware)               | 1.0            | Pattern JWT well-known               |
| Module Users / Chefs de Site (CRUD + activation)                           | 0.5            | CRUD Prisma standard                 |
| Module Sites (CRUD + affectation workers)                                  | 1.0            | Légèrement plus riche (relation N-N) |
| Module Workers (CRUD + import CSV + archive)                               | 2.0            | CSV avec PapaParse = rapide          |
| Module Pointages (CRUD + sync batch + résolution conflits)                 | 3.0            | Complexité réelle maintenue          |
| Module Paiements V1 (calcul auto + statuts + export CSV)                   | 1.5            | Calcul = quelques requêtes Prisma    |
| Dashboard API (KPIs + agrégats graphiques)                                 | 1.0            | GROUP BY Prisma bien maîtrisé        |
| Upload photos (Multer + service fichiers)                                  | 0.5            | Pattern connu                        |
| Tests ciblés (Vitest + Supertest — chemins critiques uniquement)           | 1.0            | Sync + auth uniquement               |
| Documentation API (OpenAPI auto via zod-openapi)                           | 0.5            |                                      |
| **Sous-total backend**                                                     | **13.0**       |                                      |

#### Frontend Admin (React + Vite)

| Tâche                                                                  | Estimation (j) | Note senior                               |
| ---------------------------------------------------------------------- | -------------- | ----------------------------------------- |
| Setup Vite + auth + layout + routing + TanStack Query                  | 1.0            | Template prêt                             |
| Module Workers (DataTable + formulaires création/édition + import CSV) | 2.5            | shadcn/ui DataTable = quasi copier-coller |
| Module Sites + Chefs de Site (liste + formulaires + affectation)       | 1.5            | Modules simples mutualisés                |
| Module Pointages (grille hebdo + corrections)                          | 1.5            | TanStack Table + logique couleurs         |
| Module Paiements V1 (tableau + statuts + export)                       | 2.0            | Logique statuts + export CSV              |
| Dashboard (KPIs + Recharts)                                            | 1.5            | 2-3 composants Recharts standards         |
| Tests composants critiques                                             | 1.0            |                                           |
| **Sous-total frontend Admin**                                          | **11.0**       |                                           |

#### PWA Chef de Site (React + Workbox + Dexie.js)

| Tâche                                                        | Estimation (j) | Note senior                     |
| ------------------------------------------------------------ | -------------- | ------------------------------- |
| Setup PWA (vite-plugin-pwa, manifest, Workbox config)        | 2.0            | Non trivial même pour un senior |
| Auth offline-capable (session persistante IndexedDB)         | 1.0            |                                 |
| Chargement + cache liste travailleurs (photos)               | 1.5            |                                 |
| Interface pointage mobile (UI tactile, swipe, feedback)      | 2.5            | UX mobile demande soin          |
| Moteur sync offline (Dexie.js, syncQueue, batch push, retry) | 3.5            | Complexité réelle maintenue     |
| Gestion conflits côté client + alertes UI                    | 1.0            |                                 |
| Indicateur sync (badge + historique)                         | 0.5            |                                 |
| Tests mobile + simulation offline (DevTools + mode avion)    | 1.0            |                                 |
| **Sous-total PWA**                                           | **13.0**       |                                 |

#### Infrastructure & DevOps

| Tâche                                                  | Estimation (j) |
| ------------------------------------------------------ | -------------- |
| Setup VPS (Nginx, PM2, PostgreSQL, SSL Let's Encrypt)  | 1.0            |
| Backups DB (cron pg_dump vers B2/S3) + variables d'env | 0.5            |
| **Sous-total infra**                                   | **1.5**        |

#### Gestion de projet & recette

| Tâche                                         | Estimation (j) |
| --------------------------------------------- | -------------- |
| Coordination + réunions client                | 1.5            |
| Recette fonctionnelle + corrections (2 tours) | 2.5            |
| **Sous-total PM/QA**                          | **4.0**        |

---

### 8.3 Synthèse V1

| Poste                       | Estimation brute |
| --------------------------- | ---------------- |
| Backend                     | 13.0 j           |
| Frontend Admin              | 11.0 j           |
| PWA Chef de Site            | 13.0 j           |
| Infrastructure              | 1.5 j            |
| PM / QA                     | 4.0 j            |
| **Total brut V1**           | **42.5 j**       |
| **Marge inconnues (+15 %)** | **+6.5 j**       |
| **Total V1 avec marge**     | **~49 j**        |

> Avec deux profils en parallèle (1 back + 1 front/PWA), le délai calendaire passe à ~30 j soit ~6 semaines.

---

### 8.4 Modules V2 — MVola

#### Hypothèse A — Vérification numéro / nom KYC

| Tâche                                                  | Estimation brute |
| ------------------------------------------------------ | ---------------- |
| Intégration API MVola Customer Information (back)      | 1.5 j            |
| Endpoints `/mvola/verify` + `/mvola/verify-batch`      | 1.0 j            |
| Gestion erreurs MVola (timeout, numéro inconnu, retry) | 0.5 j            |
| Frontend Admin : colonne vérif + bouton batch          | 1.5 j            |
| Tests                                                  | 0.5 j            |
| **Sous-total brut Hyp. A**                             | **5.0 j**        |
| **Marge +15 %**                                        | **+1.0 j**       |
| **Total V2-A**                                         | **~6 j**         |

#### Hypothèse B — Comparaison manuelle de photos (KYC MVola vs photo ALTERRA)

| Tâche                                               | Estimation brute |
| --------------------------------------------------- | ---------------- |
| Tout Hyp. A                                         | 5.0 j            |
| Récupération + stockage photo KYC MVola             | 1.0 j            |
| Vue Admin : comparaison côte-à-côte des deux photos | 1.5 j            |
| Statuts "photo conforme / à vérifier"               | 0.5 j            |
| **Sous-total brut Hyp. B**                          | **8.0 j**        |
| **Marge +15 %**                                     | **+1.5 j**       |
| **Total V2-B**                                      | **~10 j**        |

#### Hypothèse C — Selfie temps réel + face matching automatique

| Tâche                                                             | Estimation brute |
| ----------------------------------------------------------------- | ---------------- |
| Tout Hyp. B                                                       | 8.0 j            |
| Capture selfie PWA (API camera + compression)                     | 1.5 j            |
| Intégration service face matching (AWS Rekognition ou Azure Face) | 3.5 j            |
| Gestion offline du selfie (queue d'envoi + retry)                 | 2.5 j            |
| UI résultat matching + seuil de confiance configurable            | 1.5 j            |
| **Sous-total brut Hyp. C**                                        | **17.0 j**       |
| **Marge +15 %**                                                   | **+3.0 j**       |
| **Total V2-C**                                                    | **~20 j**        |

---

### 8.5 Récapitulatif général

| Scénario  | Total jours (avec marge) | Calendrier 1 dev | Calendrier 2 devs |
| --------- | ------------------------ | ---------------- | ----------------- |
| V1 seule  | **~49 j**                | **~2.5 mois**    | **~1.5 mois**     |
| V1 + V2-A | **~55 j**                | **~2.8 mois**    | **~1.8 mois**     |
| V1 + V2-B | **~59 j**                | **~3 mois**      | **~1.9 mois**     |
| V1 + V2-C | **~69 j**                | **~3.5 mois**    | **~2.2 mois**     |

### 8.6 Charges complémentaires (hors développement)

| Poste                                   | Coût mensuel estimé      | Note                                 |
| --------------------------------------- | ------------------------ | ------------------------------------ |
| VPS serveur (2 vCPU, 4 Go RAM)          | 20-40 €/mois             | Hetzner, OVH, ou équivalent local    |
| Domaine + DNS                           | ~15 €/an                 |                                      |
| SSL                                     | Gratuit                  | Let's Encrypt                        |
| Backups externes (B2 / S3)              | ~5 €/mois                |                                      |
| Monitoring (Uptime Kuma)                | Gratuit (self-hosted)    |                                      |
| API MVola (V2)                          | Selon tarification MVola | À confirmer avec l'opérateur         |
| Service face matching (V2-C uniquement) | ~0.001 $/image           | AWS Rekognition (très faible volume) |

---

## 9. Macroplanning

### V1 — Planning recommandé (1 développeur senior)

```
SEMAINE    1    2    3    4    5    6    7    8    9   10   11   12
           ▼────────────────────────────────────────────────────────
JALONS

S01        ██ Setup infra + VPS + DB + structure projet
S01-S03    ████████ Backend : auth, users, sites, workers, upload
S03-S05         ████████ Backend : pointages (sync batch), paiements, dashboard API
S04-S06              ████████ Admin Frontend : setup + workers + sites + CDS
S06-S08                   ████████ Admin Frontend : pointages + paiements + dashboard
S05-S08              ████████████ PWA : setup PWA + auth offline + workers cache
S07-S09                       ████████ PWA : pointage UI + moteur sync offline
S09-S10                                ████ Intégration end-to-end + tests offline terrain
S10        ─────────────────────────────────── LIVRAISON V1 (staging)
S10-S11                                        ████ Recette client + corrections
S11        ────────────────────────────────────────── LIVRAISON V1 (production)
S12-S13                                              ████ V2-A MVola (~6j)
S13        ─────────────────────────────────────────────── LIVRAISON V2-A
```

> Avec **2 devs en parallèle** (1 back + 1 front/PWA dès S3) : livraison V1 dès **S7-S8**.

### Jalons clés

| Jalon                     | Semaine | Livrable                                      |
| ------------------------- | ------- | --------------------------------------------- |
| M1 — Environnement prêt   | S1 fin  | Serveur, BDD, auth fonctionnelle              |
| M2 — Backend V1 complet   | S5      | Tous les endpoints + tests critiques          |
| M3 — Admin Web V1         | S8      | Interface Admin fonctionnelle en staging      |
| M4 — PWA V1               | S9      | PWA installable, sync offline validé terrain  |
| M5 — Livraison staging    | S10     | **V1 complète en staging**                    |
| M6 — Livraison production | S11     | **V1 en production**                          |
| M7 — V2-A MVola           | S13     | Module vérification MVola (si Hyp. A retenue) |

### Recommandations planning

1. **Test terrain obligatoire avant recette** (S9) : le Chef de Site doit tester la PWA en mode avion sur un vrai chantier — c'est le seul moyen de valider le cycle offline → sync dans des conditions réelles (signal instable, interruptions, redémarrage de l'app).
2. **Ne pas commencer V2 avant V1 en production** : le module MVola nécessite des travailleurs avec de vrais numéros MVola renseignés — impossible à tester sans données de production.
3. **Un seul dev = back d'abord, front ensuite** : le front Admin peut démarrer dès que les endpoints Workers et Sites sont stables (S4), sans attendre la fin du backend complet.

---

## 10. Risques & Hypothèses

| #   | Risque                                                                          | Probabilité | Impact | Mitigation                                                         |
| --- | ------------------------------------------------------------------------------- | ----------- | ------ | ------------------------------------------------------------------ |
| R1  | API MVola non documentée / accès restreint                                      | Moyen       | Élevé  | Confirmer l'accès API et la sandbox MVola avant de démarrer V2     |
| R2  | Contraintes réseau plus sévères que prévu (pas de réseau du tout ≠ réseau lent) | Moyen       | Élevé  | Tester le mode offline dès S9 sur terrain réel                     |
| R3  | Expertise PWA/offline insuffisante chez le dev retenu                           | Moyen       | Élevé  | Valider les compétences sur Dexie.js + Workbox avant contrat       |
| R4  | Variabilité des navigateurs mobiles (Safari iOS vs Chrome Android)              | Moyen       | Moyen  | Tester sur les deux dès S10 ; Service Worker iOS a des limitations |
| R5  | Import CSV avec données mal formatées                                           | Faible      | Faible | Prévoir validation robuste + template strict                       |
| R6  | Dépassement de délai sur le moteur de sync (conflits complexes)                 | Moyen       | Moyen  | La marge de 25 % couvre ce risque ; scope à réduire si nécessaire  |
| R7  | Coût VPS + infra sous-estimé                                                    | Faible      | Faible | Prévoir 60-80 €/mois pour être large                               |

### Hypothèses retenues pour ce chiffrage

- L'Admin dispose d'un PC de bureau avec navigateur moderne (Chrome/Firefox/Edge récent)
- Les Chefs de Site disposent de smartphones Android ou iOS récents (2020+)
- L'accès API MVola (Customer Information) est disponible et documenté pour les partenaires
- Le déploiement est sur un VPS Linux standard (pas de contrainte réseau enterprise complexe)
- La MVP n'inclut pas de notifications push (ajout facile en V2+ via Web Push API)
- L'authentification par OTP SMS n'est pas dans le scope V1 (email + mot de passe suffit ; OTP optionnel en V2)

```

```
