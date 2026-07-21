# Guide utilisateur — Chef d'équipe (CDE) ALTERRA

**Version :** V1 · **Application :** PWA terrain (`app.alterra.mg`)  
**Rôle :** Chef d'équipe (`CHEF_EQUIPE`)

---

## 1. Introduction

Le CDE saisit chaque jour les quantités réalisées par les MOC de son équipe, éventuellement avec photo, puis synchronise vers le serveur — y compris en mode hors ligne.

**Matériel :** smartphone Android, PWA installée, carnet papier de secours recommandé.

---

## 2. Premiers pas

### 2.1 Installation PWA

Identique au CDS : Chrome → `app.alterra.mg` → **Ajouter à l'écran d'accueil**.

`[Capture : icône ALTERRA sur écran d'accueil]`

### 2.2 Connexion et PIN

1. Email CDE (ex. `cde.mnk1@alterra.test`)
2. Mot de passe
3. Créer PIN 4 chiffres (première connexion)
4. Déverrouiller après inactivité (30 min)

---

## 3. Navigation CDE

| Onglet | Chemin | Usage |
|--------|--------|-------|
| Activité | `/` | Choisir jour + tâche |
| Saisie lot | `/batch` | Quantités par MOC |
| Sync | `/sync` | État file d'attente |

`[Capture : navigation CDE trois onglets]`

---

## 4. Activité du jour

### 4.1 Synchronisation référentiel

À l'ouverture, la PWA télécharge MOC et activités (message « Synchronisation référentiel… »).

En **hors ligne** : utilise le cache local. Si cache vide → message « Hors ligne — cache vide » — se reconnecter une fois.

### 4.2 Paramètres de session

1. **Date** : jour courant ou jusqu'à 3 jours en arrière (rattrapage)
2. **Quantité par défaut** : valeur préremplie en saisie lot (ex. 1)
3. **Activité** : choisir dans la liste (libellé + tarif Ar/unité)

### 4.3 Continuer

**Continuer vers la saisie lot** → écran `/batch`.

`[Capture : écran Activité du jour avec liste activités]`

---

## 5. Saisie lot

### 5.1 Interface

- En-tête : activité + date — lien **Changer** pour revenir à l'activité
- **Rechercher un MOC** : filtre rapide matricule/nom
- **Appliquer quantité par défaut à tous** : gain de temps sur équipes homogènes

### 5.2 Par MOC

Pour chaque travailleur de l'équipe :

- Saisir **quantité** (nombre décimal autorisé)
- Montant ligne = quantité × tarif activité
- **Photo** optionnelle (compressée automatiquement)

### 5.3 Enregistrer

Pied d'écran fixe :

- « X MOC saisi(s) »
- **Total prévisionnel** en Ariary
- **Enregistrer le lot**

Comportement :

- Enregistrement local immédiat (IndexedDB)
- Sync automatique si **En ligne**
- Redirection vers **Synchronisation**

`[Capture : saisie lot avec plusieurs MOC et total]`

---

## 6. Synchronisation

### 6.1 Indicateurs

- **En ligne** / **Hors ligne**
- Nombre d'éléments en attente
- **Forcer la synchronisation (N)**

### 6.2 Bonnes pratiques

- Sync matin (référentiel à jour)
- Sync midi si couverture réseau faible
- Sync obligatoire en fin de journée (0 en attente)

`[Capture : page Sync en ligne avec 0 en attente]`

---

## 7. Travail hors ligne

### 7.1 Scénario type

1. Matin en Wi-Fi : sync OK
2. Terrain sans réseau : saisie lots normale
3. Bandeau **Hors ligne** visible
4. Retour 4G : **Forcer la synchronisation**

Les lots ne sont **pas perdus** si l'app reste installée (ne pas vider cache navigateur).

### 7.2 Test pilote

Procédure détaillée : `docs/qa/offline-pilot.md`

---

## 8. Pointages rejetés

Si le CDS ou l'admin rejette un pointage :

1. Onglet **Sync** → section **Rejetés**
2. Lire le motif
3. Corriger en resaisissant un lot (nouvelle date ou quantité)
4. **Abandonner** l'ancien rejet si doublon

---

## 9. Journée type CDE

| Heure | Action |
|-------|--------|
| 07:00 | Ouvrir PWA → vérifier En ligne |
| 07:15 | Activité du jour → choix tâche |
| 07:30–11:30 | Saisie lot matin → Enregistrer |
| 14:00 | Nouvelle activité si changement tâche |
| 16:30 | Dernier lot + Sync forcée |
| 16:45 | Confirmer 0 en attente |

---

## 10. Dépannage CDE

| Problème | Solution |
|----------|----------|
| Aucune activité en cache | Se connecter en ligne une fois |
| Enregistrement impossible | Quantité > 0 sur au moins un MOC |
| Sync échoue | Vérifier réseau ; réessayer Forcer |
| Mauvaise activité | **Changer** depuis saisie lot |
| PIN bloqué | Contacter admin reset |

---

## 11. Règles métier

- Une session = une date + une activité
- Les montants affichés sont **prévisionnels** (validation CDS requise)
- Photo : max 5 Mo côté serveur — la PWA compresse avant envoi

---

## 12. Contacts

- Chef de service (validation)
- Référent ALTERRA
- Support : `docs/runbook.md`

---

*Document généré pour ALTERRA V1 — Task 24 DOC*
