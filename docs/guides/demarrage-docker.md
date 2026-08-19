# Guide de démarrage — Docker

> Comment lancer ALTERRA en local avec Docker, du plus léger (dev) au tout-conteneurisé (démo/QA).
> Dernière mise à jour : 2026-08-19.

## Prérequis

- **Docker** + **Docker Compose v2** (`docker compose`, pas `docker-compose`)
- **Node.js ≥ 20.19** (22.12+ recommandé, aligné `.nvmrc`) — nécessaire pour appliquer les migrations et le seed
- **npm 10+**

```bash
nvm use          # lit .nvmrc
npm install      # installe le monorepo (workspaces)
cp .env.example backend/.env   # variables backend (si backend/.env absent)
```

---

## Les trois modes

| Mode | Commande | API | Frontends | Hot-reload | Cas d'usage |
| --- | --- | --- | --- | --- | --- |
| **Dev hybride** | `docker compose up -d postgres redis minio` puis `npm run dev` | Node local | Node local (Vite) | ✅ | Développement quotidien |
| **Stack complète** | `docker compose up -d` | conteneur `api` | — | ❌ | Smoke test API sans Node |
| **App complète** | `docker compose --profile full up -d --build` | conteneur `api` | conteneurs nginx | ❌ | Démo / QA de bout en bout |

> Le profil `full` est **opt-in** : sans `--profile full`, `admin` et `pwa` ne démarrent pas. Le comportement par défaut reste identique.

---

## Démarrer l'application complète (`--profile full`)

Lance **toute l'appli** en conteneurs (infra + API + admin + pwa), sans aucun Node en tâche de fond.

### 1. Lancer les conteneurs

```bash
docker compose --profile full up -d --build
```

Six conteneurs démarrent : `postgres`, `redis`, `minio`, `api`, `admin`, `pwa`.
Vérifier l'état :

```bash
docker compose --profile full ps
```

`api` doit passer `healthy` (démarrage ~30 s, il attend Postgres et MinIO).

### 2. Migrer + peupler la base (première fois seulement)

Les migrations Prisma et le seed se lancent depuis un poste avec Node, contre la base conteneurisée (exposée sur `localhost:5433`) :

```bash
npm run db:setup -w backend
```

Résultat attendu du seed :

```
Seed OK — 5 sites, 21 users (1 admin, 5 CDS, 15 CDE), 10 activités, 50 MOC
```

> Les données sont persistées dans les volumes Docker (`pg_data`, `minio_data`). Inutile de re-seeder après un simple `down`/`up`.

### 3. Vérifier

```bash
curl http://localhost:3001/health
# {"status":"ok","db":"up","timestamp":"..."}
```

---

## URLs

| Service | URL | Notes |
| --- | --- | --- |
| **Admin** (back-office) | http://localhost:5173 | Interface de gestion |
| **PWA** (app terrain) | http://localhost:5174 | Pointage, offline-first |
| **API** | http://localhost:3001 | Base `/api/v1` |
| **API — health** | http://localhost:3001/health | Sonde de santé |
| **MinIO — console** | http://localhost:9001 | Stockage objets |
| **MinIO — API S3** | http://localhost:9000 | — |
| PostgreSQL | `localhost:5433` | Accès direct (psql) |
| Redis | `localhost:6380` | Accès direct |

## Identifiants (seed de développement)

| Rôle | Email | Mot de passe |
| --- | --- | --- |
| Admin | `admin@alterra.mg` | `ChangeMe123!` |
| CDS / CDE | `*@alterra.test` | `test123!` |
| MinIO console | `alterra_admin` | `alterra_dev_secret` |

> ⚠️ Identifiants de **développement uniquement**. Jamais en staging/prod (voir `infra/` + `.env.prod`).

---

## Comment ça marche (mode `full`)

- **admin** et **pwa** sont buildés depuis leurs `Dockerfile` (build Vite → servis en statique par **nginx**).
- Les frontends appellent l'API en chemin **relatif** `/api/v1`. En mode conteneurisé, nginx **proxifie `/api` vers le conteneur `api`** (`api:3001`) via `admin/nginx.dev.conf` et `pwa/nginx.dev.conf`. Comme le proxy est côté serveur (même origine pour le navigateur), il n'y a pas de souci CORS.
- Les confs nginx de **prod** (`nginx.static.conf`) restent inchangées : en prod, c'est le nginx de tête de `infra/` qui route `/api`.
- Le profil `full` n'affecte que `admin` et `pwa` ; les autres services démarrent dans tous les modes.

---

## Opérations courantes

**Logs en direct :**
```bash
docker compose --profile full logs -f
docker compose --profile full logs -f api   # un seul service
```

**Rebuild après modification du code d'un frontend ou de l'API :**
```bash
docker compose --profile full up -d --build admin pwa api
```

**Arrêter (les volumes de données sont conservés) :**
```bash
docker compose --profile full down
```

**Repartir de zéro (⚠️ supprime les données Postgres/MinIO) :**
```bash
docker compose --profile full down -v
docker compose --profile full up -d --build
npm run db:setup -w backend
```

---

## Dépannage

| Symptôme | Cause probable | Solution |
| --- | --- | --- |
| `api` reste `unhealthy` | Migrations non appliquées / base injoignable | Lancer `npm run db:setup -w backend` ; vérifier `docker compose logs api` |
| Login renvoie 401 sur des comptes du seed | Base non seedée | `npm run db:setup -w backend` |
| `admin`/`pwa` ne démarrent pas | Profil oublié | Toujours passer `--profile full` |
| `/api/...` renvoie 404 HTML depuis le front | Front lancé sans le proxy `/api` | Utiliser le mode `full` (conf `nginx.dev.conf`), pas les images prod |
| Port déjà utilisé (5173/5174/3001/5433…) | Autre process ou mode dev hybride actif | Arrêter l'autre process ou changer le mapping de port |

### Notes de build (bugs corrigés)

Deux correctifs rendent les images buildables (ils valent aussi pour les images prod/GHCR) :

- **Frontends** : les `Dockerfile` de `admin` et `pwa` copient désormais le dossier partagé `design/` (`COPY design ./design`), requis par `@import "../../design/tokens.css"` dans `src/index.css`.
- **Backend** : le stage `runtime` copie le `node_modules` **racine** (dépendances hoistées par les workspaces npm, ex. `dotenv`, client Prisma généré) et élague les `devDependencies` (`npm prune --omit=dev`).

> L'image `api` reste volumineuse (~1,75 GB) : elle embarque **Chromium** pour la génération de PDF via Puppeteer. Ce n'est pas lié aux dépendances Node.
