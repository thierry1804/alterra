# ALTERRA — Brief et handoff Développeur

**Onboarding technique pour rejoindre l'équipe de développement**

Version 2.0 — 27 août 2026 (corrige la v1.0 du 28 avril 2026, qui décrivait une stack NestJS/pnpm envisagée en phase de cadrage et jamais implémentée — voir le correctif ci-dessous)
Destinataire : Développeur fullstack rejoignant l'équipe

> **Ce qui a changé depuis la v1.0** : la v1.0 de ce document décrivait l'architecture *cible de cadrage* (NestJS, Fastify, pnpm + Turborepo, structure `apps/`). Le code réellement livré a divergé sur l'implémentation technique (stack Express, npm workspaces, structure `backend/`/`admin/`/`pwa/`) tout en respectant les mêmes principes directeurs (RBAC double niveau, idempotence, adapter pattern, offline-first). Cette version 2.0 documente **le code tel qu'il existe aujourd'hui**, vérifié directement contre le repo. Les sections 2 à 10 et 12 ont été réécrites ; les sections 1, 11, 13 et 14 (contexte métier, onboarding, contact) restent globalement valables et n'ont été qu'ajustées.
>
> Pour la source de vérité détaillée et tenue à jour, voir aussi [`docs/architecture-technique.md`](../docs/architecture-technique.md) et [`docs/conformite-architecture-cible.md`](../docs/conformite-architecture-cible.md).

---

## Bienvenue

Ce document t'accompagne pour tes premiers jours sur le projet ALTERRA. Il te donne le contexte métier essentiel, l'architecture technique, la structure du repo, comment lancer l'environnement local, les conventions à respecter, les concepts techniques clés à maîtriser et un guide pour tes deux premières semaines.

Lis-le en entier avant de coder. Puis garde-le sous la main comme référence.

En parallèle, prends aussi le temps de parcourir :

- `ALTERRA - Spécification fonctionnelle détaillée.md` — ce que le système doit faire.
- `ALTERRA - Spécification technique détaillée.md` — comment on l'implémente (⚠️ elle aussi rédigée en phase de cadrage : vérifie les détails d'implémentation contre le code, comme pour ce brief).
- `ALTERRA - Backlog détaillé.md` — sur quoi tu vas travailler.
- [`docs/architecture-technique.md`](../docs/architecture-technique.md) et [`docs/conformite-architecture-cible.md`](../docs/conformite-architecture-cible.md) — l'architecture réelle, tenue à jour avec le code.

---

## 1. Contexte métier en 5 minutes

**Le client** : ALTERRA, opérateur malgache de reforestation, cinq sites (Manankazo, Antsampanana, Anjozorobe, Mangatsa, Ambondromamy). Ils mobilisent ~600 travailleurs communautaires actifs (les MOC) qu'il faut pointer, contrôler et payer chaque semaine par MVola.

**Trois rôles utilisateurs**

- **Administrateur** (1 pers.) : au siège, sur desktop, environnement connecté. Utilise la Web App Admin.
- **Chef de Service** (5 pers., 1 par site) : au camp de base, sur mobile ou tablette, connexion semi-disponible. Utilise la PWA en mode validation.
- **Chef d'Équipe** (15 pers., 3 par site) : sur le terrain avec une équipe de ~40 MOC, offline critique. Utilise la PWA en mode pointage.

**Trois moments clés**

- **Chaque jour**, le Chef d'Équipe pointe ses 40 MOC : quantité réalisée pour l'activité du jour (trouaison = combien de trous, défrichage = combien de m², etc.). Tout en offline. Synchro quand il revient au camp.
- **Chaque vendredi**, le Chef de Service passe en revue les MOC de son site (~120 pers.), les valide un par un avec contrôle biométrique via API AXIAN (photo capturée + comparaison avec la photo KYC MVola). Génère rapport + facture PDF.
- **Chaque lundi**, l'Administrateur consolide les rapports des 5 sites, calcule le bordereau global, génère un fichier Excel au format MVola Bulk Transfer qu'il soumet manuellement sur le portail MVola. Importe ensuite le fichier retour de statuts.

**Deux vagues de livraison**

- **V1** : cœur fonctionnel, 12 semaines.
- **V2** : NFC, biométrie offline, workflows, cartographie, hiérarchie Zone/Parcelle, 5 semaines additionnelles.

**Trois risques identifiés à connaître**

- Le provider biométrique **AXIAN** est intégré côté API (REST), mais l'architecture cible nomme désormais **YAS** et vise un flux différent : une **APK Android invoquée en Intent/deep-link** depuis la PWA, pas un appel REST cloud (proposition non intégrée à ce jour — voir [`docs/cadrage/biometrie-v2-intent-apk.md`](../docs/cadrage/biometrie-v2-intent-apk.md)). Le code doit de toute façon tomber en douceur en mode dégradé (adapter pattern, §7.3).
- Web NFC API n'est disponible que sur Chrome Android — Contrainte matérielle.
- Cache biométrique local en V2 = sujet RGPD, chiffrement strict WebCrypto.

Pour aller plus loin, lis le persona detail dans la spec fonctionnelle §2.

---

## 2. Architecture technique en un coup d'œil

Le projet est un **monolithe modulaire Express/Prisma** avec deux frontends React distincts, hébergé sur un unique serveur on-premise via Docker Compose. Aucun BaaS, aucune dépendance cloud propriétaire pour la donnée métier.

### 2.1 Vue en six tiers

```
┌─── Clients ──────────────────────────────────────────────┐
│  [ CDE ]          [ CDS ]         [ Admin ]              │
│ smartphone Android  mobile/tablette  desktop             │
│    PWA Terrain   PWA Terrain      Web App Admin          │
└──────────────────────────────────────────────────────────┘
                       │
             HTTPS 1.3 + JWT (access + refresh cookie)
                       │
┌─── Bordure réseau ────────────────────────────────────────┐
│  Cloudflare Tunnel (0 port entrant) → Nginx 1.26 TLS 1.3 │
│  reverse proxy + sert admin/pwa statiques                │
└──────────────────────────────────────────────────────────┘
                       │
┌─── Application — backend/ (Node.js 22 + Express + Prisma) ┐
│  API Express : routes/ + services/ par domaine métier    │
│  (auth, sites, teams, workers, activities, pointages,    │
│  payments, biometric, reports, workflows, audit, ...)    │
│  RBAC middleware + Prisma RLS applicative                │
│  Worker BullMQ (pdf.worker.ts) pour rapports PDF/Excel   │
└──────────────────────────────────────────────────────────┘
                       │
┌─── Données ──────────────────────────────────────────────┐
│  PostgreSQL 16      MinIO (S3)      Redis 7 (jobs+cache) │
└──────────────────────────────────────────────────────────┘
                       │
┌─── Externes (via HTTPS) ─────────────────────────────────┐
│  AXIAN biométrie (cible : YAS, cf. §1)   Mailgun         │
│  MVola (portail manuel, pas d'API)   Backblaze B2        │
└──────────────────────────────────────────────────────────┘
```

### 2.2 Principes directeurs à respecter

Ces principes sont non-négociables. Ils guident chaque choix technique :

- **Souveraineté** : toutes les données métier vivent sur l'infra ALTERRA. Aucun SaaS pour la donnée sensible.
- **Offline-first** : la PWA doit fonctionner toute une journée sans réseau. Toute action utilisateur ne dépend jamais du réseau.
- **Idempotence** : chaque mutation client-serveur porte un `clientUuid` unique côté client. Rejouer la même requête ne crée jamais de doublon.
- **RBAC double niveau** : les permissions sont vérifiées par du middleware Express (`requireAuth` + `requireRole`) ET par une extension Prisma qui filtre automatiquement les requêtes par `siteId`/`teamId` (`middleware/prisma-rls.ts`). Si un dev oublie l'un, l'autre reste.
- **Adapter pattern** : les services externes (biométrie, email) sont derrière une interface. Pour la biométrie, trois implémentations pilotées par `BIOMETRIC_PROVIDER` : `MOCK` (dev), `MANUAL` (fallback), `AXIAN` (prod).
- **Audit exhaustif** : toute mutation sensible est journalisée automatiquement par `middleware/audit.interceptor.ts`.

Voir [`docs/architecture-technique.md`](../docs/architecture-technique.md) pour le détail.

---

## 3. Stack technique et pourquoi

### 3.1 Résumé versionné

Vérifié directement dans les `package.json` du repo (`backend/`, `admin/`, `pwa/`) — voir aussi [`docs/architecture-technique.md`](../docs/architecture-technique.md) §3.

| Composant       | Version               | Pourquoi ce choix                                                  |
| --------------- | ---------------------- | ------------------------------------------------------------------- |
| Node.js         | 22 (`.nvmrc` = 22.12)  | Aligné image Docker prod ; `engines` du repo exige ≥ 20.19          |
| Express         | 4.21                    | Minimal, sans magie, écosystème mature                              |
| Prisma          | 5.20                    | Type-safe, migrations, extension client pour la RLS applicative    |
| PostgreSQL      | 16 (Docker)             | Standard éprouvé, JSON, contraintes fortes                          |
| Redis           | 7 (Docker, `ioredis`)   | Backend BullMQ, blocklist tokens, rate-limit (`rate-limit-redis`)   |
| BullMQ          | 5.x                     | Jobs async robustes (génération PDF hebdo)                          |
| MinIO           | image `minio/minio`     | S3-compatible, containerisable, buckets photos/rapports              |
| Puppeteer       | 24.x                    | Rendu PDF (Chromium embarqué dans l'image `api`)                     |
| Handlebars      | 4.7                     | Templates HTML pour les rapports avant rendu PDF                     |
| React           | 18.x                    | Standard, hooks stables                                              |
| Vite            | 5.x                     | Build ultra-rapide, HMR excellent                                    |
| TypeScript      | 5.6                     | Strict mode activé dans les 3 workspaces frontend/backend            |
| Tailwind CSS    | 3.x                     | Utility-first, tokens de design partagés (`design/tokens.css`)       |
| Radix UI        | dernière                | Primitives accessibles (admin)                                       |
| Dexie.js        | 4.x                     | Wrapper IndexedDB avec promises (PWA offline)                        |
| vite-plugin-pwa | dernière                | Service Worker (Workbox) pour la PWA                                 |
| Zod             | 3.23                    | Validation runtime des routes Express + inférence types              |
| Pino            | 9.x                     | Logs JSON structurés (`pino-http`)                                   |
| argon2          | 0.41                    | Hash des mots de passe                                               |
| Playwright      | 1.49                    | Tests E2E, workspace dédié `e2e/`                                    |
| Vitest          | 2.x                     | Tests unitaires/intégration backend (`backend/src/__tests__/`)       |

### 3.2 Choix qui pourraient te surprendre

- **Express plutôt qu'un framework structurant (NestJS, etc.)** : une phase de cadrage avait envisagé NestJS/Fastify (cf. l'ancienne v1.0 de ce document) ; l'équipe a livré en Express pour rester minimal sur un périmètre à 5 sites. La séparation `routes/` (endpoints + validation Zod) / `services/<domaine>/` (logique métier) rejoue à la main l'essentiel de ce qu'apporterait un framework, sans DI ni décorateurs.
- **Pas de lib de state serveur (TanStack Query, etc.) constatée aujourd'hui** : chaque front appelle l'API directement. Vérifie l'existant avant de supposer un pattern de data-fetching sur une feature que tu n'as pas encore ouverte.
- **Pas de lib de composants (shadcn/ui, MUI…)** : l'admin utilise Radix UI + Tailwind directement, avec des tokens de design partagés dans `design/tokens.css` (importé par `admin/` et `pwa/`).
- **BullMQ pour un seul type de job aujourd'hui** : `backend/src/jobs/pdf.worker.ts` traite la génération de rapports PDF/Excel. Pas de scheduler cron applicatif en place.
- **Pas d'ORM autre que Prisma** : type-safety maximum, client généré, migrations versionnées dans `backend/prisma/migrations/`.
- **Monorepo npm workspaces, pas pnpm/Turborepo** : 4 workspaces (`backend`, `admin`, `pwa`, `e2e`). Pas de package de types partagés — les types métier viennent de `@prisma/client` côté backend ; chaque front définit ses propres types d'appel API.

---

## 4. Structure du repo

Monorepo **npm workspaces** (pas pnpm, pas Turborepo) :

```
alterra/
├── backend/              # API Express + Prisma
│   ├── src/
│   │   ├── routes/         # endpoints Express, un fichier par domaine (auth, sites, workers,
│   │   │                   # activities, pointages, payments, biometric, reports, workflows,
│   │   │                   # zones, parcels, presence, dashboard, audit, badges, users, teams...)
│   │   ├── services/       # logique métier, dossier par domaine (pointages/, biometric/, payments/, ...)
│   │   ├── middleware/     # auth.ts, rbac.ts, prisma-rls.ts, validate.ts, audit.interceptor.ts,
│   │   │                   # error-handler.ts
│   │   ├── jobs/            # pdf.worker.ts (BullMQ)
│   │   ├── lib/              # jwt, redis, utilitaires transverses
│   │   ├── templates/        # templates Handlebars pour les PDF
│   │   ├── __tests__/        # tests Vitest
│   │   └── index.ts           # point d'entrée Express
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts (+ seed-data.ts)
│   └── package.json
├── admin/                # Back-office React 18 + Vite (Radix UI + Tailwind)
├── pwa/                  # App terrain React 18 + Vite PWA (offline-first, Dexie)
├── e2e/                  # Tests Playwright (workspace séparé, pas dans backend/admin/pwa)
├── design/               # tokens.css partagé entre admin et pwa
├── infra/                # docker-compose prod/staging, nginx, cloudflared, pgBackRest, scripts
├── docs/                 # architecture, runbook, guides utilisateurs, cadrage, ops, qa
├── basedocs/             # documents de cadrage projet (specs, brief, backlog — dont ce fichier)
├── .github/workflows/    # ci.yml, deploy.yml
├── docker-compose.yml    # dev (postgres, redis, minio, api, + profil `full` pour admin/pwa)
├── package.json          # workspaces: backend, admin, pwa, e2e
└── README.md
```

**Astuce** : lance `tree -L 3 -I 'node_modules|dist'` pour voir la structure vivante.

---

## 5. Setup local

### 5.1 Prérequis

- **Node.js ≥ 20.19** (22.12+ recommandé, aligné `.nvmrc` et l'image Docker) — via nvm : `nvm install && nvm use`
- **npm 10+** (pas pnpm)
- **Docker** + **Docker Compose v2** (`docker compose`, pas `docker-compose`)
- **Git**

### 5.2 Installation

Guide détaillé (3 modes, URLs, dépannage) : [`docs/guides/demarrage-docker.md`](../docs/guides/demarrage-docker.md). Résumé du mode « dev hybride » (recommandé au quotidien) :

```bash
# 1. Cloner le repo, puis à la racine :
npm install

# 2. Copier les variables d'environnement backend
cp .env.example backend/.env

# 3. Démarrer l'infra (Postgres, Redis, MinIO) — pas le conteneur api en dev hybride
docker compose up -d postgres redis minio

# 4. Migrations + seed
npm run db:setup -w backend

# 5. Démarrer les 3 apps en parallèle
npm run dev
```

Ça te démarre :

- API Express sur `http://localhost:3001` (santé : `GET /health`)
- Admin sur `http://localhost:5173`
- PWA sur `http://localhost:5174`

Il existe aussi un mode « stack complète » (`docker compose up -d`, API conteneurisée) et un mode « app complète » (`docker compose --profile full up -d --build`, tout conteneurisé y compris les fronts) — voir le README et le guide de démarrage pour le détail et les cas d'usage de chacun.

### 5.3 Comptes de test (créés par le seed)

| Rôle       | Email                          | Mot de passe   |
| ---------- | ------------------------------- | --------------- |
| Admin      | `admin@alterra.mg`              | `ChangeMe123!`  |
| Chef de Service / Chef d'Équipe | `*@alterra.test` (ex. `cds.<code-site>@alterra.test`) | `test123!` |
| MinIO console | `alterra_admin` | `alterra_dev_secret` (console sur `:9001`) |

Le seed crée 5 sites, 21 utilisateurs (1 admin + 5 CDS + 15 CDE), 10 activités et 50 MOC — un jeu de données de développement réduit, pas la volumétrie de production (~600 MOC, 40/équipe) décrite au §1.

⚠️ Identifiants de **développement uniquement**, jamais réutilisés en staging/prod.

### 5.4 Commandes utiles

```bash
# Développement
npm run dev                  # backend + admin + pwa en parallèle
npm run dev -w backend       # juste l'API (tsx watch)
npm run dev -w admin         # juste l'admin (Vite)
npm run dev -w pwa           # juste la PWA (Vite)

# Build
npm run build                # build backend + admin + pwa

# Tests
npm run test -w backend      # Vitest (unitaire + intégration backend)
npm run test:e2e             # Playwright (workspace e2e/)

# Prisma (depuis backend/, ou avec -w backend)
npm run db:studio -w backend      # Prisma Studio sur :5555
npm run db:migrate -w backend     # prisma migrate dev
npm run db:seed -w backend        # tsx prisma/seed.ts
npm run db:generate -w backend    # prisma generate

# Lint et format
npm run lint                 # ESLint sur backend + admin + pwa
npm run format                # Prettier write
npm run format:check          # Prettier check (CI)
```

---

## 6. Conventions de code

### 6.1 Git

**Branches** — pas de convention rigide constatée dans l'historique au-delà de branches de feature nommées librement (ex. `feat/backlog-implementation`). Aligne-toi avec le Tech Lead sur le nommage avant de créer une nouvelle branche longue durée.

**Commits (Conventional Commits)** — c'est la convention réellement suivie dans l'historique du repo :

Format : `<type>(<scope>): <description>`

Types observés : `feat`, `fix`, `docs`, `chore`, `perf`.

Exemples réels du repo :

```
feat(pwa): refonte de la validation terrain + actions en icônes
fix(docker): résolution DNS différée du proxy /api (mode full)
docs(archi): audit de conformité à l'architecture cible v1.2
fix(seed): utiliser les IDs réels des sites et équipes existants
```

**Pull Requests**

- 1 PR = 1 sujet traité, description claire de ce qui est fait et comment tester.
- Tests + lint doivent passer en CI (`.github/workflows/ci.yml`).

### 6.2 TypeScript et style

- **Strict mode partout** (`strict: true` dans `backend/tsconfig.json`, `admin/tsconfig.json`, `pwa/tsconfig.json`) — vérifié dans les 3 fichiers.
- **Pas de `any`**. Si tu es tenté, utilise `unknown` puis narrow.
- Nommage : `camelCase` pour variables/fonctions, `PascalCase` pour types/composants, `SCREAMING_SNAKE_CASE` pour constantes globales.
- ESLint + Prettier configurés à la racine (`eslint.config.js`, `.prettierrc`), partagés par les 3 workspaces.

### 6.3 Backend Express — structure d'un domaine métier

Pas de « module » au sens NestJS : un domaine métier, c'est un fichier de routes + un dossier de services.

```
backend/src/routes/pointages.routes.ts   # endpoints Express, schémas Zod inline, montage des middlewares
backend/src/services/pointages/
├── sync.service.ts          # logique de synchronisation batch
├── list.service.ts
├── validation.service.ts
└── correction.service.ts
```

**Conventions constatées dans le code existant**

- Chaque route déclare son schéma Zod (`z.object(...)`) et le passe à `validate(schema)` (voir `middleware/validate.ts`) — pas de DTO de classe séparé.
- Chaque route protégée passe par `requireAuth` (vérifie le JWT bearer) puis `requireRole(...)` pour le contrôle de rôle.
- La logique métier vit dans `services/`, jamais dans le fichier de routes.
- Les jobs longs (PDF) passent par BullMQ (`jobs/pdf.worker.ts`), jamais par `setTimeout`.

**Exemple réel (`backend/src/routes/pointages.routes.ts`)**

```typescript
import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { syncPointageBatch } from "../services/pointages/sync.service.js";

export const pointagesRouter = Router();

const syncBatchSchema = z.object({
  batch: z.array(
    z.object({
      clientUuid: z.string().uuid(),
      workerId: z.string().uuid(),
      activityId: z.string().uuid(),
      quantity: z.number().positive(),
      date: z.coerce.date(),
      createdByClientAt: z.coerce.date(),
    }),
  ).min(1).max(100),
});

pointagesRouter.post(
  "/sync",
  requireAuth,
  requireRole(Role.CHEF_EQUIPE),
  validate(syncBatchSchema),
  async (req, res, next) => {
    try {
      res.json(await syncPointageBatch(req.body.batch, req.user!));
    } catch (err) {
      next(err);
    }
  },
);
```

### 6.4 React

**Conventions à valider avec l'équipe en place** (le code réel n'a pas été audité feature par feature pour ce brief — vérifie la structure d'une feature existante dans `admin/src/` ou `pwa/src/` avant de calquer un pattern) :

- **Composants** : PascalCase, 1 composant par fichier.
- **Style** : Tailwind classes, tokens partagés via `design/tokens.css`.
- **Accessibilité** : chaque `<button>` icône seule a un `aria-label`. Chaque `<input>` a un `<label>` associé.
- **Formulaires** : vérifie s'il existe déjà React Hook Form / Zod côté front avant d'introduire une autre lib de formulaire.

### 6.5 Tests

État réel constaté :

- **Backend** : Vitest, tests dans `backend/src/__tests__/`. Script : `npm run test -w backend`.
- **E2E** : Playwright, workspace dédié `e2e/` (pas `apps/*/e2e/`). Script : `npm run test:e2e`.
- **Admin / PWA** : aucun script de test unitaire n'est déclaré dans `admin/package.json` ni `pwa/package.json` à ce jour — pas de couverture front en place. Si tu ajoutes des tests front, choisis l'outil avec le Tech Lead (Vitest + Testing Library est le choix le plus cohérent avec le reste de la stack).
- Pas de cible de couverture chiffrée constatée dans le repo (CI ou config) — à clarifier avec l'équipe si c'est un requis contractuel.

### 6.6 Documentation

- Pas de dossier `docs/adr/` dans ce repo : les décisions d'architecture documentées vivent dans `docs/architecture-technique.md`, `docs/conformite-architecture-cible.md` et `docs/cadrage/`.
- Pas de Swagger/OpenAPI généré constaté — l'API n'expose pas de `/api/docs`. Pour connaître un endpoint, lis directement le fichier de routes correspondant dans `backend/src/routes/`.

---

## 7. Concepts techniques clés

### 7.1 Synchronisation offline (le cœur du système)

**Le problème** : le Chef d'Équipe pointe 40 MOC sans réseau pendant des heures. Quand il revient au camp, il faut remonter tout ça sans doublon, sans perte, avec reprise en cas d'échec.

**La solution** : chaque pointage porte un `clientUuid` généré côté client. Le serveur impose une contrainte d'unicité sur ce champ. Retransmettre un pointage déjà reçu ne crée pas de doublon. C'est le pattern **idempotence par identifiant client**.

**Flux type**

```
1. Saisie → nouveau pointage en IndexedDB (Dexie) avec clientUuid
2. Auto-sync détecte connexion → POST /api/v1/pointages/sync avec batch (max 100)
3. Serveur upsert par clientUuid → retour par ligne
4. Client marque les lignes confirmées comme synchronisées
5. Photos uploadées séparément via MinIO
```

**Où c'est implémenté** : côté client dans `pwa/src/` (à localiser précisément dans le code — pas de dossier `sync/` confirmé pour ce brief), côté serveur dans `backend/src/services/pointages/sync.service.ts`.

### 7.2 RBAC double niveau

**Le problème** : un Chef de Service ne doit voir que son site, un Chef d'Équipe que son équipe. Impossible de faire confiance aux paramètres HTTP.

**La solution**, telle qu'implémentée dans `backend/src/middleware/` :

1. **Niveau 1 — middleware Express** : `requireAuth` (vérifie le JWT bearer, `middleware/auth.ts`) puis `requireRole(...roles)` (vérifie le rôle, `middleware/rbac.ts`).
2. **Niveau 2 — extension Prisma** : `middleware/prisma-rls.ts` maintient un contexte de requête (userId, role, scope) et filtre automatiquement les lectures/écritures par `siteId`/`teamId`. Impossible à contourner en forgeant une requête HTTP.

**Exemple réel (`backend/src/middleware/rbac.ts`)**

```typescript
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new ApiError(401, "UNAUTHENTICATED", "Missing user context"));
    if (!roles.includes(req.user.role)) {
      return next(new ApiError(403, "FORBIDDEN", "Insufficient role"));
    }
    next();
  };
}
```

**Où c'est implémenté** : `backend/src/middleware/auth.ts`, `rbac.ts`, `prisma-rls.ts`.

### 7.3 Adapter pattern pour la biométrie

**Le problème** : dépendre d'AXIAN pour développer et tester bloquerait l'équipe. Il faut pouvoir travailler et démontrer sans provider réel.

**La solution** : une interface `BiometricProvider` (`backend/src/services/biometric/BiometricProvider.interface.ts`) avec trois implémentations, sélectionnées via `BIOMETRIC_PROVIDER` :

- `MockBiometricProvider.ts` : réponse simulée, pour dev et démo.
- `ManualBiometricProvider.ts` : fallback en validation visuelle manuelle.
- `AxianBiometricProvider.ts` : vraie API AXIAN (`biometric.axian.mg`).

Basculer d'un provider à l'autre = changer l'env var + redémarrer. Voir aussi `check.service.ts`, `check-offline.service.ts`, `template.service.ts`, `score-mapping.ts` dans le même dossier.

Rappel important (§1) : l'architecture cible remplace ce flux REST par une APK Intent — cette couche est vouée à être **remplacée**, pas juste renommée AXIAN→YAS.

**Où c'est implémenté** : `backend/src/services/biometric/`.

### 7.4 Génération PDF via Puppeteer + BullMQ

**Le problème** : générer un rapport PDF hebdomadaire avec photos peut prendre plusieurs secondes. Pas question de bloquer une requête HTTP.

**La solution** :

1. L'endpoint de rapport enqueue un job BullMQ et répond sans attendre la génération.
2. `backend/src/jobs/pdf.worker.ts` traite le job : agrégation des données via Prisma → rendu HTML via Handlebars (`src/templates/`) → PDF via Puppeteer → upload MinIO.
3. Le client interroge un endpoint de statut pour savoir quand le rapport est prêt.

**Où c'est implémenté** : `backend/src/jobs/pdf.worker.ts`, `backend/src/services/reports/`.

### 7.5 Format Excel MVola Bulk Transfer

**Le problème** : le fichier de paiement doit respecter un format précis attendu par MVola.

**La solution** : génération via `exceljs` dans `backend/src/services/payments/`. Format à 5 colonnes (numéro, description, période, montant, statut biométrique) — description tronquée, période au format semaine/jour ISO.

Détail exact dans le code de `services/payments/` et dans `docs/cadrage/mvola-format.md`.

### 7.6 Sécurité biométrique offline (V2)

**Le problème** : la V2 envisage de stocker des templates biométriques localement pour permettre la comparaison offline. Sujet RGPD sensible.

**La solution prévue** (à date, périmètre V2 non livré selon la stack actuelle) :

- Templates chiffrés AES-256-GCM via WebCrypto.
- Clé dérivée du PIN utilisateur + secret serveur.
- Aucun template en clair côté client.
- Durée de vie limitée, effacement automatique à révocation/changement de PIN.

Vérifie l'état d'avancement réel de ce chantier avec le Tech Lead avant de t'appuyer sur cette section — le flux cible a évolué depuis le cadrage initial (§1, écart AXIAN/YAS).

---

## 8. Où trouver quoi

| Besoin                             | Endroit                                                            |
| ----------------------------------- | -------------------------------------------------------------------- |
| Ce que doit faire le système        | Spec fonctionnelle (`basedocs/`)                                   |
| Architecture réelle et à jour       | [`docs/architecture-technique.md`](../docs/architecture-technique.md) |
| Écarts entre cible et code          | [`docs/conformite-architecture-cible.md`](../docs/conformite-architecture-cible.md) |
| Sur quoi je bosse ce sprint         | Backlog (`basedocs/ALTERRA - Backlog détaillé.md`) + outil de suivi de l'équipe |
| Comment appeler l'API X             | Lire directement `backend/src/routes/<domaine>.routes.ts` (pas de Swagger) |
| Modèle de données                   | `backend/prisma/schema.prisma`                                    |
| Comment déployer                    | [`docs/runbook.md`](../docs/runbook.md), [`docs/deploy/production.md`](../docs/deploy/production.md) |
| Comment démarrer en local           | [`docs/guides/demarrage-docker.md`](../docs/guides/demarrage-docker.md), README racine |
| Comment lancer un test              | §5.4 de ce document                                                |
| Guides utilisateurs métier          | `docs/guides/guide-admin.md`, `guide-cde.md`, `guide-cds.md`       |
| Contact                             | Voir §13 de ce document                                            |

---

## 9. Roadmap développement

### Où on en est

- **Ce qui est mergé** : voir `git log` / branche `master` (ou branche principale) du repo.
- **Ce qui est en cours** : voir les PRs ouvertes et le board de suivi de l'équipe.
- L'état d'avancement réel diffère probablement de la roadmap de cadrage ci-dessous — vérifie avec le Tech Lead avant de t'y fier pour planifier.

### Vue synthétique de cadrage (V1 puis V2)

Consulte `ALTERRA - Backlog détaillé.md` pour le détail par sprint tel que planifié initialement :

| Sprint | Focus                                     | Livrable démo                             |
| ------ | ----------------------------------------- | ----------------------------------------- |
| 1      | Cadrage + Socle technique                 | Backend démarrable                        |
| 2      | API métier V1 + Admin start               | API sandbox utilisable                    |
| 3      | Admin complet + PWA setup                 | Web Admin utilisable                      |
| 4      | PWA complète + Biométrie + PDF            | Cycle E2E démontrable                     |
| 5      | Données + Déploiement + Tests + Formation | Prod prête                                |
| 6      | Hypercare V1                              | V1 stable                                 |
| 7-9    | Extensions V2                             | NFC, bio offline, workflows, cartographie |

---

## 10. Debug et troubleshooting

### 10.1 Symptômes courants

**« L'API ne répond plus »**

```bash
docker compose logs api --tail=100
docker compose restart api
```

**« Prisma se plaint d'une migration »**

```bash
npx prisma migrate status --schema backend/prisma/schema.prisma
# si vraiment cassé (⚠️ perte de données) :
npx prisma migrate reset --schema backend/prisma/schema.prisma
```

**« Le seed échoue »**

```bash
npx prisma migrate reset --force --schema backend/prisma/schema.prisma
npm run db:seed -w backend
```

**« Le Service Worker ne se met pas à jour »**

DevTools → Application → Service Workers → Unregister. Rafraîchir la page.

**« BullMQ ne traite pas mes jobs »**

Vérifie que Redis est up (`docker compose ps redis`) et que `PDF_WORKER_ENABLED=true` dans `backend/.env`.

**« `admin`/`pwa` ne démarrent pas en Docker »**

Le profil `full` est opt-in : `docker compose --profile full up -d --build` (voir [`docs/guides/demarrage-docker.md`](../docs/guides/demarrage-docker.md)).

### 10.2 Logs

- Logs API : `docker compose logs -f api` (ou la console `npm run dev -w backend` en dev hybride)
- Logs PWA/Admin : DevTools console
- Logs Postgres/Redis : `docker compose logs -f postgres` / `redis`

### 10.3 Base de données

```bash
npm run db:studio -w backend
# Ouvre Prisma Studio sur http://localhost:5555
```

Ou en CLI (le port Postgres exposé en local est **5433**, pas 5432) :

```bash
docker compose exec postgres psql -U alterra -d alterra
```

### 10.4 Reset complet de l'environnement

```bash
docker compose down -v         # ⚠️ supprime aussi les volumes (données Postgres/MinIO)
docker compose up -d postgres redis minio
npm run db:setup -w backend
```

---

## 11. Premières 2 semaines

### Jour 1

- Lire ce document en entier, ainsi que [`docs/architecture-technique.md`](../docs/architecture-technique.md).
- Faire la présentation par le Tech Lead.
- Cloner le repo, faire tourner l'environnement local (§5).
- Se connecter avec chaque compte de test (Admin, CDS, CDE) et explorer.
- Obtenir les accès nécessaires au serveur staging/prod (partagés par le DevOps).

### Jour 2

- Lire la spec fonctionnelle (au moins §2, §3 acteurs et cas d'usage).
- Lire [`docs/architecture-technique.md`](../docs/architecture-technique.md) (archi, modèle de données, sécurité, sync).
- Explorer un domaine backend complet (ex. `backend/src/routes/workers.routes.ts` + `services/`) et une feature d'un des deux fronts.
- Faire ta première PR : un fix trivial (typo, log manquant, test unitaire supplémentaire).

### Jours 3-5

- Prendre un ticket « good first issue » du backlog (le Tech Lead t'en attribuera un).
- Écrire ta première feature complète : idéalement une user story impliquant à la fois back et front.
- Faire réviser par le Tech Lead, itérer.

### Semaine 2

- Prendre des tickets d'un domaine que tu ne connais pas encore.
- Contribuer à la couverture de tests backend (Vitest) là où elle manque.
- Poser toutes les questions bêtes maintenant.
- Si tu détectes une convention manquante ou une doc à améliorer (y compris dans ce document), ouvre une PR.

### Livrables attendus à fin M+1

- Plusieurs PRs mergées.
- Une compréhension solide d'au moins 2-3 domaines métier du backend.
- Une contribution à la doc si tu identifies un écart entre ce document et le code.

---

## 12. Ressources externes utiles

**Documentation officielle des outils réellement utilisés**

- Express : https://expressjs.com
- Prisma : https://www.prisma.io/docs
- Zod : https://zod.dev
- BullMQ : https://docs.bullmq.io
- React : https://react.dev
- Vite : https://vitejs.dev
- Radix UI : https://www.radix-ui.com
- Tailwind CSS : https://tailwindcss.com/docs
- Dexie.js : https://dexie.org
- Workbox (via vite-plugin-pwa) : https://developer.chrome.com/docs/workbox
- Playwright : https://playwright.dev
- Vitest : https://vitest.dev

**Standards et bonnes pratiques**

- Conventional Commits : https://www.conventionalcommits.org
- Twelve-Factor App : https://12factor.net
- OWASP Top 10 : https://owasp.org/www-project-top-ten/

**Spécifique au contexte**

- Web NFC API (V2) : https://web.dev/nfc
- WebCrypto : https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API
- Loi malgache 2014-038 sur les données personnelles : Journal officiel

---

## 13. Contact et support

**En cas de question**

- **Question de convention/code** : Tech Lead / équipe de développement
- **Question métier/produit** : référent ALTERRA
- **Question infra/prod** : DevOps ou chef de projet
- **Question urgente MEP** : chef de projet

**Communication asynchrone préférée**

- Décisions techniques structurantes : documentées dans `docs/` (architecture, conformité) + PR pour review par l'équipe.
- Discussions rapides : canal d'équipe habituel.

**Éviter**

- Prendre une décision qui concerne toute l'équipe sans la documenter dans `docs/`.
- Merge sur la branche principale sans revue.
- Push force sur les branches partagées.
- Contourner les tests CI en local.

---

## 14. Un dernier mot

Ce projet a une vraie utilité pour un opérateur qui fait un travail important (reforestation à Madagascar) et pour des centaines de travailleurs communautaires qui dépendent de la fiabilité du paiement de leur travail.

Prends le temps de comprendre le contexte métier avant de coder. Pose des questions. Si un document de cadrage (spec, backlog, ce brief) ne colle plus avec le code — ça arrive, comme le montre la réécriture de ce document — signale-le et corrige-le plutôt que de deviner : mieux vaut une doc à jour que fidèle à l'intention initiale.

Bienvenue dans l'équipe.

---

_Document v2.0 du 27 août 2026 — corrige la v1.0 du 28 avril 2026. Basé sur une lecture directe du code du repo à cette date ; re-vérifie les commandes et chemins de fichiers si tu lis ceci bien plus tard._
