# Plateforme ALTERRA — Spécifications fonctionnelles et techniques

**Gestion du pointage, du contrôle biométrique et du paiement des Mains-d'Œuvre Communautaires (MOC) sur 5 sites**

Web App Admin + PWA Terrain (Chef d'Équipe & Chef de Service) — Stack Node.js (NestJS) + Prisma + PostgreSQL + React (PWA offline-first) + NFC + Web Crypto.

Document de référence pour prototypage et chiffrage.
Préparé par : Thierry — NextA. v3.0 — 28 avril 2026.

---

## 1. Synthèse exécutive

Cette version intègre les retours de la présentation du prototype et précise sept évolutions majeures par rapport à la v2 : (i) pointage de présence par NFC, (ii) contrôle biométrique remonté au niveau du pointage quotidien avec cache offline chiffré, (iii) gestion d'équipe par le Chef d'Équipe et composition d'équipes par le Chef de Service, (iv) workflows de demandes (précisions, activités, MOC) entre rôles, (v) hiérarchie géographique à trois niveaux Site / Zone / Parcelle, (vi) clôture quotidienne possible avec rapport journalier pour rapprocher le paiement de la fin de journée, (vii) cartographie interactive côté Admin.

La solution est conçue pour être **livrée en deux phases** afin de garantir une mise en production rapide tout en absorbant la complexité des extensions terrain. La **V1** couvre le périmètre cœur — pointage à la tâche par PWA, validation hebdomadaire avec biométrie en ligne, génération du fichier Excel MVola — en 50 j-h sur 12 semaines. La **V2** ajoute les extensions terrain riches — NFC, biométrie offline, workflows, hiérarchie Zone/Parcelle, cartographie, clôture quotidienne — en 20 j-h supplémentaires sur 4 à 5 semaines.

L'architecture reste souveraine : tout le code et les données vivent sur l'infrastructure d'ALTERRA, aucun service tiers de type Backend-as-a-Service n'est utilisé. Le paiement n'est jamais effectué par API : le système génère un fichier Excel au format MVola Bulk Transfer que l'Administrateur soumet via les canaux MVola standards.

---

## 2. Contexte et utilisateurs

### 2.1 Le client ALTERRA

ALTERRA est un opérateur malgache spécialisé en reforestation, agroforesterie et conservation. Cinq sites, chacun avec une activité dominante :

| Site         | Activité principale            | Code (paiement MVola) |
| ------------ | ------------------------------ | --------------------- |
| Manankazo    | Reforestation à grande échelle | MNK                   |
| Antsampanana | Agroforesterie & bambou        | ANT                   |
| Anjozorobe   | Conservation forêt naturelle   | ANJ                   |
| Mangatsa     | Production fruitière           | MGT                   |
| Ambondromamy | Production fruitière           | AMB                   |

Chaque campagne s'étend de juillet à juin de l'année suivante. ALTERRA mobilise plusieurs centaines de MOC actifs simultanément, avec une rotation pouvant porter le total annuel à environ un millier d'individus.

### 2.2 Population utilisateurs

| Rôle            | Effectif        | Outil et contexte d'usage                                                                                                                                                                                     |
| --------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Administrateur  | 1               | Web App Admin sur poste de travail au siège, environnement connecté.                                                                                                                                          |
| Chef de Service | 5 (1 par site)  | PWA sur smartphone ou tablette, utilisée au camp de base. Connexion semi-disponible. Gère la composition des équipes, valide les pointages, déclenche les workflows de demandes.                              |
| Chef d'Équipe   | 15 (3 par site) | PWA sur smartphone Android avec NFC, utilisée quotidiennement sur le terrain. Mode offline-critique. Effectue le pointage de présence (NFC), le pointage de tâche, et le contrôle biométrique en cache local. |

### 2.3 Volumétrie cible

- **MOC actifs simultanément** : ≈ 600 (5 sites × 3 équipes × 40 MOC), jusqu'à 1 000 individus sur la campagne.
- **Pointages de tâche par campagne** : ≈ 150 000.
- **Pointages de présence NFC par campagne** : ≈ 150 000 (idem).
- **Vérifications biométriques par campagne** : jusqu'à 150 000 (passage de hebdomadaire à quotidien).
- **Lignes de paiement par campagne** : ≈ 30 000 si paiement hebdomadaire, jusqu'à 150 000 si quotidien.
- **Charge concurrente PWA** : 15 utilisateurs simultanés en matinée (pointage), 5 en fin de journée (clôture).

### 2.4 Workflow métier mis à jour

**Quotidien — Chef d'Équipe sur le terrain**

1. Démarrage de journée : choix de l'activité préconfigurée du jour.
2. Pointage de **présence** : le Chef d'Équipe scanne le badge NFC de chaque MOC à l'arrivée → horodatage présence enregistré localement.
3. Pointage de **tâche** : tout au long de la journée, saisie de la quantité réalisée par MOC (ex. nombre de trous).
4. **Contrôle biométrique** : pour chaque pointage de tâche, vérification via cache local (photo de référence pré-chargée le matin via API AXIAN). En mode offline, la comparaison se fait localement ; en ligne, l'appel API AXIAN peut compléter.
5. Synchronisation au retour de connexion.

**Quotidien — Chef de Service au camp de base**

1. Consultation des pointages remontés par les Chefs d'Équipe.
2. Filtres par Site / Zone / Parcelle / Équipe / Semaine.
3. Validation en lot (par parcelle ou par équipe) ou unitaire.
4. **Demandes de précisions** vers les Chefs d'Équipe avant validation (texte, photo).
5. **Clôture quotidienne** des activités validées → génération automatique du rapport journalier.
6. Soumission de **demandes** vers l'Admin : création d'activité, intégration de nouveau MOC.

**Hebdomadaire ou quotidien — Administrateur**

1. Consolidation des rapports remontés des 5 sites.
2. Traitement des demandes terrain (activités, MOC).
3. Génération du fichier Excel MVola (rythme hebdomadaire ou quotidien selon décision opérationnelle).
4. Soumission MVola par les canaux standards.
5. Import des statuts de retour.

---

## 3. Stratégie de livraison V1 + V2

### 3.1 Pourquoi en deux phases

L'élargissement du périmètre (NFC, biométrie offline, workflows, Zone/Parcelle, cartographie, clôture quotidienne) porte la charge totale au-delà des 50 j-h initialement visés. Plutôt que de tout livrer en un seul jet plus risqué, on découpe en deux livraisons distinctes qui apportent chacune une valeur opérationnelle complète.

### 3.2 Périmètre V1 — 50 j-h, 12 semaines

Objectif : système de pointage et de paiement opérationnel pour démarrer une campagne.

- Pointage à la tâche par PWA Chef d'Équipe (sans NFC, sans biométrie offline).
- Validation hebdomadaire par Chef de Service avec biométrie online (mode mock + manuel en absence d'API AXIAN stable).
- Web App Admin complète sauf cartographie et workflows de demandes (création directe en V1).
- Génération du fichier Excel MVola Bulk Transfer.
- Hiérarchie géographique simple : Site uniquement.
- Rythme de clôture hebdomadaire.

### 3.3 Périmètre V2 — 20 j-h, 4 à 5 semaines

Objectif : enrichir l'expérience terrain et la gouvernance.

- NFC pour le pointage de présence.
- Biométrie offline avec cache local chiffré et pré-fetch différentiel.
- Workflows de demandes : précisions Chef de Service → Chef d'Équipe, demandes d'activités et de MOC vers Admin.
- Composition d'équipes côté PWA Chef de Service.
- Gestion d'équipe locale par le Chef d'Équipe (ajout/retrait depuis base existante).
- Hiérarchie Zone et Parcelle dans tout le modèle de données.
- Cartographie interactive côté Admin.
- Clôture quotidienne possible avec rapport journalier.

### 3.4 Engagement contractuel proposé

- V1 ferme à signature.
- V2 en option, déclenchée après recette V1, sur la base d'un avenant chiffrage actualisé selon les apprentissages du terrain.

---

## 4. Architecture cible

### 4.1 Vue d'ensemble

Monolithe modulaire NestJS sur PostgreSQL, deux frontends React partageant un design system. Un seul VPS au démarrage, possibilité d'éclater plus tard sans changement de code.

| Couche                | Composants                                                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Front-end Admin       | React 18 + Vite, TypeScript, Tailwind CSS, shadcn/ui, Leaflet pour la cartographie (V2).                                         |
| Front-end PWA Terrain | React 18 + Vite + vite-plugin-pwa, TypeScript, Tailwind CSS, Dexie.js (IndexedDB), Workbox. Web NFC API (V2) sur Chrome Android. |
| API métier            | Node.js 20 LTS + NestJS, TypeScript, Prisma ORM, JWT, class-validator, Pino, BullMQ.                                             |
| Base de données       | PostgreSQL 16, migrations Prisma.                                                                                                |
| Stockage objet        | MinIO S3-compatible : photos de pointage et de validation ; rapports PDF générés.                                                |
| Module biométrique    | NestJS module avec adapter pattern : MockProvider / ManualProvider / AxianProvider (V1) + cache offline côté PWA chiffré (V2).   |
| Génération paiement   | Module dédié : agrégation des pointages validés, génération Excel format MVola Bulk Transfer.                                    |
| Cartographie (V2)     | Leaflet + tuiles OSM / MapTiler côté Admin uniquement.                                                                           |
| Hébergement           | VPS Linux Ubuntu 22 LTS chez OVH ou Telma, Docker Compose, Nginx + Let's Encrypt, backup quotidien externalisé.                  |

### 4.2 Flux principaux

```
[ Chef d'Équipe ]    [ Chef de Service ]    [ Administrateur ]
   (mobile NFC,         (PWA, mobile)         (Web Admin, bureau)
    offline)
        |                    |                       |
        +----------+---------+                       |
                   |                                 |
           PWA Terrain (offline-first)        Web App Admin (SPA)
            • Pointage tâche                    • Référentiels
            • Pointage NFC                      • Pointages
            • Biométrie offline                 • Paiements MVola
            • Demandes                          • Cartographie (V2)
            • Composition équipes               • Validation demandes
                   |                                 |
                   +---------> HTTPS / JWT <---------+
                                  |
                  [ API NestJS + Prisma + PostgreSQL ]
                                  |
   +-------+------+--------+---------+-----------+--------+
   |       |      |        |         |           |
  PG    MinIO  µservice  µservice  µservice    SMS/Email
              biométrie  paiement  workflows
              (AXIAN +   (Excel    (demandes,
              cache)     MVola)    validations)
```

### 4.3 Principes directeurs

- **Souveraineté** : tout le code et toutes les données vivent sur l'infrastructure d'ALTERRA.
- **Offline-first** : la PWA fonctionne sans réseau toute une journée, y compris pour la biométrie (V2).
- **Sécurité par défaut** : HTTPS partout, JWT signés, permissions à double niveau (API + Prisma), audit log append-only, données biométriques chiffrées en local.
- **Évolutivité maîtrisée** : stack standard maintenable par tout développeur fullstack Node + React.
- **Livraison incrémentale** : V1 met en production rapidement, V2 ajoute la richesse fonctionnelle terrain.

---

## 5. Plateforme A — Web App Admin

### 5.1 Persona et contexte

L'Administrateur travaille au siège, en environnement connecté. Il pilote le référentiel, supervise les sites via les rapports, gère les paiements MVola, traite les demandes terrain, et garde la main sur les ajustements.

### 5.2 Modules fonctionnels (V1)

#### 5.2.1 Authentification et sécurité

- Connexion email + mot de passe (Argon2id).
- MFA optionnel TOTP.
- Récupération de mot de passe par lien email à durée limitée.
- Sessions JWT : access 15 min, refresh 7 jours en cookie HttpOnly Secure.

#### 5.2.2 Tableau de bord

- KPI : MOC actifs par site, pointages de la semaine, paiements en attente, montant à payer, anomalies.
- Graphes : présence quotidienne par site, évolution effectifs, montants payés par mois.
- Alertes : Chefs de Service non synchronisés depuis 24h, écarts biométriques non résolus.

#### 5.2.3 Référentiels

- **Sites** : CRUD nom, code court, localisation.
- **Activités** : CRUD libellé, unité, tarif unitaire, versioning des tarifs, scope global ou par site.
- **Travailleurs (MOC)** : CRUD complet (état civil, photo, MVola, CIN, site, équipe), recherche, filtres, import Excel.
- **Comptes utilisateurs** : CRUD Admin, Chef de Service, Chef d'Équipe avec affectations.

#### 5.2.4 Suivi et correction des pointages

- Liste filtrable par site, semaine, MOC, activité, statut.
- Visualisation photo de pointage et géolocalisation.
- Correction unitaire avec motif obligatoire.
- Détection automatique d'anomalies.

#### 5.2.5 Génération du fichier de paiement MVola

- Calcul automatique sur les pointages validés : montant = somme(quantité × tarif unitaire).
- Bordereau avec détail par MOC : prénom, nom, site, numéro MVola, montant, statut biométrique, **booléen validation biométrique** (utilisé dans l'export).
- Modifications manuelles possibles avec motif.
- Génération du fichier Excel au format MVola Bulk Transfer.

**Format du fichier Excel généré (V1)**

| Numéro téléphone | Description         | Semaine | Montant (Ar) | Validation biométrique |
| ---------------- | ------------------- | ------- | ------------ | ---------------------- |
| 034XXXXXXX       | Rakoto Paiement MNK | S18     | 125 000      | OUI                    |
| 034YYYYYYY       | Rasoa Paiement MNK  | S18     | 98 500       | OUI                    |

#### 5.2.6 Reporting et exports

- Rapports prédéfinis : pointages mensuels, paiements mensuels, présences par site, productivité par activité.
- Export CSV / Excel / PDF de toute liste filtrée.
- Rapport mensuel automatique envoyé par email à une liste configurable.

#### 5.2.7 Audit log

- Toutes les actions sensibles journalisées.
- Vue lecture seule, filtrable par utilisateur, action, entité, période.
- Conservation 24 mois.

### 5.3 Modules fonctionnels (V2)

#### 5.3.1 Cartographie interactive

- Carte Leaflet centrée sur Madagascar avec marqueurs par site.
- Couches superposables : Site, Zones, Parcelles.
- Click marqueur → vue détaillée (effectif, activité du jour, pointages récents).
- Filtres par statut d'activité.

#### 5.3.2 Validation des demandes terrain

- File d'attente unifiée des demandes remontées par les Chefs de Service.
- Trois types : nouvelle activité (avec tarif proposé), nouveau MOC (avec photo), précisions sur pointage.
- Pour chaque demande : actions Accepter / Refuser avec motif / Demander complément.
- Une activité acceptée est créée automatiquement dans le référentiel ; un MOC accepté est créé et affecté à l'équipe demandée.

#### 5.3.3 Hiérarchie géographique (Zone / Parcelle)

- CRUD Zones (sous un Site) et Parcelles (sous une Zone).
- Affectation des MOC, équipes et pointages à la Parcelle.
- Visualisation tabulaire et cartographique.

### 5.4 Écrans clés

- V1 : Tableau de bord, Référentiels, Pointages, Paiements, Audit log.
- V2 : Cartographie, File de demandes, Gestion Zones/Parcelles.

---

## 6. Plateforme B — PWA Terrain

### 6.1 Persona et contexte

Une seule PWA, partagée entre Chefs d'Équipe et Chefs de Service selon le rôle authentifié. Mobile-first, installable depuis le navigateur. Fonctionnement offline complet.

### 6.2 Mode Chef d'Équipe — pointage quotidien (V1)

#### 6.2.1 Démarrage de journée

- Authentification (token cache local valide hors ligne).
- Sélection de l'activité du jour parmi le référentiel synchronisé.
- Confirmation de l'équipe (préchargée depuis l'affectation Admin).

#### 6.2.2 Saisie en lot des quantités

- Écran liste des ~40 travailleurs avec photos miniatures.
- Champ numérique pour la quantité par MOC, clavier numérique systématique.
- Recherche rapide par nom.
- Quantité par défaut applicable à l'ensemble puis ajustement individuel.
- Calcul prévisionnel du montant affiché en bas.
- Bouton Enregistrer : écriture immédiate en IndexedDB, statut pending sync.

#### 6.2.3 Capture du contexte

- Géolocalisation capturée automatiquement à l'enregistrement.
- Photo d'illustration optionnelle de la zone de travail.
- Note libre par travailleur (rare).

#### 6.2.4 Synchronisation

- Auto-sync arrière-plan dès connexion détectée.
- Sync manuelle déclenchable (**bouton Forcer la synchronisation**).
- Indicateur permanent du nombre de pointages en attente.
- Idempotence via `clientUuid`.

### 6.3 Mode Chef d'Équipe — extensions V2

#### 6.3.1 Gestion d'équipe locale

- Le Chef d'Équipe peut ajouter ou retirer un MOC de son équipe.
- Sélection uniquement depuis la base de MOC existants (autocomplétion par nom).
- Aucune création de nouveau MOC à ce niveau.
- Synchronisation différentielle vers le serveur.

#### 6.3.2 Pointage de présence par NFC

- Activation d'un mode « Pointage présence » dans la PWA.
- Le téléphone passe en mode lecteur NFC (Web NFC API).
- Scan successif des badges des MOC à l'arrivée → enregistrement local de l'horodatage avec ID badge.
- Mapping badge ↔ MOC géré côté serveur, synchronisé en cache local.
- Distinct du pointage de tâche : le pointage de présence sert au suivi horaire, le pointage de tâche à la rémunération.

#### 6.3.3 Contrôle biométrique offline

- Au moment du pointage de tâche, la PWA active la caméra.
- Capture d'une photo du MOC présent.
- Comparaison locale avec la photo KYC pré-chargée le matin dans le cache chiffré.
- Si l'algorithme de comparaison embarqué (face-api.js ou équivalent léger) renvoie un score au-dessus du seuil → validation OK.
- Si en-dessous → marquage DOUBT, l'Admin recevra la photo pour revue à la sync.
- Si connexion disponible : appel parallèle API AXIAN pour double vérification.

### 6.4 Mode Chef de Service — validation hebdomadaire (V1)

#### 6.4.1 Préparation

- Liste des MOC du site avec pointages de la semaine, regroupés par équipe.
- Indicateur pour chaque MOC : nombre de pointages, montant prévisionnel.
- Filtres : par équipe, par statut.

#### 6.4.2 Contrôle biométrique unitaire

- Photo en direct du MOC convoqué.
- Envoi à l'API AXIAN avec numéro MVola en référence.
- Résultat affiché : OK / DOUTEUX / KO.
- Pas de stockage local de la photo après envoi (V1).

#### 6.4.3 Validation des pointages

- Si OK : validation de tous les pointages de la semaine du MOC en un clic.
- Si DOUTEUX : nouvelle photo ou validation manuelle avec motif.
- Si KO : pointages en suspens, escalade Admin.
- Correction des quantités possible avant validation, avec motif.

#### 6.4.4 Génération rapport et facture

- Rapport hebdomadaire PDF : détail par jour, par activité, par MOC.
- Facture hebdomadaire PDF : récapitulatif par site et par activité.
- Signature électronique du Chef de Service avec horodatage.
- Notification email à l'Admin.

### 6.5 Mode Chef de Service — extensions V2

#### 6.5.1 Composition des équipes

- Création d'une équipe : nom, Chef d'Équipe affecté, ajout des membres.
- Modification d'équipes existantes.
- Visualisation de la composition à un instant T.

#### 6.5.2 Validation par lot avec filtres Zone/Parcelle

- Filtres étendus : Semaine + Zone + Parcelle + Équipe.
- Validation en lot sur sélection multiple.
- Contrôle anti-erreur : confirmation explicite si > 50 pointages d'un coup.

#### 6.5.3 Workflows de demandes

- **Demande de précisions** vers Chef d'Équipe : texte libre + demande optionnelle de photo. État : OUVERTE → RÉPONDUE → CLÔTURÉE.
- **Demande d'activité** vers Admin : libellé, unité, tarif proposé, justification. État : SOUMISE → APPROUVÉE / REJETÉE.
- **Demande d'ajout de MOC** vers Admin : nom, prénom, CIN, MVola, photo, équipe cible, justification. État : SOUMISE → APPROUVÉE / REJETÉE.

#### 6.5.4 Clôture quotidienne

- Possibilité de clôturer la journée (toutes les activités validées du jour).
- Génération du rapport journalier PDF.
- Transmission immédiate à l'Admin → potentiellement paiement en fin de journée.

### 6.6 Stratégie offline détaillée

- **Cache des assets** : Workbox cache-first sur HTML/CSS/JS/images.
- **Cache des données** : Dexie.js avec schémas dédiés (workers, activities, teams, pointings_pending, pointings_synced, presence_pending, biometric_cache, requests).
- **Pré-chargement matinal** : à la première connexion du matin, la PWA télécharge la liste des MOC de l'équipe, le référentiel d'activités, et (V2) les templates biométriques chiffrés.
- **Sync** : queue idempotente, push batch (≤ 100), reprise sur erreur, backoff exponentiel.
- **Conflits** : résolution serveur autoritaire avec horodatage.
- **Sécurité offline** : verrouillage par PIN après 30 min d'inactivité, données locales chiffrées via WebCrypto.

### 6.7 UX et performance

- Mobile-first, Android 9+ écran 5-6 pouces.
- Gros boutons, navigation à pouce unique, contrastes élevés.
- Photos compressées avant upload (max 1 Mo, qualité 75 %).
- Cibles smartphones bas/moyen de gamme : 2-3 GB RAM, latence < 200 ms.
- **Compatibilité NFC (V2)** : Chrome Android 78+ uniquement, à valider lors du choix des smartphones.

---

## 7. Spécifications techniques

### 7.1 Stack technique

- **Front Admin et PWA** : React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, Zustand, React Hook Form + Zod. PWA : vite-plugin-pwa, Workbox, Dexie.js. V2 : Leaflet (Admin), face-api.js ou équivalent léger (PWA), Web NFC API.
- **Back-end** : Node.js 20 LTS + NestJS, TypeScript, Prisma 5.x, class-validator, Pino, BullMQ.
- **Base** : PostgreSQL 16.
- **Stockage objet** : MinIO.
- **Reverse proxy** : Nginx + Let's Encrypt.
- **Déploiement** : Docker Compose, pipeline GitHub Actions.

### 7.2 Modèle de données (extrait Prisma v3)

Modèles V1 inchangés sauf `Worker`, `Pointage`, `Payment`. Modèles V2 nouveaux : `Zone`, `Parcelle`, `Team`, `Badge`, `PresenceRecord`, `ActivityRequest`, `WorkerRequest`, `ClarificationRequest`, `BiometricTemplate`.

```prisma
// ===== V1 =====

model User {
  id           String   @id @default(uuid())
  email        String?  @unique
  phone        String?  @unique
  passwordHash String
  role         Role     // ADMIN | CHEF_SERVICE | CHEF_EQUIPE
  active       Boolean  @default(true)
  siteId       String?
  teamId       String?
}

model Site {
  id           String  @id @default(uuid())
  name         String
  shortCode    String  @unique  // MNK, ANT, ANJ, MGT, AMB
  location     String?
  geoLat       Float?
  geoLng       Float?
  active       Boolean @default(true)
  zones        Zone[]
}

model Activity {
  id           String   @id @default(uuid())
  label        String
  unit         String   // trou, m², plant, kg
  unitRate     Decimal  @db.Decimal(12, 2)
  validFrom    DateTime
  validTo      DateTime?
  siteId       String?
}

model Worker {
  id           String  @id @default(uuid())
  matricule    String  @unique
  firstName    String
  lastName     String
  birthDate    DateTime?
  mvolaNumber  String
  cinNumber    String?
  photoKey     String?  // S3 key
  siteId       String
  teamId       String?     // V2
  status       WorkerStatus // ACTIVE | INACTIVE | SUSPENDED
  hiredAt      DateTime
  badge        Badge?       // V2 : badge NFC
}

model Pointage {
  id                String    @id @default(uuid())
  clientUuid        String    @unique
  workerId          String
  activityId        String
  quantity          Decimal   @db.Decimal(10, 2)
  unitRateSnapshot  Decimal   @db.Decimal(12, 2)
  amount            Decimal   @db.Decimal(12, 2)
  date              DateTime  @db.Date
  parcelleId        String?    // V2
  geoLat            Float?
  geoLng            Float?
  notes             String?
  status            PointageStatus // PENDING | VALIDATED | REJECTED | NEEDS_CLARIFICATION
  enteredById       String
  validatedById     String?
  validatedAt       DateTime?
  rejectionReason   String?
  bioCheckId        String?    // V2 : lien avec contrôle bio quotidien
  createdByClientAt DateTime
  syncedAt          DateTime   @default(now())
}

model Payment {
  id           String   @id @default(uuid())
  workerId     String
  periodIso    String   // V3 : "2026-W18" ou "2026-D138" (jour ISO)
  cycle        PaymentCycle // WEEKLY | DAILY
  amount       Decimal  @db.Decimal(12, 2)
  description  String
  bioValid     Boolean  // V2 : booléen utilisé dans l'export Excel
  status       PaymentStatus
  exportedAt   DateTime?
  paidAt       DateTime?
  failureReason String?
}

model BiometricCheck {
  id            String   @id @default(uuid())
  workerId      String
  context       BioContext // POINTAGE_TASK | WEEKLY_VALIDATION
  result        BioResult  // OK | DOUBT | KO | UNAVAILABLE
  score         Float?
  provider      String     // axian | manual | local_offline
  performedById String
  performedAt   DateTime
  rawResponse   Json?
}

model AuditLog {
  id          BigInt   @id @default(autoincrement())
  userId      String?
  action      String
  entityType  String
  entityId    String?
  before      Json?
  after       Json?
  ip          String?
  createdAt   DateTime @default(now())
}

// ===== V2 =====

model Zone {
  id           String     @id @default(uuid())
  siteId       String
  site         Site       @relation(fields: [siteId], references: [id])
  name         String
  geoPolygon   Json?      // GeoJSON
  parcelles    Parcelle[]
}

model Parcelle {
  id           String   @id @default(uuid())
  zoneId       String
  zone         Zone     @relation(fields: [zoneId], references: [id])
  name         String
  geoPolygon   Json?
  surfaceHa    Decimal? @db.Decimal(10, 2)
}

model Team {
  id           String   @id @default(uuid())
  siteId       String
  name         String
  chefId       String?
  active       Boolean  @default(true)
}

model Badge {
  id           String   @id @default(uuid())
  workerId     String   @unique
  nfcTagId     String   @unique  // identifiant NFC du badge physique
  assignedAt   DateTime
  revokedAt    DateTime?
}

model PresenceRecord {
  id              String   @id @default(uuid())
  clientUuid      String   @unique
  workerId        String
  date            DateTime @db.Date
  arrivalTime     DateTime
  badgeNfcTagId   String
  scannedById     String   // Chef d'Équipe
  source          String   // NFC | MANUAL
  parcelleId      String?
  createdByClientAt DateTime
}

model BiometricTemplate {
  id           String   @id @default(uuid())
  workerId     String   @unique
  templateData Bytes    // template chiffré (ne JAMAIS exposer en clair)
  source       String   // axian | manual_capture
  capturedAt   DateTime
  expiresAt    DateTime // expiration cache local
}

model ActivityRequest {
  id              String   @id @default(uuid())
  proposedLabel   String
  proposedUnit    String
  proposedRate    Decimal  @db.Decimal(12, 2)
  justification   String
  requestedById   String   // Chef de Service
  siteId          String?
  status          RequestStatus // PENDING | APPROVED | REJECTED
  decisionById    String?
  decisionAt      DateTime?
  decisionReason  String?
  createdActivityId String?
}

model WorkerRequest {
  id              String   @id @default(uuid())
  firstName       String
  lastName        String
  cinNumber       String?
  mvolaNumber     String
  proposedPhotoKey String? // photo capturée à l'enregistrement
  targetTeamId    String?
  justification   String
  requestedById   String
  status          RequestStatus
  decisionById    String?
  decisionAt      DateTime?
  decisionReason  String?
  createdWorkerId String?
}

model ClarificationRequest {
  id              String   @id @default(uuid())
  pointageId      String
  question        String
  requestedPhoto  Boolean  @default(false)
  status          ClarificationStatus // OPEN | ANSWERED | CLOSED
  answerText      String?
  answerPhotoKey  String?
  requestedById   String   // Chef de Service
  answeredById    String?  // Chef d'Équipe
  answeredAt      DateTime?
  resolvedAt      DateTime?
}
```

### 7.3 API REST — endpoints clés

**V1**

- `POST /auth/login`, `/auth/refresh`, `/auth/logout`.
- CRUD : `/workers`, `/sites`, `/activities`, `/users`.
- `POST /pointages/sync` — push batch idempotent depuis PWA.
- `PATCH /pointages/:id/validate|reject` — validation Chef de Service.
- `POST /biometric/check` — contrôle biométrique online.
- `POST /reports/weekly` — génération rapport et facture hebdomadaires.
- `POST /payments/generate` — bordereau.
- `GET /payments/:periodIso/export` — fichier Excel MVola.
- `POST /payments/import-status` — retour MVola.
- `GET /audit-log`.

**V2 — nouveaux endpoints**

- CRUD : `/teams`, `/zones`, `/parcelles`, `/badges`.
- `POST /presence/sync` — push batch des pointages présence NFC.
- `POST /biometric/templates/sync` — pré-fetch templates pour cache offline.
- `POST /biometric/check-offline` — remontée du résultat local pour audit.
- CRUD : `/activity-requests`, `/worker-requests`, `/clarification-requests`.
- `PATCH /*-requests/:id/approve|reject` — traitement par Admin ou Chef d'Équipe.
- `POST /reports/daily` — génération rapport journalier (clôture quotidienne).
- `GET /sites/geo` — données géographiques pour cartographie.

### 7.4 Sécurité

- Hash mot de passe Argon2id.
- JWT access 15 min, refresh 7 jours.
- Rate limiting 10 tentatives login / IP / 5 min.
- RBAC API + filtrage Prisma par site/équipe.
- TLS 1.3, photos en URL pré-signée à durée limitée.
- Audit log append-only via triggers PostgreSQL.
- **V2 — données biométriques locales** : templates chiffrés AES-256 via WebCrypto avec clé dérivée du PIN utilisateur + secret serveur. Effacement automatique à expiration (durée paramétrable, 7 jours par défaut). Effacement immédiat à révocation du compte ou changement de PIN. Aucun template en clair côté client.
- **V2 — RGPD / Loi 2014-038** : analyse spécifique sur le stockage biométrique local à conduire avant déploiement V2. Registre des traitements mis à jour. Information explicite du MOC à l'enregistrement de son template.

### 7.5 Synchronisation offline — contrat technique

- `clientUuid` UUID v7 généré côté client avant tout envoi.
- Contrainte d'unicité serveur : retransmission idempotente.
- API `/pointages/sync` et `/presence/sync` acceptent un batch (≤ 100), retournent par ligne : `created` / `already_exists` / `rejected`.
- Photos uploadées séparément via URL pré-signée S3.
- Conflits résolus côté serveur avec horodatage.
- V2 : sync différentielle des templates biométriques (only-modified depuis dernière sync).

### 7.6 Hébergement et exploitation

- VPS Linux 4 vCPU / 8 GB RAM / 80 GB SSD au démarrage.
- Docker Compose : `api`, `postgres`, `minio`, `nginx`, `backup-cron`.
- Backup `pg_dump` quotidien vers Backblaze B2 (rétention 30 jours).
- Monitoring : logs Pino, Healthchecks.io, UptimeRobot.

### 7.7 Performance

- 600 MOC actifs, 21 utilisateurs, 1 000 pointages/jour : tractable sur la cible matérielle.
- Indexation : `(workerId, date)` sur Pointage, `(workerId, periodIso)` sur Payment, full-text sur recherche Worker.
- V2 : index sur `(parcelleId, date)` pour les filtres terrain.

---

## 8. Modules spécifiques

### 8.1 Module biométrique

**V1 — adapter pattern simple**

Interface unique avec trois implémentations interchangeables :

```typescript
interface BiometricProvider {
  check(
    workerId: string,
    photo: Buffer,
    mvolaNumber: string,
  ): Promise<{ result: "OK" | "DOUBT" | "KO" | "UNAVAILABLE"; score?: number; checkId: string }>;
}
```

- `MockBiometricProvider` : OK aléatoire, dev et démo.
- `ManualBiometricProvider` : marque DOUBT systématique, demande revue manuelle dans l'Admin.
- `AxianBiometricProvider` : API AXIAN réelle.

**V2 — extension offline**

- Pré-fetch matinal des templates biométriques chiffrés via `/biometric/templates/sync`.
- Comparaison locale via face-api.js ou équivalent embarqué.
- Sync différée des résultats vers `/biometric/check-offline`.
- Mode hybride : si connexion disponible, double-check via AXIAN en parallèle.

### 8.2 Module paiement — Excel MVola Bulk Transfer

Format de fichier généré, 5 colonnes (V3) :

| Numéro téléphone | Description         | Période | Montant (Ar) | Bio Validée |
| ---------------- | ------------------- | ------- | ------------ | ----------- |
| 034XXXXXXX       | Rakoto Paiement MNK | S18     | 125 000      | OUI         |
| 034YYYYYYY       | Rasoa Paiement MNK  | S18     | 98 500       | OUI         |
| 034ZZZZZZZ       | Hery Paiement ANJ   | D138    | 12 500       | NON         |

- Description : « Prénom + Paiement + Code site ».
- Période : `S18` (semaine ISO) ou `D138` (jour ISO de l'année) selon cycle.
- Booléen biométrique : OUI / NON / N/A.
- Fichier `.xlsx`, archivé sur serveur.

### 8.3 Module rapport et facture

- **Rapport hebdomadaire (V1)** : PDF détail par jour, par activité, par MOC ; photo, statut biométrique, total semaine.
- **Rapport journalier (V2)** : version raccourcie, généré à la clôture du jour.
- **Facture** : récapitulatif par site et par activité ; signature électronique du Chef de Service.

### 8.4 Module NFC (V2)

- Activation du mode lecteur NFC dans la PWA via Web NFC API.
- Lecture des badges (NDEF ou ID hardware).
- Mapping badge ↔ MOC géré côté serveur, synchronisé en cache local.
- Stockage offline des scans en `PresenceRecord` pending.
- Compatibilité : Chrome Android 78+ uniquement. Fallback : saisie manuelle de l'ID badge en cas d'indisponibilité NFC.

### 8.5 Module workflows de demandes (V2)

- Trois types de demandes : précisions, activité, MOC.
- Chaque demande a son cycle de vie distinct.
- Notifications email aux destinataires (Admin pour activités et MOC, Chef d'Équipe pour précisions).
- Compteur de demandes en attente affiché dans le menu de chaque rôle.
- Audit log dédié.

### 8.6 Module cartographie (V2)

- Carte Leaflet centrée Madagascar, tuiles OSM ou MapTiler.
- Marqueurs par Site avec compteurs (effectif, activité du jour).
- Couches Zones et Parcelles affichables.
- Click sur marqueur ou polygone → vue détaillée latérale.

---

## 9. Hiérarchie géographique (V2)

L'architecture des données respecte une hiérarchie stricte à trois niveaux : **Site → Zone → Parcelle**. Toutes les entités opérationnelles (équipes, pointages, présences, demandes) sont rattachables à une Parcelle. Les agrégats remontent ensuite naturellement à la Zone puis au Site.

| Niveau   | Définition                                                                     | Exemples                                |
| -------- | ------------------------------------------------------------------------------ | --------------------------------------- |
| Site     | Établissement géographique d'ALTERRA, déjà défini en V1.                       | Manankazo, Antsampanana.                |
| Zone     | Sous-ensemble logique d'un Site, généralement une portion contiguë de terrain. | « Versant Nord », « Bambouseraie Est ». |
| Parcelle | Plus petite unité opérationnelle, sur laquelle une équipe travaille.           | « P-12 », « P-13 ».                     |

Implications :

- Les Chefs d'Équipe sont affectés à une Parcelle (ou plusieurs).
- Les pointages sont enregistrés au niveau Parcelle.
- Les filtres et rapports peuvent agréger à n'importe quel niveau.
- Les surfaces (en hectares) sont stockées au niveau Parcelle pour permettre des calculs de productivité.

---

## 10. Risques techniques et mitigations

| Risque                                                        | Niveau    | Mitigation                                                                                                                |
| ------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------- |
| API biométrique AXIAN en dev sans doc                         | Élevé     | Adapter pattern, mode mock + manuel. Engagement AXIAN à formaliser.                                                       |
| Web NFC API compatibilité limitée (Chrome Android uniquement) | **Élevé** | Imposer la flotte Android Chrome. Fallback saisie manuelle ID badge. Tester sur appareils cibles avant achat.             |
| Cache biométrique local — RGPD et fuite données               | **Élevé** | Chiffrement WebCrypto, durée limitée, effacement à révocation. Analyse juridique préalable. Information explicite du MOC. |
| Saisie en lot pour 40 MOC : UX critique                       | Moyen     | Maquette dédiée en phase 1, prototype testé sur le terrain avant fin V1.                                                  |
| Volumétrie réelle                                             | Faible    | Hypothèses confirmées. Indexation. Tests de charge en phase 8.                                                            |
| Adoption Chef d'Équipe                                        | Moyen     | UX simple, formation, présence terrain semaine 1.                                                                         |
| Format MVola non spécifié                                     | Moyen     | Demander échantillon en phase 1. Couche d'export configurable.                                                            |
| Workflows de demandes — UX confuse si mal designée            | Moyen     | Maquette dédiée, présentation avant développement, itération possible.                                                    |
| Performance face-api.js sur Android bas de gamme              | Moyen     | Tester sur appareils cibles. Limiter taille des templates. Modèle TinyFace si nécessaire.                                 |
| Dérive de scope V2                                            | Moyen     | Spec V2 figée à signature, change requests chiffrées séparément.                                                          |

---

## 11. Hypothèses, exclusions et conditions

### 11.1 Périmètre couvert par V1

- 5 sites ALTERRA, hiérarchie Site uniquement.
- Référentiel d'activités, sites, travailleurs.
- Pointage à la tâche par PWA Chef d'Équipe (sans NFC, sans biométrie offline).
- Validation hebdomadaire par Chef de Service avec biométrie online (mock + manuel + AXIAN si disponible).
- Génération rapport et facture hebdomadaires PDF.
- Web App Admin : référentiels, pointages, paiements, audit log, reporting.
- Génération fichier Excel MVola Bulk Transfer.

### 11.2 Périmètre couvert par V2

- NFC pour pointage de présence.
- Biométrie offline avec cache local chiffré et pré-fetch.
- Composition d'équipes côté PWA Chef de Service.
- Gestion d'équipe locale Chef d'Équipe.
- Workflows de demandes (précisions, activités, MOC).
- Hiérarchie Zone et Parcelle.
- Cartographie Admin.
- Clôture quotidienne + rapport journalier.

### 11.3 Non inclus (à chiffrer en sus si requis)

- Coût des infrastructures (VPS, domaine, services tiers).
- Intégration finale et stabilisation API biométrique AXIAN si publiée après V2 (3-5 j supplémentaires).
- Maintenance évolutive après l'hypercare V1 ou V2 (forfait mensuel séparé).
- Migration de données mal structurées.
- Matériel terrain (smartphones avec NFC obligatoire en V2, badges NFC pour MOC) et forfaits data.
- Analyse RGPD/Loi 2014-038 approfondie sur le stockage biométrique local (option recommandée).

### 11.4 Conditions de réussite

- Référent métier ALTERRA disponible 0,5 j/semaine pendant V1 et V2.
- Données initiales fournies au format Excel propre.
- Engagement AXIAN obtenu avant phase biométrique de V1, ou décision claire d'utiliser le mode manuel.
- VPS provisionné en début phase 7 de V1.
- Recette ALTERRA réalisée dans les 5 jours ouvrés suivant la livraison.
- Flotte de smartphones Android avec NFC validée avant démarrage V2.
- Badges NFC fournis à ALTERRA avant déploiement V2.
- Échantillon du format Excel MVola Bulk Transfer obtenu en phase 1 de V1.

### 11.5 Glossaire

- **MOC** : Main-d'Œuvre Communautaire — travailleur saisonnier ALTERRA.
- **PWA** : Progressive Web App.
- **KYC** : Know Your Customer — données d'identité enregistrées par MVola / Telma.
- **Bulk Transfer** : format MVola pour les transferts en lot via fichier Excel.
- **NFC** : Near Field Communication — technologie de lecture sans contact.
- **Trouaison** : creusage de trous pour planter des arbres.
- **Défrichage** : préparation du terrain.
- **PMT** : abréviation de « Paiement » dans la description des transferts MVola.
- **Parcelle** : plus petite unité opérationnelle géographique d'un site.
- **Zone** : sous-ensemble logique d'un site, regroupant des parcelles.
- **Template biométrique** : représentation mathématique d'une photo permettant la comparaison sans exposer l'image originale.

---

_Fin du document — v3.0 du 28 avril 2026_
