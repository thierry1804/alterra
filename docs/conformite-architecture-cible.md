# Conformité à l'architecture cible

> Confronte l'architecture cible ALTERRA (vue conteneurs C4, v1.2 — source datée 2026-08-13)
> au code réel du monorepo. Audit du 2026-08-19.
> Source cible : artifact « Architecture cible ALTERRA » ; voir aussi [architecture-technique.md](architecture-technique.md).

## Verdict

L'architecture du repo **respecte la cible v1.2**, avec **un seul écart assumé** : le provider biométrique reste AXIAN dans le code alors que la cible nomme YAS (voir [§ Écart AXIAN vs YAS](#écart-axian-vs-yas)).

## Tableau de conformité

| Brique cible (C4) | Attendu | Réel dans le code | Statut |
|---|---|---|---|
| **PWA Terrain** | React 18 + Vite, Dexie/IndexedDB, offline-first | `pwa/` — `dexie@4`, Vite PWA | ✅ |
| **Admin** | React 18 + Vite, Radix UI + Tailwind | `admin/` — `@radix-ui/*`, `tailwindcss@3` | ✅ |
| **cloudflared** | Tunnel sortant, 0 port entrant | `infra/cloudflared/config.yml`, service dans `docker-compose.prod.yml` | ✅ |
| **Nginx 1.26** | TLS 1.3, reverse proxy, sert admin/pwa, proxy `/api/*` | `nginx:1.26-alpine`, `infra/nginx/nginx.conf` → `ssl_protocols TLSv1.3` | ✅ |
| **API Express** | Node 22, Prisma 5, RBAC + RLS applicative | `express@4`, `prisma@5.20`, `.nvmrc`=22.12, `middleware/rbac.ts` + `middleware/prisma-rls.ts` | ✅ |
| **Worker BullMQ** | `pdf.worker.ts`, rapports PDF/Excel | `bullmq@5`, `backend/src/jobs/pdf.worker.ts` | ✅ |
| **PostgreSQL 16** | source de vérité | `postgres:16-alpine` | ✅ |
| **Redis 7** | rate-limit / jobs / sessions | `redis:7-alpine` | ✅ |
| **MinIO (S3)** | photos MOC · rapports | `minio/minio`, buckets `photos-pointages` / `rapports-pdf` | ✅ |
| **Sync idempotent** | offline → batch `/api/v1` → upsert `clientUuid` | `services/pointages/sync.service.ts`, `clientUuid` de bout en bout | ✅ |
| **Backblaze B2 offsite** | chiffré rclone crypt + Healthchecks.io | `infra/scripts/backup-offsite.sh` — `rclone crypt`, `b2crypt:`, `HEALTHCHECK_URL` | ✅ |
| **pgBackRest** | WAL archive local | `infra/pgbackrest/pgbackrest.conf` + volume `pg_wal_archive` | ✅ |
| **Provider biométrique** | **YAS** (vérif faciale) | `AxianBiometricProvider` — `BioProvider.AXIAN`, `biometric.axian.mg`, `AXIAN_API_KEY` | ⚠️ écart |

## Écart AXIAN vs YAS

La cible v1.2 nomme **YAS** comme provider biométrique (« remplace AXIAN »), mais le code est encore entièrement câblé sur **AXIAN** :

- `backend/src/services/biometric/AxianBiometricProvider.ts` → `provider = BioProvider.AXIAN`
- URL par défaut `https://biometric.axian.mg/api/v1/kyc/compare`
- Variables d'env `AXIAN_API_URL` / `AXIAN_API_KEY`

### Décision (2026-08-19) : ne pas faire de renommage cosmétique AXIAN → YAS

**Raison.** La 2ᵉ section de l'artifact cible (« Vérification biométrique — Intent APK ») est marquée **« Proposition — non intégrée »**. Le flux cible ne passe plus par un appel REST cloud depuis le backend, mais par une **APK Android invoquée via Intent / deep-link** depuis la PWA (cf. [cadrage/biometrie-v2-intent-apk.md](cadrage/biometrie-v2-intent-apk.md)). Toute la couche biométrique actuelle (Axian REST + Manual + Mock + offline) est donc destinée à être **remplacée, pas renommée**.

**Conséquence.** Le vrai chantier n'est pas le renommage mais l'intégration du flux APK Intent. Point d'attention n°1 : **validation serveur obligatoire** du résultat — le callback deep-link est falsifiable côté client (signature ou confirmation serveur-à-serveur avant de créer un `BiometricCheck`).

## Note sur le mode Docker `--profile full`

Le mode « app complète » local (voir [guides/demarrage-docker.md](guides/demarrage-docker.md)) respecte le pattern cible : nginx sert les fronts en statique et proxifie `/api` vers l'API. Seule différence, un choix de commodité *dev* — un nginx par front (`admin/nginx.dev.conf`, `pwa/nginx.dev.conf` sur `:5173`/`:5174`) là où la **prod** garde le nginx de tête unique de `infra/`. Conforme à la cible.
