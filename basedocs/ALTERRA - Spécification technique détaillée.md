# ALTERRA — Spécification technique détaillée

**Architecture, stack, modèle de données, API REST, sécurité, déploiement**

Document de référence pour l'équipe de développement.
Préparé par : Thierry — NextA. 28 avril 2026 — v1.0.

---

## 1. Introduction

### 1.1 Objet

Ce document détaille les choix techniques d'implémentation de la plateforme ALTERRA. Il complète la spécification fonctionnelle (comportement attendu) et le backlog (découpage en user stories).

Il est destiné aux développeurs, tech leads, DevOps et à toute personne devant contribuer au code ou à l'infrastructure.

### 1.2 Portée

Le périmètre couvre la V1 (cœur, 12 semaines) et la V2 (extensions terrain, 5 semaines). Les éléments spécifiques V2 sont explicitement marqués.

### 1.3 Conventions

- Les blocs de code utilisent la police monospace dans les blocs Markdown.
- Les commandes shell sont préfixées par `$`.
- Les endpoints API sont notés `MÉTHODE /chemin`.
- Les identifiants de règles métier (RG-XX) et cas d'usage (UC-XX) sont ceux de la spec fonctionnelle.

---

## 2. Architecture d'ensemble

### 2.1 Vue en six tiers

Monolithe modulaire NestJS sur un VPS unique, séparé en six tiers logiques dont quatre coexistent sur le même serveur au démarrage.

| Tier           | Composants                                            | Rôle                                                                                         |
| -------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1. Clients     | Smartphones Android + Desktop                         | Trois profils (CDE, CDS, Admin) avec leurs frontends dédiés.                                 |
| 2. DMZ         | DNS + Nginx + TLS Let's Encrypt                       | Terminaison TLS, reverse proxy, rate limiting, servir assets SPA.                            |
| 3. Application | NestJS + BullMQ workers                               | Logique métier organisée en modules NestJS. Jobs async pour PDF, biométrie batch, paiements. |
| 4. Données     | PostgreSQL + MinIO + Redis                            | Source de vérité, stockage objet, queue et cache.                                            |
| 5. Externes    | AXIAN + Telma SMS + Mailgun + MVola + Backblaze B2    | Biométrie, notifications, paiement (manuel), backup.                                         |
| 6. Ops         | Pino + Healthchecks.io + UptimeRobot + GitHub Actions | Logs, monitoring externe, CI/CD.                                                             |

### 2.2 Principes directeurs

- **Souveraineté** : aucune donnée métier ne quitte l'infrastructure ALTERRA sauf appels contrôlés vers AXIAN et Telma.
- **Offline-first** : la PWA est autonome pendant une journée sans réseau.
- **Idempotence** : toute mutation client-serveur est idempotente via `clientUuid`.
- **RBAC double niveau** : vérification en Guards NestJS + filtrage Prisma automatique par site/équipe.
- **Adapter pattern** : services externes derrière une interface, implémentations interchangeables.
- **Modularité NestJS** : chaque bounded context = un module autonome avec ses guards, DTOs, services.

---

## 3. Stack technique détaillée

### 3.1 Composants et versions

| Composant                              | Version             | Justification                                                           |
| -------------------------------------- | ------------------- | ----------------------------------------------------------------------- |
| Node.js                                | 20 LTS              | LTS jusqu'à avril 2026, performances, écosystème NestJS mature.         |
| NestJS                                 | 10.x                | Framework structuré (modules, DI, guards, interceptors), OpenAPI natif. |
| Fastify (via @nestjs/platform-fastify) | 4.x                 | Adapter HTTP plus performant qu'Express pour NestJS.                    |
| Prisma ORM                             | 5.x                 | Type-safe, migrations, generator client, RLS middleware.                |
| PostgreSQL                             | 16                  | Support types avancés (JSON, GIST pour geo), triggers, extensions.      |
| Redis                                  | 7                   | Backend BullMQ, cache session, rate limiting distribué.                 |
| BullMQ                                 | 5.x                 | Jobs asynchrones robustes (PDF, biométrie lot, paiements).              |
| MinIO                                  | dernière stable     | S3-compatible, containerisable, pré-signed URLs.                        |
| React                                  | 18.x                | Standard du marché, écosystème riche, hooks stables.                    |
| Vite                                   | 5.x                 | Build ultra-rapide, HMR excellent, meilleure DX que webpack.            |
| TypeScript                             | 5.x                 | Strict mode partout, types partagés via package api-types.              |
| Tailwind CSS                           | 3.x                 | Utility-first, cohérence design, bundle réduit.                         |
| shadcn/ui                              | dernière            | Composants React accessibles, personnalisables, copiés dans le code.    |
| TanStack Query                         | 5.x                 | Server state, cache HTTP intelligent, retry, invalidation.              |
| Dexie.js                               | 4.x                 | Wrapper IndexedDB avec API promises, transactions, requêtes.            |
| Workbox                                | via vite-plugin-pwa | Génération Service Worker, stratégies de cache.                         |
| Zod                                    | 3.x                 | Validation runtime des DTOs, inférence de types.                        |
| Pino                                   | 9.x                 | Logs JSON structurés, très performant.                                  |
| face-api.js (V2)                       | 0.22.x              | Face matching embarqué léger (TinyFace ~1 Mo).                          |
| Leaflet (V2)                           | 1.9.x               | Cartographie web open-source, léger, extensible.                        |
| Docker                                 | 25+                 | Containerisation, Docker Compose pour orchestration simple.             |
| Nginx                                  | 1.24+               | Reverse proxy, TLS, gzip, servir statiques.                             |

### 3.2 Structure des repositories

Monorepo pnpm workspaces avec Turborepo léger :

```
alterra/
├── apps/
│   ├── admin/          # Web App Admin (Vite + React)
│   ├── pwa/            # PWA Terrain (Vite + React + vite-plugin-pwa)
│   └── api/            # Backend NestJS
├── packages/
│   ├── ui/             # Composants React partagés (shadcn/ui)
│   ├── api-types/      # Types TypeScript partagés (DTOs, enums)
│   ├── config/         # Configs ESLint, tsconfig, Tailwind partagées
│   └── utils/          # Utilitaires (formatAriary, date, validation)
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── infra/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── nginx.conf
│   └── scripts/        # deploy, backup, restore
├── .github/workflows/  # CI/CD
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 4. Modèle de données

### 4.1 Schéma Prisma

Le schéma ci-dessous est la source de vérité. Toutes les entités ont `createdAt` et `updatedAt` automatiques.

#### 4.1.1 Enums

```prisma
enum Role { ADMIN CHEF_SERVICE CHEF_EQUIPE }
enum WorkerStatus { ACTIVE INACTIVE SUSPENDED }
enum PointageStatus { PENDING VALIDATED REJECTED NEEDS_CLARIFICATION }
enum PaymentStatus { PENDING EXPORTED PAID FAILED }
enum PaymentCycle { WEEKLY DAILY }
enum BioContext { POINTAGE_TASK WEEKLY_VALIDATION }
enum BioResult { OK DOUBT KO UNAVAILABLE }
enum BioProvider { AXIAN MANUAL MOCK LOCAL_OFFLINE }
enum RequestStatus { PENDING APPROVED REJECTED }
enum ClarificationStatus { OPEN ANSWERED CLOSED }
enum PresenceSource { NFC MANUAL }
```

#### 4.1.2 User

```prisma
model User {
  id           String   @id @default(uuid()) @db.Uuid
  email        String?  @unique
  phone        String?  @unique
  passwordHash String
  role         Role
  firstName    String
  lastName     String
  active       Boolean  @default(true)
  mfaSecret    String?  // TOTP secret chiffré
  siteId       String?  @db.Uuid
  site         Site?    @relation(fields: [siteId], references: [id])
  teamId       String?  @db.Uuid
  team         Team?    @relation(fields: [teamId], references: [id])
  lastLoginAt  DateTime?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  deletedAt    DateTime?
  @@index([email])
  @@index([role, siteId])
}
```

#### 4.1.3 Site, Zone, Parcelle, Team

```prisma
model Site {
  id           String   @id @default(uuid()) @db.Uuid
  name         String
  shortCode    String   @unique // MNK, ANT, ANJ, MGT, AMB
  location     String?
  geoLat       Float?
  geoLng       Float?
  active       Boolean  @default(true)
  zones        Zone[]
  teams        Team[]
  workers      Worker[]
  users        User[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model Zone {  // V2
  id           String     @id @default(uuid()) @db.Uuid
  siteId       String     @db.Uuid
  site         Site       @relation(fields: [siteId], references: [id])
  name         String
  geoPolygon   Json?      // GeoJSON Polygon
  parcelles    Parcelle[]
  createdAt    DateTime   @default(now())
  @@unique([siteId, name])
}

model Parcelle {  // V2
  id           String   @id @default(uuid()) @db.Uuid
  zoneId       String   @db.Uuid
  zone         Zone     @relation(fields: [zoneId], references: [id])
  name         String
  geoPolygon   Json?
  surfaceHa    Decimal? @db.Decimal(10, 2)
  pointages    Pointage[]
  @@unique([zoneId, name])
  @@index([zoneId])
}

model Team {
  id           String   @id @default(uuid()) @db.Uuid
  siteId       String   @db.Uuid
  site         Site     @relation(fields: [siteId], references: [id])
  name         String
  chefId       String?  @db.Uuid
  active       Boolean  @default(true)
  workers      Worker[]
  users        User[]
  createdAt    DateTime @default(now())
  @@unique([siteId, name])
}
```

#### 4.1.4 Activity

```prisma
model Activity {
  id          String    @id @default(uuid()) @db.Uuid
  label       String
  unit        String    // trou, m², plant, kg
  unitRate    Decimal   @db.Decimal(12, 2)
  validFrom   DateTime  @db.Date
  validTo     DateTime? @db.Date
  siteId      String?   @db.Uuid // null = global
  active      Boolean   @default(true)
  pointages   Pointage[]
  createdAt   DateTime  @default(now())
  @@index([siteId, active])
  @@index([validFrom, validTo])
}
```

#### 4.1.5 Worker (MOC)

```prisma
model Worker {
  id             String   @id @default(uuid()) @db.Uuid
  matricule      String   @unique
  firstName      String
  lastName       String
  birthDate      DateTime? @db.Date
  maritalStatus  String?
  childrenCount  Int?
  mvolaNumber    String   @unique
  cinNumber      String?
  photoKey       String?  // clé MinIO photo KYC ALTERRA
  siteId         String   @db.Uuid
  site           Site     @relation(fields: [siteId], references: [id])
  teamId         String?  @db.Uuid
  team           Team?    @relation(fields: [teamId], references: [id])
  status         WorkerStatus @default(ACTIVE)
  hiredAt        DateTime @db.Date
  badge          Badge?   // V2
  pointages      Pointage[]
  presences      PresenceRecord[] // V2
  payments       Payment[]
  bioChecks      BiometricCheck[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  deletedAt      DateTime?
  @@index([siteId, teamId, status])
  @@index([firstName, lastName])
  @@index([mvolaNumber])
}
```

#### 4.1.6 Pointage

```prisma
model Pointage {
  id                String    @id @default(uuid()) @db.Uuid
  clientUuid        String    @unique @db.Uuid  // anti-doublon idempotence
  workerId          String    @db.Uuid
  worker            Worker    @relation(fields: [workerId], references: [id])
  activityId        String    @db.Uuid
  activity          Activity  @relation(fields: [activityId], references: [id])
  quantity          Decimal   @db.Decimal(10, 2)
  unitRateSnapshot  Decimal   @db.Decimal(12, 2)  // tarif figé RG-04
  amount            Decimal   @db.Decimal(12, 2)  // = quantity × unitRateSnapshot
  date              DateTime  @db.Date
  parcelleId        String?   @db.Uuid  // V2
  parcelle          Parcelle? @relation(fields: [parcelleId], references: [id])
  geoLat            Float?
  geoLng            Float?
  photoKey          String?
  notes             String?
  status            PointageStatus @default(PENDING)
  enteredById       String    @db.Uuid
  validatedById     String?   @db.Uuid
  validatedAt       DateTime?
  rejectionReason   String?
  bioCheckId        String?   @db.Uuid
  createdByClientAt DateTime  // horodatage côté PWA
  syncedAt          DateTime  @default(now())
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  @@index([workerId, date])
  @@index([status, date])
  @@index([parcelleId, date])
}
```

#### 4.1.7 PresenceRecord (V2)

```prisma
model PresenceRecord {
  id                String   @id @default(uuid()) @db.Uuid
  clientUuid        String   @unique @db.Uuid
  workerId          String   @db.Uuid
  worker            Worker   @relation(fields: [workerId], references: [id])
  date              DateTime @db.Date
  arrivalTime       DateTime
  badgeNfcTagId     String
  scannedById       String   @db.Uuid
  source            PresenceSource
  parcelleId        String?  @db.Uuid
  createdByClientAt DateTime
  syncedAt          DateTime @default(now())
  @@index([workerId, date])
  @@index([date, parcelleId])
}
```

#### 4.1.8 Badge (V2)

```prisma
model Badge {
  id           String    @id @default(uuid()) @db.Uuid
  workerId     String    @unique @db.Uuid
  worker       Worker    @relation(fields: [workerId], references: [id])
  nfcTagId     String    @unique
  assignedAt   DateTime  @default(now())
  revokedAt    DateTime?
}
```

#### 4.1.9 BiometricCheck et BiometricTemplate

```prisma
model BiometricCheck {
  id            String       @id @default(uuid()) @db.Uuid
  workerId      String       @db.Uuid
  worker        Worker       @relation(fields: [workerId], references: [id])
  context       BioContext
  result        BioResult
  score         Float?
  provider      BioProvider
  performedById String       @db.Uuid
  performedAt   DateTime     @default(now())
  weekIso       String?      // ex: 2026-W18
  rawResponse   Json?        // logs AXIAN (audit)
  @@index([workerId, weekIso])
  @@index([performedAt])
}

model BiometricTemplate {  // V2
  id           String   @id @default(uuid()) @db.Uuid
  workerId     String   @unique @db.Uuid
  templateData Bytes    // chiffré AES-256 côté API
  source       BioProvider
  capturedAt   DateTime
  expiresAt    DateTime
  createdAt    DateTime @default(now())
}
```

#### 4.1.10 Payment

```prisma
model Payment {
  id               String        @id @default(uuid()) @db.Uuid
  workerId         String        @db.Uuid
  worker           Worker        @relation(fields: [workerId], references: [id])
  periodIso        String        // Sxx ou Dxxx
  cycle            PaymentCycle
  amount           Decimal       @db.Decimal(12, 2)
  description      String        // "Prénom Paiement Code_site"
  bioValid         Boolean
  status           PaymentStatus @default(PENDING)
  exportedAt       DateTime?
  paidAt           DateTime?
  failureReason    String?
  correctionReason String?  // si modifié manuellement
  originalAmount   Decimal? @db.Decimal(12, 2)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  @@index([workerId, periodIso])
  @@index([status, periodIso])
}
```

#### 4.1.11 Modèles workflows V2

```prisma
model ActivityRequest {
  id                String        @id @default(uuid()) @db.Uuid
  proposedLabel     String
  proposedUnit      String
  proposedRate      Decimal       @db.Decimal(12, 2)
  justification     String        @db.Text
  requestedById     String        @db.Uuid
  siteId            String?       @db.Uuid
  status            RequestStatus @default(PENDING)
  decisionById      String?       @db.Uuid
  decisionAt        DateTime?
  decisionReason    String?
  createdActivityId String?       @db.Uuid
  createdAt         DateTime      @default(now())
  @@index([status, createdAt])
}

model WorkerRequest {
  id               String        @id @default(uuid()) @db.Uuid
  firstName        String
  lastName         String
  cinNumber        String?
  mvolaNumber      String
  proposedPhotoKey String?
  targetTeamId     String?       @db.Uuid
  justification    String        @db.Text
  requestedById    String        @db.Uuid
  status           RequestStatus @default(PENDING)
  decisionById     String?       @db.Uuid
  decisionAt       DateTime?
  decisionReason   String?
  createdWorkerId  String?       @db.Uuid
  createdAt        DateTime      @default(now())
  @@index([status, createdAt])
}

model ClarificationRequest {
  id             String              @id @default(uuid()) @db.Uuid
  pointageId     String              @db.Uuid
  question       String              @db.Text
  requestedPhoto Boolean             @default(false)
  status         ClarificationStatus @default(OPEN)
  answerText     String?             @db.Text
  answerPhotoKey String?
  requestedById  String              @db.Uuid
  answeredById   String?             @db.Uuid
  answeredAt     DateTime?
  resolvedAt     DateTime?
  createdAt      DateTime            @default(now())
  @@index([pointageId])
  @@index([status, createdAt])
}
```

#### 4.1.12 AuditLog

```prisma
model AuditLog {
  id           BigInt   @id @default(autoincrement())
  userId       String?  @db.Uuid
  action       String   // CREATE, UPDATE, DELETE, LOGIN, EXPORT, ...
  entityType   String   // Worker, Pointage, Payment, ...
  entityId     String?
  before       Json?
  after        Json?
  ip           String?
  userAgent    String?
  createdAt    DateTime @default(now())
  @@index([userId, createdAt])
  @@index([entityType, entityId])
  @@index([createdAt])
}
```

### 4.2 Contraintes et triggers PostgreSQL

- Trigger d'audit sur `Worker`, `Pointage`, `Payment` : capture avant/après dans `AuditLog` automatiquement.
- Contrainte CHECK sur `Pointage.amount = quantity * unitRateSnapshot`.
- Extension `pgcrypto` pour `uuid_generate_v4()` (fallback si Prisma ne le fournit pas).
- Extension `postgis` optionnelle en V2 pour requêtes GIST sur `geoPolygon`.

---

## 5. API REST

### 5.1 Principes généraux

- **Versionnage** : préfixe `/api/v1/`. Toute breaking change → `/api/v2/`.
- **Format** : JSON UTF-8. `Content-Type: application/json`.
- **Authentification** : Bearer JWT (`Authorization: Bearer <token>`). Refresh en cookie HttpOnly Secure SameSite=Strict.
- **Erreurs** : structure `{ code, message, details?, traceId }`. Codes HTTP standards + codes métier (cf. spec fonctionnelle §9).
- **Pagination** : cursor-based. Réponse `{ data, nextCursor, hasMore, total? }`.
- **Validation** : Zod côté DTOs, class-validator via NestJS pipes. 422 si validation échoue.
- **Rate limiting** : Redis-backed. 10 login/IP/5min, 1000 req générique/user/min.
- **OpenAPI** : auto-généré via `@nestjs/swagger`, accessible sur `/api/docs` (Admin only en prod).

### 5.2 Table des endpoints

| Méthode            | Endpoint                              | Rôle requis                     | Description                          |
| ------------------ | ------------------------------------- | ------------------------------- | ------------------------------------ |
| POST               | `/api/v1/auth/login`                  | Public                          | Retourne JWT access + refresh cookie |
| POST               | `/api/v1/auth/refresh`                | Refresh cookie                  | Nouveau access token                 |
| POST               | `/api/v1/auth/logout`                 | Auth                            | Révoque refresh, blacklist Redis     |
| POST               | `/api/v1/auth/password-reset`         | Public                          | Envoie email lien                    |
| POST               | `/api/v1/auth/password-reset/confirm` | Public + token                  | Change mot de passe                  |
| GET                | `/api/v1/me`                          | Auth                            | Info du user connecté                |
| GET                | `/api/v1/sites`                       | Auth                            | Filtré par périmètre user            |
| POST               | `/api/v1/sites`                       | ADMIN                           | Crée un site                         |
| GET/POST/PATCH/DEL | `/api/v1/activities`                  | ADMIN (écr), Auth (lect)        | CRUD activités + versioning tarif    |
| GET/POST/PATCH/DEL | `/api/v1/workers`                     | ADMIN (écr), Auth (lect scoped) | CRUD MOC                             |
| POST               | `/api/v1/workers/import`              | ADMIN                           | Import Excel avec preview            |
| GET/POST/PATCH/DEL | `/api/v1/teams`                       | ADMIN, CHEF_SERVICE (V2)        | Composition équipes                  |
| GET/POST/PATCH/DEL | `/api/v1/users`                       | ADMIN                           | Gestion comptes                      |
| POST               | `/api/v1/pointages/sync`              | CHEF_EQUIPE                     | Batch push idempotent (100 max)      |
| GET                | `/api/v1/pointages`                   | Auth (scoped)                   | Cursor pagination                    |
| PATCH              | `/api/v1/pointages/:id`               | ADMIN                           | Correction avec motif                |
| PATCH              | `/api/v1/pointages/:id/validate`      | CHEF_SERVICE                    | Validation unitaire                  |
| PATCH              | `/api/v1/pointages/:id/reject`        | CHEF_SERVICE                    | Rejet avec motif                     |
| POST               | `/api/v1/pointages/bulk-validate`     | CHEF_SERVICE                    | Validation en lot (V2)               |
| POST               | `/api/v1/presence/sync`               | CHEF_EQUIPE (V2)                | Push présences NFC                   |
| POST               | `/api/v1/biometric/check`             | CHEF_SERVICE                    | Contrôle bio online                  |
| POST               | `/api/v1/biometric/check-offline`     | CHEF_EQUIPE (V2)                | Remontée résultat local              |
| GET                | `/api/v1/biometric/templates/sync`    | CHEF_EQUIPE (V2)                | Pré-fetch templates                  |
| POST               | `/api/v1/reports/weekly`              | CHEF_SERVICE                    | Génère rapport + facture             |
| POST               | `/api/v1/reports/daily`               | CHEF_SERVICE (V2)               | Rapport journalier                   |
| POST               | `/api/v1/payments/generate`           | ADMIN                           | Bordereau semaine/jour               |
| PATCH              | `/api/v1/payments/:id`                | ADMIN                           | Correction montant                   |
| GET                | `/api/v1/payments/:periodIso/export`  | ADMIN                           | Télécharger Excel MVola              |
| POST               | `/api/v1/payments/import-status`      | ADMIN                           | Import retour MVola                  |
| GET/POST/PATCH     | `/api/v1/activity-requests`           | CHEF_SERVICE, ADMIN (V2)        | Workflow demandes                    |
| GET/POST/PATCH     | `/api/v1/worker-requests`             | CHEF_SERVICE, ADMIN (V2)        | Idem MOC                             |
| GET/POST/PATCH     | `/api/v1/clarification-requests`      | CHEF_SERVICE, CHEF_EQUIPE (V2)  | Précisions                           |
| POST               | `/api/v1/uploads/sign`                | Auth                            | URL pré-signée MinIO                 |
| GET                | `/api/v1/audit-log`                   | ADMIN                           | Consultation                         |
| GET                | `/api/v1/dashboard/kpi`               | ADMIN                           | KPIs temps réel                      |
| GET                | `/api/v1/sites/geo`                   | ADMIN (V2)                      | Données cartographie                 |

### 5.3 DTOs principaux

#### 5.3.1 Login

```typescript
// POST /api/v1/auth/login
Request : { email: string, password: string, mfaCode?: string }
Response 200 : { accessToken: string, user: UserSelf }
+ Set-Cookie: refreshToken=... HttpOnly Secure SameSite=Strict Max-Age=604800
```

#### 5.3.2 Sync pointages

```typescript
// POST /api/v1/pointages/sync
Request : {
  batch: Array<{
    clientUuid: string  // UUID v7
    workerId: string
    activityId: string
    quantity: number
    date: string        // ISO date
    parcelleId?: string  // V2
    geoLat?: number
    geoLng?: number
    notes?: string
    createdByClientAt: string  // ISO datetime
  }>
}

Response 200 : {
  results: Array<{
    clientUuid: string
    status: 'created' | 'already_exists' | 'rejected'
    id?: string
    reason?: string  // si rejected
  }>
}
```

#### 5.3.3 Génération paiement

```typescript
// POST /api/v1/payments/generate
Request : { periodIso: string, cycle: 'WEEKLY' | 'DAILY' }
Response 200 : {
  bordereau: {
    periodIso: string
    totalAmount: number
    lineCount: number
    lines: PaymentLine[]
  }
}
```

#### 5.3.4 Contrôle biométrique

```typescript
// POST /api/v1/biometric/check
Request : multipart/form-data
  workerId: string
  photo: File  // JPEG 1 Mo max

Response 200 : {
  result: 'OK' | 'DOUBT' | 'KO' | 'UNAVAILABLE'
  score?: number  // 0-1
  checkId: string
  provider: 'AXIAN' | 'MANUAL' | 'MOCK'
}
```

---

## 6. Sécurité

### 6.1 Authentification

- **Hachage** : Argon2id (memoryCost 65536, timeCost 3, parallelism 4). Fallback bcrypt si perf critique.
- **JWT** : HS256 signé avec secret ≥ 256 bits stocké en env var. Access 15 min, refresh 7 j.
- **Refresh rotation** : à chaque refresh, l'ancien est invalidé (Redis blacklist). Détection de vol.
- **MFA TOTP** : optionnel pour Admin. Secret chiffré AES-256-GCM en base.
- **OTP SMS** : code 6 chiffres, TTL 5 min, max 3 tentatives, via Telma SMS Gateway.
- **Lockout** : 5 tentatives échouées → lockout progressif 5 min → 15 min → 1 h → contact Admin.

### 6.2 Autorisation (RBAC)

#### 6.2.1 Guards NestJS

```typescript
@UseGuards(JwtAuthGuard, RolesGuard, ScopeGuard)
@Roles(Role.CHEF_SERVICE)
@Scope('site')
async findPointages(@CurrentUser() user, @Query() query) {
  // ScopeGuard injecte automatiquement siteId = user.siteId
  return this.svc.findAll({ ...query, siteId: user.siteId });
}
```

#### 6.2.2 Middleware Prisma

Un middleware Prisma applique automatiquement des filtres WHERE selon le user courant (AsyncLocalStorage) :

```typescript
prisma.$use(async (params, next) => {
  const user = requestContext.get("user");
  if (user?.role === Role.CHEF_SERVICE && params.model === "Worker") {
    params.args.where = { ...params.args.where, siteId: user.siteId };
  }
  return next(params);
});
```

Double barrière : impossible de contourner en forgeant une requête.

### 6.3 Chiffrement

- **En transit** : TLS 1.3 uniquement (Let's Encrypt), HSTS 1 an.
- **Au repos (base)** : chiffrement disque LUKS côté hébergeur.
- **Photos MinIO** : SSE (Server-Side Encryption) activé.
- **Templates biométriques (V2) côté client** : AES-256-GCM via WebCrypto. Clé dérivée du PIN utilisateur (PBKDF2 100k iterations) + secret serveur. Aucun template en clair côté client.
- **Secrets applicatifs** : env vars, jamais commit. Docker secrets en prod.

### 6.4 URL pré-signées MinIO

```typescript
// upload
const url = await minio.presignedPutObject("photos-pointages", key, 300);
// download
const url = await minio.presignedGetObject("rapports-pdf", key, 300);
```

TTL 5 minutes. Vérifier ContentType et taille max côté client.

### 6.5 Audit log

Interceptor NestJS global qui capture avant/après pour les mutations. Triggers PostgreSQL pour les cas critiques (INSERT/UPDATE/DELETE sur `Worker`, `Pointage`, `Payment`).

```typescript
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler) {
    const req = ctx.switchToHttp().getRequest();
    const before = ... // fetch état actuel
    return next.handle().pipe(tap(async (result) => {
      await this.audit.log({
        userId: req.user.id, action: req.method, entityType: ..., before, after: result, ip: req.ip
      });
    }));
  }
}
```

### 6.6 RGPD / Loi 2014-038

- Registre des traitements documenté.
- Consentement explicite du MOC à l'embauche (formulaire papier).
- Durée de conservation : 5 ans (contractuel), 24 mois (audit), 12 mois (photos), 7 jours (templates locaux V2).
- Droit d'accès : export JSON complet des données personnelles sur demande.
- Droit à l'effacement : anonymisation (nom remplacé par ID) préservant les données comptables.
- Analyse d'impact préalable au déploiement V2 (biométrie locale).

---

## 7. Synchronisation offline

### 7.1 Principe

La PWA garantit qu'aucune donnée saisie hors ligne n'est perdue et qu'une même donnée n'est jamais dupliquée côté serveur. Le mécanisme repose sur un identifiant client unique (`clientUuid`) et une contrainte d'unicité en base.

### 7.2 Schémas IndexedDB (Dexie)

```typescript
// Dexie schema
db.version(1).stores({
  workers: "id, teamId, [firstName+lastName]",
  activities: "id, siteId, active",
  teams: "id, siteId",
  pointings_pending: "clientUuid, workerId, date, status",
  pointings_synced: "clientUuid, id, workerId, date",
  presence_pending: "clientUuid, workerId, date", // V2
  biometric_cache: "workerId, expiresAt", // V2 chiffré
  requests: "id, type, status", // V2
  media: "clientUuid, refType, blob, uploaded", // photos
  meta: "key", // token JWT, PIN hash, dernier sync, etc.
});
```

### 7.3 Cycle de vie d'un pointage

```
1. Saisie utilisateur → creation clientUuid (uuid v7)
2. Écriture pointings_pending [status: 'local']
3. Trigger sync (auto ping 60s OR button)
4. POST /pointages/sync avec batch (≤100)
5. Pour chaque ligne réponse :
   - status: 'created'        → move pointings_synced [status: 'synced']
   - status: 'already_exists' → move pointings_synced [status: 'synced']  (idempotent)
   - status: 'rejected'       → update pointings_pending [status: 'rejected', reason]
6. Si photos associées : POST /uploads/sign → PUT MinIO → mark uploaded
7. Purge pointings_pending [status: 'synced'] après 7 jours
```

### 7.4 Gestion des conflits

- **Autorité serveur** : toute modification côté Admin pendant qu'un client est offline sera écrasée au retour de sync.
- **Horodatage** : chaque pointage a `createdByClientAt` (côté PWA) et `syncedAt` (côté serveur). Le premier sert de référence temporelle métier.
- **Notification** : en cas d'écrasement de pointage local par une version serveur plus récente, un badge « écrasé par admin » apparaît dans l'historique.

### 7.5 Retry et backoff

```typescript
// Backoff exponentiel
const delays = [1000, 2000, 5000, 15000, 60000, 300000]; // 1s → 5min
let attempt = 0;
while (attempt < delays.length) {
  try {
    await syncBatch();
    break;
  } catch (e) {
    await sleep(delays[attempt++]);
  }
}
// Après 6 échecs consécutifs : alerter l'utilisateur, arrêter les tentatives auto.
```

---

## 8. Modules techniques

### 8.1 Module Biometric (adapter pattern)

```typescript
// packages/api/src/modules/biometric/biometric.provider.ts
export interface BiometricProvider {
  check(input: {
    workerId: string;
    photo: Buffer;
    mvolaNumber: string;
  }): Promise<BiometricResult>;
}

// Choix runtime via env var BIOMETRIC_PROVIDER
const providerMap = {
  MOCK: MockBiometricProvider,
  MANUAL: ManualBiometricProvider,
  AXIAN: AxianBiometricProvider,
};

@Injectable()
export class BiometricService {
  constructor(@Inject('BIO_PROVIDER') private provider: BiometricProvider) {}
  async performCheck(...) {
    const result = await this.provider.check(...);
    await this.prisma.biometricCheck.create({ data: {...result} });
    return result;
  }
}
```

### 8.2 Module Payment / MVola Excel Builder

Génération du fichier via `exceljs`. Streaming pour les gros volumes.

```typescript
import * as ExcelJS from 'exceljs';

async generateMvolaFile(periodIso: string): Promise<Buffer> {
  const payments = await this.prisma.payment.findMany({
    where: { periodIso, status: 'PENDING' },
    include: { worker: { include: { site: true } } },
  });
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Paiements');
  ws.addRow(['Numéro téléphone', 'Description', 'Période', 'Montant', 'Bio Validée']);
  for (const p of payments) {
    const desc = truncateDescription(`${p.worker.firstName} Paiement ${p.worker.site.shortCode}`);
    ws.addRow([p.worker.mvolaNumber, desc, periodIso, p.amount, p.bioValid ? 'OUI' : 'NON']);
  }
  // update statut EXPORTED en transaction
  await this.prisma.payment.updateMany({
    where: { id: { in: payments.map(p => p.id) } },
    data: { status: 'EXPORTED', exportedAt: new Date() },
  });
  return wb.xlsx.writeBuffer();
}
```

### 8.3 Module Reports (PDF)

Génération PDF via Puppeteer (rendu HTML → PDF). Job BullMQ pour ne pas bloquer la requête.

```typescript
// jobs/report-weekly.processor.ts
@Processor('reports')
export class ReportProcessor {
  @Process('weekly')
  async handleWeekly(job: Job<{ siteId: string; weekIso: string }>) {
    const data = await this.reportSvc.aggregateWeekly(...);
    const html = await this.templates.render('weekly.hbs', data);
    const pdf = await this.puppeteer.htmlToPdf(html);
    const key = `reports/${weekIso}/${siteId}.pdf`;
    await this.minio.putObject('rapports-pdf', key, pdf);
    await this.notif.emailAdmin({ ... link ... });
  }
}
```

### 8.4 Module NFC (V2)

```typescript
// PWA side
if ('NDEFReader' in window) {
  const reader = new NDEFReader();
  await reader.scan();
  reader.onreading = ({ serialNumber }) => {
    const worker = badgeToWorkerMap.get(serialNumber);
    if (worker) db.presence_pending.add({ clientUuid, workerId: worker.id, ... });
  };
}
```

### 8.5 Module Workflows (V2)

Gestion générique des demandes via un pattern State Machine :

```typescript
interface Request<T> {
  type: "ACTIVITY" | "WORKER" | "CLARIFICATION";
  status: RequestStatus;
  transition(action: Action): void;
}
```

### 8.6 Notifications

- **Email** : Mailgun via lib `nodemailer`. Templates Handlebars stockés dans `/apps/api/src/templates/emails/`.
- **SMS** : Telma SMS API via lib `axios`. Format E.164 pour numéros.
- **Push PWA** : Web Push API non requis en V1 ; badge notification via polling en V2.

---

## 9. Intégrations externes

### 9.1 AXIAN Biométrie

| Élément             | Détail                                                     |
| ------------------- | ---------------------------------------------------------- |
| Statut              | API en cours de développement. Documentation à obtenir.    |
| Endpoint (probable) | `POST https://biometric.axian.mg/api/v1/kyc/compare`       |
| Auth                | API Key + éventuellement mTLS (à confirmer)                |
| Payload             | multipart : reference_number (numéro MVola), photo (JPEG)  |
| Réponse             | `{ match: bool, score: float, referenceMetadata?: {...} }` |
| Rate limit          | à définir avec AXIAN                                       |
| Mode dégradé        | ManualBiometricProvider si UNAVAILABLE                     |

### 9.2 MVola Bulk Transfer

| Élément        | Détail                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------------- |
| Mode d'échange | Fichier Excel généré par ALTERRA, uploadé manuellement par l'Admin sur le portail marchand MVola. |
| Retour         | Fichier de statuts téléchargé par l'Admin depuis le portail, importé dans ALTERRA.                |
| Aucune API     | Pas d'appel serveur-à-serveur. Le paiement reste manuel côté MVola.                               |
| Format fichier | cf. spécification fonctionnelle §7.4.                                                             |

### 9.3 Telma SMS Gateway

| Élément    | Détail                                          |
| ---------- | ----------------------------------------------- |
| Endpoint   | à confirmer avec Telma                          |
| Auth       | API Key                                         |
| Rate limit | à définir                                       |
| Usage      | OTP CDE (~75/semaine), notifications critiques. |

### 9.4 Mailgun

| Élément       | Détail                                                      |
| ------------- | ----------------------------------------------------------- |
| Endpoint      | `https://api.mailgun.net/v3/{domain}/messages`              |
| Auth          | HTTP Basic (`api:{key}`)                                    |
| Usage         | Rapports, factures, notifications workflow, reset password. |
| Volume estimé | ~500 emails/mois                                            |

### 9.5 Backblaze B2 (backup)

| Élément     | Détail                                                     |
| ----------- | ---------------------------------------------------------- |
| Endpoint    | S3-compatible via b2 API                                   |
| Auth        | keyID + applicationKey                                     |
| Contenu     | pg_dump quotidien 02h00 heure Antananarivo, rétention 30 j |
| Chiffrement | Client-side avant upload (`age` ou GPG)                    |

### 9.6 MapTiler / OSM (V2)

| Élément  | Détail                                   |
| -------- | ---------------------------------------- |
| Usage    | Tuiles cartographiques dans Web Admin    |
| Auth     | API Key MapTiler ou tuiles OSM gratuites |
| Fallback | OSM si MapTiler indisponible             |

---

## 10. Déploiement

### 10.1 Environnements

| Environnement | Détail                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| Local dev     | Docker Compose sur poste développeur, base seedée avec données de test. |
| Staging       | VPS staging identique à prod, données anonymisées, testing par ALTERRA. |
| Production    | VPS prod chez OVH ou Telma, sauvegardes activées, HTTPS.                |

### 10.2 Docker Compose (extrait prod)

```yaml
version: "3.9"
services:
  nginx:
    image: nginx:1.24-alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/letsencrypt:ro
      - ./admin-dist:/usr/share/nginx/html/admin:ro
      - ./pwa-dist:/usr/share/nginx/html/pwa:ro
    depends_on: [api]

  api:
    image: ghcr.io/alterra/api:${TAG}
    env_file: .env.prod
    depends_on: [postgres, redis, minio]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: alterra
      POSTGRES_USER: alterra
      POSTGRES_PASSWORD_FILE: /run/secrets/pg_password
    volumes: [pg_data:/var/lib/postgresql/data]
    secrets: [pg_password]

  redis:
    image: redis:7-alpine
    volumes: [redis_data:/data]

  minio:
    image: minio/minio
    command: server /data --console-address ':9001'
    environment:
      MINIO_ROOT_USER_FILE: /run/secrets/minio_user
      MINIO_ROOT_PASSWORD_FILE: /run/secrets/minio_pass
    volumes: [minio_data:/data]

  backup-cron:
    image: ghcr.io/alterra/backup:${TAG}
    env_file: .env.prod
    depends_on: [postgres]

volumes: { pg_data, redis_data, minio_data }
secrets:
  pg_password: { file: ./secrets/pg_password.txt }
  minio_user: { file: ./secrets/minio_user.txt }
  minio_pass: { file: ./secrets/minio_pass.txt }
```

### 10.3 Variables d'environnement (`.env.prod`)

| Variable           | Valeur                                                 |
| ------------------ | ------------------------------------------------------ |
| DATABASE_URL       | `postgresql://alterra:${PG_PWD}@postgres:5432/alterra` |
| REDIS_URL          | `redis://redis:6379`                                   |
| MINIO_ENDPOINT     | `minio:9000`                                           |
| MINIO_ACCESS_KEY   | `<secret>`                                             |
| MINIO_SECRET_KEY   | `<secret>`                                             |
| JWT_SECRET         | `<256 bits random>`                                    |
| JWT_REFRESH_SECRET | `<256 bits random>`                                    |
| BIOMETRIC_PROVIDER | `AXIAN                                                 | MANUAL | MOCK` |
| AXIAN_API_KEY      | `<secret>`                                             |
| AXIAN_API_URL      | `https://biometric.axian.mg/api/v1`                    |
| TELMA_SMS_API_KEY  | `<secret>`                                             |
| MAILGUN_API_KEY    | `<secret>`                                             |
| MAILGUN_DOMAIN     | `mail.alterra.mg`                                      |
| BACKBLAZE_KEY_ID   | `<secret>`                                             |
| BACKBLAZE_APP_KEY  | `<secret>`                                             |
| NODE_ENV           | `production`                                           |
| LOG_LEVEL          | `info`                                                 |
| MAX_UPLOAD_SIZE_MB | `5`                                                    |
| ADMIN_ORIGIN       | `https://admin.alterra.mg`                             |
| PWA_ORIGIN         | `https://app.alterra.mg`                               |

### 10.4 CI/CD GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy
on: { push: { branches: [main] } }
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
  docker:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: docker/build-push-action@v5
        with: { push: true, tags: ghcr.io/alterra/api:${{ github.sha }} }
  deploy:
    needs: docker
    environment: production  # approbation manuelle requise
    runs-on: ubuntu-latest
    steps:
      - name: SSH deploy
        run: ssh alterra@prod 'cd /opt/alterra && TAG=${{ github.sha }} docker compose up -d'
```

### 10.5 Procédures d'exploitation

**Déploiement**

```bash
$ ssh alterra@prod
$ cd /opt/alterra
$ TAG=v1.2.3 docker compose pull
$ TAG=v1.2.3 docker compose up -d api  # rolling
$ docker compose exec api pnpm prisma migrate deploy
```

**Rollback**

```bash
$ TAG=v1.2.2 docker compose up -d api
```

**Backup manuel**

```bash
$ docker compose exec postgres pg_dump -U alterra alterra | gzip > backup-$(date +%F).sql.gz
$ rclone copy backup-*.gz b2:alterra-backups/
```

**Restore**

```bash
$ rclone copy b2:alterra-backups/backup-2026-04-27.sql.gz ./
$ zcat backup-2026-04-27.sql.gz | docker compose exec -T postgres psql -U alterra alterra
```

---

## 11. Stratégie de tests

### 11.1 Pyramide de tests

- **Unitaires (60 %)** : Vitest côté back et front. Cible : services, utils, hooks, composants.
- **Intégration (30 %)** : Vitest + Supertest côté API (avec DB test). React Testing Library côté front.
- **End-to-end (10 %)** : Playwright : parcours critiques (login, sync pointage, validation, paiement).

### 11.2 Couverture cible

- API : > 80 % lignes, > 90 % sur modules Payment / Biometric / Auth.
- Front : > 70 % lignes, 100 % sur hooks de sync et sécurité.

### 11.3 Tests spécifiques

**Tests offline**

- Simuler perte de réseau via `navigator.onLine` mock.
- Vérifier idempotence : envoyer 2 fois le même `clientUuid` → une seule ligne DB.
- Vérifier reprise : couper connexion pendant batch, reprendre, vérifier cohérence.

**Tests biométriques**

- Mock provider : tests unitaires avec résultats déterministes.
- Manual provider : tests d'interaction UI.
- AXIAN provider : tests d'intégration en sandbox quand dispo.

**Tests de charge**

- k6 script : simuler 15 CDE synchronisant simultanément.
- Vérifier réponse < 500 ms au P95.
- Vérifier absence de deadlocks Postgres.

### 11.4 Environnement de test

- Base PostgreSQL isolée par test (schema par test ou testcontainers).
- MinIO en mode inMemory pour les unitaires.
- Redis via redis-mock ou testcontainers.
- Seeds déterministes (`@faker-js/faker` avec seed fixe).

---

## 12. Observabilité

### 12.1 Logs structurés (Pino)

```typescript
logger.info(
  {
    event: "pointage.sync",
    userId: user.id,
    count: batch.length,
    duration: elapsed,
    traceId: req.traceId,
  },
  "Batch sync complete",
);
```

Sortie stdout, capturée par Docker. Rotation via logrotate. Optionnellement forwarding vers Grafana Loki plus tard.

### 12.2 Monitoring

- Healthchecks.io : ping quotidien du job backup. Alerte email si silence > 25 h.
- UptimeRobot : ping HTTPS toutes les 5 min sur `/health`. Alerte SMS si down > 5 min.
- Grafana + Prometheus : optionnel V2, si besoin métriques fines.

### 12.3 Métriques applicatives

- `nestjs-prometheus` : endpoint `/metrics`.
- Métriques : nombre de requêtes par endpoint, temps de réponse, erreurs 5xx, nombre de sync/heure, taux d'erreur biométrique.

### 12.4 Alertes

| Condition                    | Canal                        |
| ---------------------------- | ---------------------------- |
| Erreurs 5xx > 1 %            | Alerte email Admin technique |
| Latence P95 > 1 s            | Alerte email Admin technique |
| Job backup en échec          | Alerte SMS Admin             |
| Certificat TLS expire < 15 j | Alerte email                 |
| Espace disque < 20 %         | Alerte email                 |
| Postgres connections > 80 %  | Alerte email                 |

---

## 13. Documentation

### 13.1 Code

- JSDoc / TSDoc sur fonctions publiques.
- README.md à chaque niveau (root, apps, packages).
- CONTRIBUTING.md avec conventions (branch, commit, PR).
- ADR (Architecture Decision Records) dans `/docs/adr/` pour choix structurants.

### 13.2 API

- OpenAPI 3 auto-généré via `@nestjs/swagger`.
- Swagger UI accessible sur `/api/docs` (protégé par auth Admin en prod).
- Export JSON pour import Postman.

### 13.3 Utilisateur

- Guide utilisateur PDF par rôle (Admin, CDS, CDE).
- Vidéos courtes de démonstration (5 min max) hébergées privé.
- Aide contextuelle in-app (tooltips).

### 13.4 Exploitation

- Runbook incidents fréquents.
- Procédures backup/restore testées.
- Playbook de mise en production.

---

## 14. Performance et scalabilité

### 14.1 Cibles

| Métrique                          | Cible                |
| --------------------------------- | -------------------- |
| API lecture (P95)                 | < 200 ms             |
| API écriture (P95)                | < 500 ms             |
| Sync batch 40 pointages           | < 5 s en 3G          |
| Génération Excel MVola 600 lignes | < 30 s               |
| Génération rapport PDF hebdo      | < 10 s (job async)   |
| Contrôle biométrique AXIAN        | < 3 s (dépend AXIAN) |
| Disponibilité                     | > 99 %               |

### 14.2 Optimisations

- Index composés sur `Pointage`, `Payment`, `BiometricCheck`.
- Pagination cursor-based, jamais offset pour listes volumineuses.
- Cache Redis pour dashboards (TTL 60 s).
- Jobs asynchrones (BullMQ) pour PDF, exports Excel.
- Compression gzip/brotli côté Nginx.
- Lazy loading React (React.lazy + Suspense).
- Images photos servies via URL pré-signées (offload MinIO).

### 14.3 Scalabilité

Croissance possible sans changement de code :

- Vertical : passer de 4 à 8 vCPU + 16 GB RAM sur le VPS actuel.
- Séparer Postgres sur un serveur dédié via docker-compose split.
- Ajouter des workers BullMQ sur un autre serveur.
- Réplique Postgres en lecture pour dashboards.
- CDN devant les frontends si besoin.

### 14.4 Volumétrie 5 ans (projection)

- Pointages : 750 000 lignes (5 campagnes × 150 000).
- Payments : 150 000 lignes.
- BiometricChecks : 750 000 lignes.
- Photos MinIO : ~50 Go (150 000 photos × 300 Ko compressées).
- PostgreSQL : ~2 Go metadata + index (négligeable en réalité, PG gère facilement).
- Backups : 30 j × 5 Go = 150 Go sur Backblaze.

---

_Fin du document — v1.0 du 28 avril 2026_
