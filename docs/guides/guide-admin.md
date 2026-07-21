# Guide utilisateur — Administrateur ALTERRA

**Version :** V1 · **Application :** Admin web (`admin.alterra.mg`)  
**Rôle :** Administrateur système et métier

---

## 1. Introduction

Ce guide décrit l'utilisation de l'interface d'administration ALTERRA pour piloter les sites, les référentiels, les pointages, les paiements MVola et la traçabilité.

**Prérequis :**

- Compte `ADMIN` actif
- Navigateur récent (Chrome, Firefox, Edge)
- MFA activée recommandée en production

**Légende captures :** les encarts `[Capture]` indiquent les écrans à illustrer lors de la formation ou de la prochaine mise à jour PDF.

---

## 2. Connexion et sécurité

### 2.1 Première connexion

1. Ouvrir `https://admin.alterra.mg/login`
2. Saisir email et mot de passe fournis par l'équipe projet
3. Cliquer **Se connecter**
4. Si MFA activée : saisir le code à 6 chiffres (application authenticator)

`[Capture : écran de connexion avec champ MFA]`

### 2.2 Navigation générale

Après connexion, la barre latérale gauche donne accès aux modules :

| Menu | Chemin | Usage |
|------|--------|-------|
| Tableau de bord | `/` | KPIs campagne |
| Sites | `/sites` | Référentiel sites |
| Activités | `/activities` | Tâches et tarifs |
| MOC | `/workers` | Main-d'œuvre |
| Utilisateurs | `/users` | Comptes CDE/CDS/Admin |
| Pointages | `/pointages` | Suivi et correction |
| Paiements | `/payments` | Bordereau MVola |
| Rapports | `/reports` | Exports mensuels |
| Audit | `/audit` | Journal des actions |

`[Capture : sidebar avec les 9 entrées]`

---

## 3. Tableau de bord

**Objectif :** vue synthétique de la campagne en cours.

- **Effectifs actifs** : MOC en statut actif
- **Taux de présence** : semaine ISO courante
- **Pointages en attente** : à valider côté terrain ou admin
- **Paiements en attente** : montant total des lignes non soldées

Les graphiques montrent la présence sur 7 jours et l'évolution des effectifs. Le bouton **Rafraîchir** met à jour les données (rafraîchissement automatique toutes les 60 secondes).

`[Capture : dashboard KPIs + graphiques]`

---

## 4. Gestion des sites

### 4.1 Créer un site

1. Menu **Sites** → **Nouveau site**
2. Renseigner : nom, code court (2–3 lettres, ex. `MNK`), localisation
3. Enregistrer

Le code court sert aux matricules MOC et aux comptes terrain (`cde.mnk1@…`).

### 4.2 Modifier ou désactiver

- **Modifier** : mettre à jour nom ou localisation (le code reste stable)
- **Désactiver** : soft delete — le site n'apparaît plus dans les sélecteurs

`[Capture : formulaire site + liste paginée]`

---

## 5. Activités et tarifs

### 5.1 Créer une activité

1. Menu **Activités** → **Nouvelle activité**
2. Libellé (ex. Trouaison), unité (trou, plant, m²…), tarif unitaire en Ariary
3. Site associé (optionnel — activité globale si vide)

### 5.2 Historique tarifaire (RG-04)

Toute modification de tarif crée une **nouvelle version** datée. Consulter **Historique** depuis la fiche activité pour voir les tarifs passés utilisés en recalcul.

### 5.3 Désactivation

Une activité désactivée n'est plus proposée aux CDE sur le terrain.

`[Capture : liste activités + drawer historique tarifs]`

---

## 6. MOC (main-d'œuvre)

### 6.1 Fiche MOC

Champs obligatoires :

- Matricule (unique)
- Prénom, nom
- Numéro MVola `034XXXXXXXX`
- Site d'affectation
- Date d'embauche, statut (Actif / Inactif / Suspendu)

### 6.2 Import Excel

1. **Import Excel** → télécharger le modèle si besoin (`docs/import/templates/workers.xlsx`)
2. Remplir le fichier → importer en mode validation puis commit

### 6.3 Photo biométrique

Uploader une photo de référence via **Photo** sur la ligne MOC. Elle sert au contrôle bio CDS (mock, manuel ou AXIAN selon configuration serveur).

`[Capture : table MOC avec filtres et bouton Import]`

---

## 7. Utilisateurs

### 7.1 Création

1. **Nouvel utilisateur** : email, nom, rôle, site (CDS/CDE)
2. Mot de passe : laisser vide pour génération automatique (à communiquer une seule fois)

### 7.2 Rôles

| Rôle | Accès admin | Accès PWA |
|------|-------------|-----------|
| Administrateur | Complet | Validation + sync |
| Chef de service | Dashboard, Pointages | Validation CDS |
| Chef d'équipe | — | Saisie lot CDE |

### 7.3 Reset mot de passe

**Reset MDP** affiche un mot de passe temporaire — le transmettre de façon sécurisée au terrain.

`[Capture : liste utilisateurs par rôle]`

---

## 8. Pointages

### 8.1 Consultation

Filtrer par statut : En attente, Validé, Rejeté, Précision requise. Plage de dates recommandée pour les gros volumes.

### 8.2 Détail et actions

Clic sur une ligne → drawer **Détail pointage** :

- Photo, géolocalisation, montant calculé
- Statut biométrique semaine
- **Valider** / **Rejeter** (motif ≥ 3 caractères) si en attente
- **Corriger** (admin) : ajuster quantité ou activité

`[Capture : table pointages + drawer détail]`

---

## 9. Paiements MVola

### 9.1 Cycle hebdomadaire

1. Choisir **Période (ISO semaine)** — ex. `2026-W29`
2. **Générer bordereau** : crée les lignes à partir des pointages validés et bio OK
3. Vérifier les compteurs : exportables vs bloquées bio
4. **Export MVola** : fichier pour le portail marchand
5. Après paiement réel : **Import retour MVola** pour mettre à jour les statuts

### 9.2 Blocages fréquents

| Symptôme | Cause probable | Action |
|----------|----------------|--------|
| Ligne bloquée bio | Contrôle CDS non OK | Relancer validation CDS |
| Montant 0 | Quantité nulle ou tarif manquant | Corriger pointage |
| Conflit période | Bordereau déjà généré | Vérifier statut EXPORTED |

`[Capture : page Paiements avec période et boutons bordereau]`

---

## 10. Rapports

Types disponibles :

- Pointages mensuels
- Paiements mensuels
- Présence par site

Choisir mois (+ site optionnel) → aperçu → export **CSV**, **XLSX** ou **PDF** (impression navigateur).

Rapport PDF hebdomadaire signé CDS : généré côté serveur (job async) — lien de téléchargement après traitement.

`[Capture : sélection rapport + export]`

---

## 11. Journal d'audit

Consultation seule. Filtres : action (LOGIN, VALIDATE, EXPORT…), entité, dates.

Chaque entrée détaille : utilisateur, IP, diff avant/après pour les modifications sensibles.

`[Capture : journal audit paginé]`

---

## 12. Dépannage admin

| Problème | Vérification |
|----------|--------------|
| Connexion refusée | MFA, mot de passe expiré, compte désactivé |
| Liste vide | Filtres actifs, site incorrect |
| Export MVola incomplet | MOC sans numéro MVola valide |
| KPI incohérent | Attendre refresh 60 s ou forcer Rafraîchir |

**Support :** consulter `docs/runbook.md` pour incidents infrastructure.

---

## 13. Bonnes pratiques

- Ne jamais partager le compte admin
- Activer MFA avant MEP production
- Tester import Excel sur jeu réduit avant campagne complète
- Archiver les exports MVola et retours portail par semaine ISO
- Documenter toute correction manuelle de pointage (audit automatique)

---

*Document généré pour ALTERRA V1 — Task 24 DOC*
