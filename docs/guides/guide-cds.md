# Guide utilisateur — Chef de service (CDS) ALTERRA

**Version :** V1 · **Application :** PWA terrain (`app.alterra.mg`)  
**Rôle :** Chef de service (`CHEF_SERVICE`)

---

## 1. Introduction

Le CDS valide chaque semaine les pointages saisis par les chefs d'équipe (CDE), contrôle la biométrie des MOC et verrouille la semaine avant paiement MVola.

**Matériel recommandé :** smartphone Android récent, connexion 4G ou Wi-Fi site, chargeur de secours.

**Légende :** `[Capture]` = écran à illustrer en formation.

---

## 2. Installation et accès

### 2.1 Installer la PWA

1. Ouvrir Chrome → `https://app.alterra.mg`
2. Menu navigateur → **Ajouter à l'écran d'accueil**
3. Lancer l'icône **ALTERRA Terrain**

`[Capture : invite installation PWA Android]`

### 2.2 Connexion

1. Email CDS (ex. `cds.mnk@alterra.test`)
2. Mot de passe initial (à changer si demandé)
3. **Se connecter**

### 2.3 Code PIN local

Au premier accès :

1. Écran **Configurer le PIN** (`/unlock?setup=1`)
2. Choisir 4 chiffres → confirmer → **Enregistrer**

Le PIN protège les données locales après **30 minutes** d'inactivité.

`[Capture : écran création PIN]`

---

## 3. Navigation CDS

Après déverrouillage, redirection automatique vers **Validation hebdomadaire**.

Barre de navigation :

| Onglet | Chemin | Rôle |
|--------|--------|------|
| Validation | `/validation` | Travail principal |
| Sync | `/sync` | État synchronisation |

Bandeau permanent en haut : **En ligne** / **Hors ligne**, file d'attente, **Forcer** sync.

`[Capture : shell PWA CDS avec onglets Validation et Sync]`

---

## 4. Validation hebdomadaire

### 4.1 Vue liste

Les pointages **PENDING** sont groupés par **équipe** (MNK-1, MNK-2…).

Pour chaque MOC :

- Matricule, activité, date, montant
- Badge **bio** : OK · KO · DOUBT · absent

`[Capture : liste validation groupée par équipe]`

### 4.2 Contrôle biométrique

1. Appuyer **Contrôle bio** sur une ligne
2. Autoriser la caméra si demandé
3. Placer le visage du MOC dans le cadre
4. **Capturer et analyser**
5. Résultat : OK / KO / DOUBT + score %
6. **Retour à la validation**

> En mode mock ou manuel (formation), le score peut être simulé. En production AXIAN, suivre les consignes site.

`[Capture : écran capture biométrique]`

### 4.3 Valider un pointage

- **Valider** : disponible si bio OK (ou politique site respectée)
- **Rejeter** : saisir motif ≥ 3 caractères (visible CDE/admin)

### 4.4 Actualiser

**Actualiser** recharge la liste depuis le serveur (nécessite connexion).

---

## 5. Synchronisation

Écran **Synchronisation** (`/sync`) :

| Indicateur | Signification |
|------------|---------------|
| En ligne | Réseau disponible |
| N en attente | Pointages ou médias non encore envoyés |
| Dernière sync | Horodatage dernière réussite |
| Sync auto | Toutes les 60 secondes si en ligne |

**Forcer la synchronisation** : à utiliser après retour réseau ou fin de journée.

### 5.1 Pointages rejetés

Section **Rejetés** : consulter le motif serveur. **Abandonner** si le lot est à resaisir côté CDE.

### 5.2 Journal récent

Historique des dernières opérations sync (succès, erreurs, passage offline).

`[Capture : page Sync avec compteurs et journal]`

---

## 6. Semaine de travail type

| Jour | Action CDS |
|------|------------|
| Lundi–vendredi | Contrôle spot bio + validation progressive |
| Vendredi 16h | **Actualiser** → traiter les PENDING restants |
| Vendredi 17h | Vérifier sync OK (0 en attente) |
| Lundi admin | Bordereau MVola généré après validation complète |

---

## 7. Mode hors ligne

La validation **nécessite le serveur** — pas de validation offline.

En cas de coupure :

1. Noter les MOC à traiter
2. **Forcer** sync des données CDE d'abord (onglet Sync)
3. Reprendre validation dès retour **En ligne**

La PWA conserve la session PIN locale ; seules les actions métier serveur sont bloquées.

---

## 8. Dépannage CDS

| Symptôme | Action |
|----------|--------|
| Bouton Valider grisé | Bio KO ou DOUBT — refaire contrôle bio |
| Liste vide | Semaine déjà validée ou pas de saisie CDE |
| Sync bloquée | Onglet Sync → Forcer ; vérifier 4G |
| PIN oublié | Admin reset + reconfiguration PIN |
| Caméra refusée | Paramètres Android → autorisations Chrome |

---

## 9. Sécurité et confidentialité

- Ne pas communiquer le PIN
- Verrouiller le téléphone entre deux sessions
- Déconnexion en fin de journée sur appareil partagé (**Déconnexion** dans l'en-tête)

---

## 10. Contacts

- **Support terrain :** référent ALTERRA site
- **Incidents techniques :** voir `docs/runbook.md`

---

*Document généré pour ALTERRA V1 — Task 24 DOC*
