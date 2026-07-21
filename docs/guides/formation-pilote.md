# Formation site pilote — ALTERRA V1

**Durée totale :** 1 journée (½j Admin+CDS · ½j CDE terrain)  
**Public :** référent ALTERRA, admin système, 1 CDS, 1–2 CDE  
**Prérequis :** environnement staging ou prod pilote seedé, comptes dédiés formation

---

## Matériel

| Session | Participants | Matériel |
|---------|--------------|----------|
| Matin | Admin, CDS, référent | PC + vidéoprojecteur, 1 smartphone CDS |
| Après-midi | CDE, référent | 1–2 smartphones Android, zone sans réseau simulée |

**Documents distribués :**

- `guide-admin.pdf`
- `guide-cds.pdf`
- `guide-cde.pdf`
- `recette-v1.md` (checklist 2 jours)

---

## Matin (3h30) — Admin + CDS

### 09:00 — Accueil et cadrage (30 min)

- Objectifs V1 : saisie lot → validation → bordereau MVola
- Parcours de données (CDE → CDS → Admin)
- Comptes formation et règles sécurité (PIN, MFA admin)

### 09:30 — Admin référentiels (45 min)

**Démonstration**

1. Connexion admin + MFA
2. Créer site pilote (ou utiliser MNK seed)
3. Vérifier activités et MOC importés
4. Créer compte CDS/CDE test si besoin

**Exercice admin (20 min)**

- Modifier tarif activité → consulter historique
- Import 3 MOC via Excel modèle

`[Capture projetée : page Sites et Import MOC]`

### 10:35 — Pause (15 min)

### 10:50 — Admin opérations (45 min)

**Démonstration**

1. Consulter pointages du jour
2. Générer bordereau semaine courante (jeu test)
3. Export MVola simulé

**Exercice admin (15 min)**

- Filtrer pointages PENDING
- Ouvrir drawer détail + corriger quantité

### 11:35 — CDS validation (55 min)

**Démonstration sur smartphone**

1. Installation PWA + PIN
2. Écran validation — lire badges bio
3. Contrôle bio mock sur 1 MOC
4. Valider / rejeter avec motif

**Exercice CDS (25 min)**

- Valider 5 pointages saisis en amont par formateur
- Forcer sync → vérifier côté admin

### 12:30 — Clôture matin

- Questions / rétroactions
- Homework : CDE prépare téléphone pour aprem

---

## Après-midi (3h30) — CDE terrain

### 14:00 — Mise en situation (30 min)

- Rappel parcours Activité → Saisie lot → Sync
- Sync référentiel en Wi-Fi
- Répartition zones (avec / sans réseau simulé)

### 14:30 — Saisie lot guidée (45 min)

**Démonstration**

1. Choisir activité Trouaison
2. Appliquer quantité par défaut
3. Ajuster 2 MOC + photo sur 1 ligne
4. Enregistrer le lot → Sync

**Exercice CDE (30 min)**

- Chaque CDE saisit un lot complet seul
- Formateur vérifie total prévisionnel

### 15:15 — Pause (15 min)

### 15:30 — Offline simulé (60 min)

Suivre `docs/qa/offline-pilot.md` (version accélérée) :

1. Mode avion ON
2. Saisir 1 lot offline
3. Vérifier bandeau Hors ligne + en attente > 0
4. Mode avion OFF → Forcer sync
5. CDS valide les nouveaux pointages (si présent)

**Critère succès :** 100 % lots sync avant 16h30

### 16:30 — Clôture et évaluation (30 min)

| Critère | OK / KO |
|---------|---------|
| CDE autonome saisie lot | |
| CDS autonome validation + bio | |
| Admin autonome bordereau | |
| Offline → sync sans perte | |

Remplir PV recette (`docs/qa/recette-v1.md` Jour 1).

---

## Support formateur

- Runbook incidents : `docs/runbook.md`
- Procédure offline : `docs/qa/offline-pilot.md`
- Tests auto : `npm run test:e2e`

---

## Annexes — comptes seed (formation)

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Admin | admin@alterra.mg | ChangeMe123! |
| CDS MNK | cds.mnk@alterra.test | test123! |
| CDE MNK-1 | cde.mnk1@alterra.test | test123! |
| PIN PWA | — | 1234 (formation uniquement) |

---

*Task 24 DOC — UC-DOC-TRAIN*
