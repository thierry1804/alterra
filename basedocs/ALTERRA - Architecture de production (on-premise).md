# Plateforme ALTERRA — Architecture de production (on-premise)

> Durcissement du prototype Node.js / React pour une exploitation en production chez ALTERRA (Antananarivo)
>
> Préparé pour : Thierry — NextA · Date : 20 juillet 2026 · Document de travail interne — v1.0

## 1. Synthèse exécutive

Ce document définit l'architecture de production de la plateforme ALTERRA, hébergée sur un serveur on-premise dans les locaux d'ALTERRA à Antananarivo. Il part du prototype existant (monorepo Node.js/Express + Prisma, back-office React, PWA terrain offline-first) et décrit ce qui doit être durci, remplacé ou ajouté pour une exploitation fiable : bascule de SQLite vers PostgreSQL 16, conteneurisation Docker Compose, stockage objet MinIO pour les photos, exposition Internet sécurisée via tunnel sortant, sauvegardes 3-2-1 avec copie hors site chiffrée, supervision, et chaîne CI/CD avec environnement de staging.

Le dimensionnement cible est le périmètre actuel : 5 lieux d'intervention, quelques centaines de MOC, une à deux dizaines d'utilisateurs simultanés (chefs d'équipe, chefs de service, administrateurs). Un serveur unique correctement dimensionné couvre ce besoin avec une marge confortable ; l'architecture reste néanmoins conçue pour migrer vers un VPS ou un second nœud sans réécriture si le périmètre s'étend.

Le point structurant d'un hébergement on-premise à Madagascar est double : l'exposition de l'API aux utilisateurs terrain (qui synchronisent depuis les sites via 2G/3G/4G) et la résilience face aux coupures d'électricité et d'Internet. Ces deux sujets sont traités comme des exigences de premier rang (§5 et §9).

## 2. Contexte et hypothèses

- **Hébergement :** serveur physique dans les locaux d'ALTERRA à Antananarivo, exploité conjointement par NextA (infogérance applicative) et ALTERRA (accès physique, électricité, connectivité).
- **Échelle :** 5 lieux d'intervention, plusieurs centaines de MOC actifs, pointages quotidiens par équipe — volumétrie annuelle estimée inférieure à 1 million de lignes de pointage, quelques dizaines de Go de photos.
- **Stack :** conservation de la stack du prototype (Node.js/Express + Prisma, React 18 + Vite pour le back-office et la PWA). Pas de réécriture applicative ; uniquement du durcissement.
- **Utilisateurs distants :** les chefs d'équipe et chefs de service travaillent sur le terrain et synchronisent via le réseau mobile. Le serveur doit donc être joignable depuis Internet en HTTPS, en permanence.
- **Conformité :** Loi malgache n° 2014-038 sur la protection des données personnelles — un hébergement local y répond nativement ; les copies de sauvegarde externalisées sont chiffrées avant envoi.

## 3. Écarts prototype → production

| Domaine           | Prototype actuel                            | Cible production                                                                         |
| ----------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Base de données   | SQLite (fichier `dev.db`)                   | PostgreSQL 16 conteneurisé, migrations Prisma, contraintes et index revus                |
| Fichiers / photos | Dossier local `./uploads` servi par Express | MinIO (S3-compatible), URL pré-signées, quotas et cycle de vie                           |
| Exécution         | `tsx watch`, `kill-port`, `.env` commité    | Images Docker immuables, secrets Docker, healthchecks, restart policies                  |
| Exposition        | `localhost:3001 / 5173 / 5174`, CORS dev    | Nginx + TLS 1.3, domaines `app.alterra.mg` et `admin.alterra.mg`, tunnel sortant         |
| Sauvegardes       | Aucune                                      | pgBackRest (PITR) + copie hors site chiffrée quotidienne, tests de restauration mensuels |
| Supervision       | Aucune                                      | Uptime Kuma + Netdata, alertes e-mail/SMS, healthcheck des jobs de sauvegarde            |
| CI/CD             | Aucune (`npm run dev`)                      | GitHub Actions : lint, tests, build image, déploiement avec approbation manuelle         |
| Rate limiting     | Désactivé hors production                   | Actif partout, ajusté par route (auth stricte, sync tolérante)                           |
| Logs              | `console.error`                             | Logs JSON structurés (pino), rotation, rétention 90 jours                                |

## 4. Architecture cible

### 4.1 Vue d'ensemble

Monolithe modulaire conteneurisé sur un serveur unique, derrière un reverse proxy. Tous les composants tournent en Docker Compose ; chaque service est remplaçable indépendamment.

| Composant       | Technologie                       | Rôle                                                                                                                  |
| --------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Reverse proxy   | Nginx 1.26                        | Terminaison TLS, service des fronts statiques (admin, PWA), proxy `/api` vers le backend, compression, cache statique |
| API             | Node.js 22 LTS + Express + Prisma | Logique métier, RBAC, sync idempotente des pointages (`clientUuid`), génération rapports PDF/Excel                    |
| Base de données | PostgreSQL 16                     | Source de vérité unique. Volume dédié, WAL archivé pour le PITR                                                       |
| Stockage objet  | MinIO                             | Photos MOC et rapports générés, accès par URL pré-signées à durée courte                                              |
| Cache / files   | Redis 7                           | Rate limiting distribué, files de jobs (rapports, push), sessions de refresh tokens                                   |
| Sauvegarde      | pgBackRest + rclone               | PITR local, copie chiffrée quotidienne vers stockage hors site (Backblaze B2)                                         |
| Supervision     | Uptime Kuma + Netdata             | Disponibilité HTTP, métriques système, alertes                                                                        |

**Flux principal :** PWA terrain (IndexedDB/Dexie, saisie offline) → HTTPS → Nginx → API Express → PostgreSQL. La synchronisation par lots avec `clientUuid` unique du prototype est conservée telle quelle : c'est le mécanisme d'idempotence qui rend l'offline sûr, et il est déjà testé.

### 4.2 Exposition Internet — le point critique on-premise

Un serveur on-premise doit être joignable par les utilisateurs terrain sans dépendre d'une IP fixe locale (rarement garantie et coûteuse à Madagascar) ni exposer directement le réseau d'ALTERRA. Deux options :

- **Option recommandée — tunnel sortant (Cloudflare Tunnel) :** un démon (`cloudflared`) établit une connexion sortante permanente depuis le serveur vers Cloudflare, qui publie `app.alterra.mg` et `admin.alterra.mg`. Aucun port entrant ouvert sur la box d'ALTERRA, TLS et protection DDoS inclus, IP fixe inutile, bascule 4G transparente. Coût nul (offre gratuite suffisante).
- **Option alternative — IP fixe + redirection de ports :** liaison fibre professionnelle avec IP fixe (Telma), NAT 443 vers Nginx, certificats Let's Encrypt en direct. Plus simple conceptuellement mais dépendante d'un seul opérateur, exposée aux scans, et la bascule de secours 4G change d'IP.

Dans les deux cas, l'administration du serveur (SSH) ne passe jamais par une exposition publique : accès par VPN WireGuard ou par le tunnel avec authentification forte, clés SSH uniquement, fail2ban actif.

### 4.3 Environnements

| Environnement | Localisation                                       | Usage                                                                                                |
| ------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Développement | Poste développeur (Docker Compose)                 | Base seedée, données de test, itération rapide                                                       |
| Staging       | Petit VPS (ou second Compose isolé sur le serveur) | Recette par ALTERRA avant chaque mise en production, données anonymisées, même topologie que la prod |
| Production    | Serveur on-premise Antananarivo                    | Exploitation réelle, sauvegardes et supervision actives                                              |

### 4.4 Structure du monorepo (architecture applicative)

Le monorepo npm workspaces du prototype est conservé et complété d'un dossier `infra/` pour tout ce qui relève du déploiement. Structure cible :

```
alterra/
├── package.json                # Workspaces : backend, admin, pwa
├── docker-compose.yml          # Dev local (postgres, minio, redis)
├── .github/
│   └── workflows/
│       ├── ci.yml              # Lint + tests + build sur chaque push
│       └── deploy.yml          # Build images + déploiement (approbation manuelle)
│
├── backend/                    # API Express + Prisma
│   ├── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma       # Provider postgresql, enums natifs, jsonb
│   │   ├── migrations/
│   │   └── seed.ts             # Seed dev/staging uniquement
│   └── src/
│       ├── index.ts            # Bootstrap serveur
│       ├── app.ts              # Middlewares globaux (helmet, cors, rate-limit)
│       ├── routes/             # 1 fichier par domaine (auth, sites, workers,
│       │                       #   teams, activities, pointages, payments,
│       │                       #   dashboard, biometric, reports, audit, push)
│       ├── middleware/         # auth (JWT), rbac, validate (zod)
│       ├── services/           # Logique métier extraite des routes
│       │   ├── dashboard/      # KPIs, graphiques présence/paie
│       │   ├── reports/        # Génération PDF (pdfkit) et Excel (exceljs)
│       │   └── storage/        # NOUVEAU : client MinIO, URL pré-signées
│       ├── lib/                # jwt, prisma, week, site-access, audit, logger (pino)
│       └── __tests__/          # Tests d'intégration vitest + supertest
│
├── admin/                      # Back-office React 18 + Vite
│   └── src/
│       ├── pages/              # 1 page par écran métier (Dashboard, Sites,
│       │                       #   Workers, Teams, Activities, Pointages,
│       │                       #   Payments, Reports, AuditLog…)
│       ├── components/
│       │   ├── ui/             # Design system (Radix + Tailwind)
│       │   ├── layout/         # Shell, navigation
│       │   └── sites/          # Composants métier (carte Madagascar SVG…)
│       ├── hooks/              # useAuth…
│       ├── lib/                # api (axios), auth-store, utils
│       ├── config/             # branding, coordonnées sites
│       └── types/
│
├── pwa/                        # App terrain React 18 + Vite PWA
│   └── src/
│       ├── pages/              # Pointage, Validation, ClotureHebdo, Sync,
│       │                       #   Teams, EnrollWorker, BiometricCheck…
│       ├── components/         # ui/, layout/, activities/, WorkerCard…
│       ├── db/                 # Schéma IndexedDB (Dexie)
│       ├── sync/               # SyncManager (batchs, retry), networkDetect
│       ├── hooks/              # useOfflineAuth, useSyncManager, useWorkers…
│       ├── lib/                # api, pointage-local, worker-cache, push
│       └── config/             # branding, thème activités
│
├── infra/                      # NOUVEAU : tout le déploiement, versionné
│   ├── docker-compose.prod.yml # nginx, api, postgres, minio, redis, backup
│   ├── docker-compose.staging.yml
│   ├── nginx/
│   │   └── nginx.conf          # TLS, fronts statiques, proxy /api
│   ├── cloudflared/
│   │   └── config.yml          # Tunnel app.alterra.mg / admin.alterra.mg
│   ├── pgbackrest/
│   │   └── pgbackrest.conf     # PITR, rétention 14 j
│   ├── scripts/
│   │   ├── deploy.sh           # pull + migrate + up -d
│   │   ├── rollback.sh         # Redéploiement du tag précédent
│   │   ├── backup-offsite.sh   # rclone crypt → Backblaze B2 + ping healthcheck
│   │   └── restore.sh          # Restauration testée mensuellement
│   └── secrets/                # Fichiers secrets Docker — NON versionnés (.gitignore)
│
└── docs/
    ├── parcours-utilisateurs/  # Existant
    └── runbook.md              # NOUVEAU : exploitation (redémarrage, alertes,
                                #   restauration, contacts, escalade)
```

Principes : les trois workspaces applicatifs du prototype sont inchangés (aucune réécriture) ; tout ce qui est nouveau se concentre dans `infra/`, `services/storage/` (MinIO) et les Dockerfiles. Le dossier `infra/` versionné rend le serveur reconstructible depuis le dépôt Git seul — condition du scénario de reprise décrit en §7. Les secrets n'entrent jamais dans Git : ils vivent en fichiers montés par Docker secrets, sauvegardés dans le coffre NextA.

## 5. Données

### 5.1 Migration SQLite → PostgreSQL

Le schéma Prisma du prototype est portable : la bascule consiste à changer le provider du datasource, régénérer les migrations sur PostgreSQL, puis re-typer les champs qui contournaient SQLite (chaînes JSON de `AuditLog` et `BiometricCheck` vers `jsonb`, dates ISO stockées en `String` vers `date` lorsque pertinent). Les enums simulés par `String` (role, status…) gagnent à devenir des enums PostgreSQL natifs. Les données du prototype ne sont pas migrées : la production démarre sur une base propre alimentée par l'import initial des référentiels (sites, activités, MOC).

### 5.2 Points de schéma à durcir

- **Index :** ajouter les index composites de requêtage réel — `Pointage(siteId, date)`, `Pointage(workerId, date)`, `Payment(weekIso)`, `AuditLog(entityType, entityId, createdAt)`.
- **Contraintes :** contrainte d'unicité `Pointage(workerId, activityId, date)` en complément du `clientUuid` pour bloquer les doublons métier ; triggers d'audit sur `Worker`, `Pointage`, `Payment` comme prévu dans la spécification technique.
- **Rétention :** pointages et paiements conservés 5 ans (exigence comptable), photos MOC conservées pendant la durée du contrat + 1 an, audit log 3 ans, purge par job mensuel avec journalisation.

### 5.3 Stockage objet

Les photos passent d'un dossier local à MinIO. L'API délivre des URL pré-signées à durée courte (15 minutes) au lieu de servir les fichiers directement, ce qui permet le contrôle d'accès par rôle et évite de faire transiter les images par Express. Le cache Workbox CacheFirst de la PWA reste efficace côté terrain.

## 6. Sécurité

- **Transport :** TLS 1.3 partout, HSTS, redirection 80→443. Aucun service (PostgreSQL, MinIO, Redis) exposé hors du réseau Docker interne.
- **Authentification :** conservation du dispositif du prototype — mots de passe argon2, JWT courts + refresh tokens en cookie httpOnly, MFA TOTP obligatoire pour les comptes ADMIN, recommandé pour CHEF_SERVICE.
- **Autorisation :** RBAC applicatif existant (ADMIN / CHEF_SERVICE / CHEF_EQUIPE) complété par le cloisonnement par site déjà présent (site-access), avec tests automatisés dédiés aux règles d'accès.
- **Secrets :** Docker secrets montés en fichiers (jamais en variables d'environnement commitées), rotation annuelle des secrets JWT, coffre des secrets tenu par NextA.
- **Durcissement système :** Ubuntu Server LTS minimal, mises à jour de sécurité automatiques (unattended-upgrades), pare-feu nftables par défaut deny, SSH par clés + fail2ban, comptes nominatifs.
- **Rate limiting :** actif en permanence — strict sur `/auth` (anti-bruteforce), dimensionné large sur `/pointages/sync` pour ne jamais pénaliser une resynchronisation massive après une longue coupure réseau terrain.
- **Audit :** `AuditLog` du prototype conservé (diff avant/après), complété par les triggers PostgreSQL sur les tables critiques, consultation en lecture seule depuis le back-office.
- **Conformité 2014-038 :** données hébergées sur le territoire malgache, registre des traitements, procédure de droit à l'effacement (anonymisation du MOC, conservation des agrégats comptables), sauvegardes externalisées chiffrées côté serveur avant envoi (le prestataire hors site ne voit jamais de données en clair).

## 7. Sauvegardes et reprise d'activité

**Objectifs :** RPO 15 minutes (perte de données maximale), RTO 4 heures ouvrées (durée maximale de restauration). Stratégie 3-2-1 : trois copies, deux supports, une hors site.

| Niveau              | Mécanisme                                                            | Fréquence                                         | Rétention                |
| ------------------- | -------------------------------------------------------------------- | ------------------------------------------------- | ------------------------ |
| PITR local          | pgBackRest : base complète + archivage WAL continu sur second disque | Complet hebdo, incrémental quotidien, WAL continu | 14 jours                 |
| Hors site chiffré   | rclone crypt vers Backblaze B2 (dump + WAL + bucket MinIO)           | Quotidienne (nuit)                                | 30 jours + 12 mensuelles |
| Copie froide locale | Export mensuel sur disque USB chiffré conservé hors du local serveur | Mensuelle                                         | 12 mois                  |

Chaque job de sauvegarde notifie un service de healthcheck (Healthchecks.io ou instance auto-hébergée) : l'absence de notification déclenche une alerte, ce qui détecte les sauvegardes silencieusement en échec — le mode de défaillance le plus courant. Un test de restauration complet sur staging est réalisé chaque mois et consigné ; une sauvegarde non testée n'est pas considérée comme une sauvegarde.

**Scénario sinistre majeur (serveur détruit ou volé) :** restauration de la dernière copie hors site sur un VPS de secours (OVH ou Telma), rebascule DNS via le tunnel — l'architecture conteneurisée rend le serveur reconstructible en quelques heures à partir du dépôt Git et des sauvegardes. Pendant l'indisponibilité, la PWA terrain continue de fonctionner en mode offline et resynchronise au retour du service : c'est l'avantage décisif du modèle offline-first du prototype.

## 8. Résilience électrique et réseau (spécifique Antananarivo)

- **Électricité :** onduleur en ligne (double conversion) dimensionné pour 30 minutes minimum, arrêt propre automatisé (NUT) au-delà du seuil, groupe électrogène du bâtiment si disponible. Le délestage est un événement normal, pas une exception : le serveur doit s'éteindre et redémarrer proprement sans intervention (`restart: always`, fsck automatique, démarrage ordonné des conteneurs).
- **Connectivité :** liaison principale fibre (Telma ou Orange) + routeur 4G de secours avec bascule automatique. Le tunnel sortant rétablit l'exposition publique dès le retour de n'importe quelle connectivité, sans reconfiguration.
- **Matériel :** deux disques NVMe en RAID 1 (miroir) pour le système et les données, disque supplémentaire dédié aux sauvegardes locales, alerte SMART. Pièces de rechange critiques (disque, alimentation) en stock local, les délais d'import étant longs.
- **Local :** pièce fermée à clé, ventilée, accès consigné. Le serveur héberge des données personnelles : la sécurité physique fait partie de la conformité.

## 9. Observabilité

- **Disponibilité :** Uptime Kuma supervise `/health` de l'API, l'admin et la PWA depuis l'intérieur, plus une sonde externe (UptimeRobot gratuit) qui vérifie la joignabilité publique — indispensable pour détecter une panne du tunnel ou de la connectivité vue du terrain.
- **Métriques système :** Netdata sur le serveur (CPU, RAM, disque, I/O PostgreSQL), seuils d'alerte sur l'espace disque (les WAL et les photos sont les deux consommateurs à surveiller).
- **Logs :** pino en JSON vers stdout, collectés par Docker avec rotation (max-size/max-file), rétention 90 jours. Corrélation par requestId injecté en middleware.
- **Alertes :** e-mail + SMS (passerelle Telma) vers NextA et le référent ALTERRA. Trois niveaux : information, dégradé, critique. Une alerte critique non acquittée en 30 minutes est escaladée.
- **Indicateurs métier :** taux d'échec de synchronisation, ancienneté du plus vieux pointage non synchronisé, nombre de pointages en erreur — exposés dans le dashboard admin existant, car un problème de sync est un incident métier avant d'être un incident technique.

## 10. CI/CD et exploitation

GitHub Actions exécute lint, tests (vitest backend et front) et build des images Docker à chaque push ; le déploiement en production exige une approbation manuelle. Les images sont taguées par SHA et publiées sur GHCR : le déploiement est un `docker compose pull && up -d`, le retour arrière est le redéploiement du tag précédent. Les migrations Prisma sont appliquées en étape explicite avant la bascule, avec sauvegarde automatique juste avant.

Le déploiement vers le serveur on-premise passe par le tunnel (SSH via Cloudflare Access ou WireGuard), jamais par un port SSH public. Une fenêtre de maintenance hebdomadaire (mardi 12h–14h, créneau de faible activité terrain) couvre mises à jour système et déploiements ; la PWA offline rend ces courtes indisponibilités invisibles pour le terrain.

## 11. Dimensionnement et coûts indicatifs

Pour 5 sites et quelques centaines de MOC, la charge est faible (pics lors des synchronisations du matin et des clôtures hebdomadaires). Le dimensionnement ci-dessous inclut une marge de croissance x3 sans changement.

| Poste             | Spécification                                                                     | Coût indicatif             |
| ----------------- | --------------------------------------------------------------------------------- | -------------------------- |
| Serveur           | 8 cœurs (ex. Ryzen 7 / Xeon E), 32 Go ECC, 2 × 1 To NVMe RAID 1 + 2 To sauvegarde | 2 500 – 4 000 USD (unique) |
| Onduleur          | En ligne 1 500 VA + carte de supervision                                          | 400 – 700 USD (unique)     |
| Connectivité      | Fibre pro + routeur 4G secours                                                    | 80 – 150 USD / mois        |
| Hors site         | Backblaze B2 (~100 Go chiffrés)                                                   | ≈ 1 USD / mois             |
| Tunnel / DNS      | Cloudflare (offre gratuite) + domaine alterra.mg                                  | ≈ 50 USD / an              |
| VPS staging       | 2 vCPU / 4 Go                                                                     | ≈ 10 – 15 USD / mois       |
| Infogérance NextA | Supervision, mises à jour, astreinte — forfait                                    | 1 – 2 j-h / mois           |

Le coût récurrent d'infrastructure reste sous 200 USD/mois, l'investissement initial matériel autour de 3 000 – 4 700 USD. À comparer à un VPS équivalent (≈ 40 – 80 USD/mois) : l'on-premise se justifie ici par la souveraineté des données et la maîtrise physique, pas par l'économie.

## 12. Plan de mise en production

| Phase                                 | Contenu                                                                                              | Durée                          |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------ |
| 1. Socle infrastructure               | Installation serveur, Docker, tunnel, TLS, pare-feu, VPN admin, staging                              | 4 jours                        |
| 2. Durcissement applicatif            | Migration Prisma → PostgreSQL, MinIO + URL pré-signées, logs pino, rate limiting, revue CORS/secrets | 6 jours                        |
| 3. Sauvegardes & supervision          | pgBackRest, rclone hors site, Uptime Kuma, Netdata, alertes, premier test de restauration            | 3 jours                        |
| 4. CI/CD                              | Pipelines GitHub Actions, registre GHCR, procédure de déploiement et de rollback documentée          | 2 jours                        |
| 5. Recette & reprise des référentiels | Import sites / activités / MOC, recette ALTERRA sur staging, tests de charge sync                    | 3 jours                        |
| 6. Bascule & hypercare                | Mise en production, formation exploitation, support renforcé                                         | 2 jours + 2 semaines hypercare |

**Total : ≈ 20 jours-homme**, hors délais d'approvisionnement matériel (à anticiper : 3 à 6 semaines d'import pour le serveur et l'onduleur).

## 13. Risques et mitigations

| Risque                                     | Niveau | Mitigation                                                                                                                              |
| ------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Coupures électriques longues (délestage)   | Élevé  | Onduleur + arrêt propre automatisé ; le mode offline de la PWA absorbe l'indisponibilité côté terrain                                   |
| Perte de connectivité du local             | Élevé  | Double lien fibre + 4G, bascule automatique, sonde externe pour détection immédiate                                                     |
| Sinistre du serveur (panne, vol, incendie) | Moyen  | Sauvegardes 3-2-1 chiffrées, procédure de restauration sur VPS de secours testée mensuellement (RTO 4 h)                                |
| Compétences exploitation chez ALTERRA      | Moyen  | Infogérance NextA, runbook d'exploitation, formation du référent ALTERRA, gestes simples documentés (redémarrage, vérification alertes) |
| Croissance au-delà du dimensionnement      | Faible | Architecture conteneurisée portable telle quelle vers VPS ou serveur plus gros ; PostgreSQL et MinIO scalent verticalement sans refonte |
| Saturation disque (WAL, photos)            | Moyen  | Alertes à 70 % et 85 %, cycle de vie MinIO, purge planifiée, disque données majoré dès l'achat                                          |

## 14. Recommandations

L'architecture proposée durcit l'existant sans le réécrire : le cœur applicatif du prototype (sync idempotente, RBAC, audit) est sain et devient production-ready par le remplacement de ses fondations (PostgreSQL, MinIO, conteneurisation) et l'ajout de ce qui n'existe pas encore (sauvegardes, supervision, CI/CD, exposition sécurisée).

Trois décisions sont à valider avec ALTERRA avant la phase 1 : le choix du mode d'exposition (tunnel Cloudflare recommandé — à arbitrer si une exigence de souveraineté stricte exclut un intermédiaire étranger, auquel cas l'option IP fixe + WireGuard s'impose) ; la commande du matériel (délais d'import dimensionnants) ; et le partage des responsabilités d'exploitation entre NextA et ALTERRA, à formaliser dans un runbook et un contrat d'infogérance.

---

_Document de travail interne — à valider avec le référent technique ALTERRA avant diffusion externe._
