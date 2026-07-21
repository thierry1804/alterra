# ALTERRA — Spécifications wireframes (cible Figma)

**Statut Figma :** `NOT_CREATED` — aucun fichier Figma produit ; wireframes textuels designer-ready uniquement  
**Date :** 21 juillet 2026  
**UC :** `UC-CAD-03`  
**Lien Figma :** _Non applicable — statut `NOT_CREATED`. Placeholder réservé : `https://figma.com/file/ALTERRA-V1-wireframes` (ne pas utiliser)_

---

## Conventions design

| Élément | Valeur |
|---------|--------|
| Admin viewport | Desktop 1280×800 min, sidebar fixe 240px |
| PWA viewport | Mobile 360×640 (Android), safe-area respectée |
| Grille Admin | 12 colonnes, gutter 24px, padding page 24px |
| Grille PWA | 4 colonnes, gutter 16px, padding 16px |
| Typo Admin | System stack projet (à définir design system) ; body 14px, h1 24px |
| Typo PWA | Body 16px min (lisibilité terrain), labels 14px |
| Touch targets PWA | Min 48×48px |
| Couleurs statut | Validé `#16a34a` · En attente `#ca8a04` · Rejeté `#dc2626` · Bio KO `#dc2626` · Bio DOUBT `#ea580c` |
| Composants | shadcn/ui (Admin) · composants custom touch-friendly (PWA) |

---

## Écran 1 — Dashboard Admin

**Route :** `/dashboard`  
**Rôle :** Admin uniquement  
**Référence spec :** §5.1.2, `UC-FE-ADM-KPI`

### Objectif

Vue synthétique opérations multi-sites : effectifs, présence semaine, masse salariale, alertes sync/bio/litiges.

### Layout (desktop)

```
┌──────────┬────────────────────────────────────────────────────────────┐
│ SIDEBAR  │ HEADER : « Tableau de bord » + [Site ▼ Tous] [Semaine ◀ ▶]  │
│ 240px    ├────────────────────────────────────────────────────────────┤
│          │ ROW KPI (5 cards equal width, height 96px)                  │
│ Logo     │ [Effectif] [Présence %] [Masse sal.] [Litiges] [Sync pend.] │
│ Nav      ├─────────────────────────────┬──────────────────────────────┤
│ · Dash ● │ Parité H/F (donut 280px)    │ Présence par site (bar horiz) │
│ · Sites  ├─────────────────────────────┴──────────────────────────────┤
│ · MOC    │ Histogramme présence 4 semaines (full width, height 300)   │
│ · Point. ├────────────────────────────────────────────────────────────┤
│ · Paie   │ Courbe masse salariale 3 mois (full width, height 280)     │
│ · Audit  ├────────────────────────────────────────────────────────────┤
│          │ Table « Dernière sync par CDS » (full width)                 │
└──────────┴────────────────────────────────────────────────────────────┘
```

### Composants détaillés

#### Sidebar (persistante)

| Zone | Contenu |
|------|---------|
| Haut | Logo ALTERRA 32px + label « Admin » |
| Nav links | Dashboard, Sites, Activités, MOC, Utilisateurs, Pointages, Paiements, Rapports, Audit |
| Bas | Avatar Admin + nom + Déconnexion |

#### Filtres header

| Composant | Type | Données | Comportement |
|-----------|------|---------|--------------|
| Sélecteur site | Combobox | Liste 5 sites + « Tous les sites » | Filtre tous KPIs ; valeur URL `?siteId=` |
| Sélecteur semaine | Stepper date | Semaine ISO courante par défaut | ◀ ▶ change weekStart ; URL `?weekStart=` |
| Rafraîchir | Button ghost | — | Invalide cache TanStack Query |

#### KPI Cards (5)

| Card | Label | Valeur source | Format | Alerte |
|------|-------|---------------|--------|--------|
| 1 | Effectif actif | `workforce.totalActive` | Nombre entier | — |
| 2 | Présence globale | `attendance.globalRate` | XX % | Bordure orange si < 70% |
| 3 | Masse salariale | `payroll.currentWeekAmount` | XXX XXX Ar | — |
| 4 | Litiges paiements | `payroll.disputeCount` | N | Bordure rouge si > 0 |
| 5 | Sync en attente | `sync.pendingPointages` | N items | Bordure orange si > 5 |

**Interaction :** click card → navigation drill-down (MOC, Pointages, Paiements, etc.)

#### Graphiques

| Graphique | Type | Données API | Axes / légende |
|-----------|------|-------------|----------------|
| Parité H/F | Donut Recharts | `workforce.byGender` | Homme bleu, Femme rose, Non spéc. gris ; ratio centré |
| Présence par site | Bar horizontal | `attendance.bySite` | Barre rouge <70%, orange <85%, vert sinon |
| Histogramme 4 sem | Bar groupé | `GET /dashboard/presence-chart?weeks=4` | X = semaines, couleur = site |
| Masse salariale | Area chart | `GET /dashboard/payroll-chart?months=3` | Paid vert, Pending orange |

#### Table sync CDS

| Colonne | Contenu | Tri |
|---------|---------|-----|
| Chef de Service | Nom complet | Oui |
| Site | Nom site | Oui |
| Dernière sync | Relatif (« il y a 2h ») + datetime tooltip | Oui desc |
| Statut | Badge OK / Alerte (>24h rouge) | — |

#### États

| État | Comportement |
|------|--------------|
| Loading | Skeleton sur chaque section |
| Erreur API | Toast + bouton retry par section |
| Empty | Message « Aucune donnée pour cette période » |

#### Refresh

- TanStack Query `staleTime: 5 min` + polling optionnel 60s sur KPIs

---

## Écran 2 — Saisie en lot PWA (CDE)

**Route :** `/pointage/saisie`  
**Rôle :** Chef d'Équipe  
**Référence spec :** §5.2.4, `UC-FE-PWA-BATCH`

### Objectif

Saisir rapidement les quantités réalisées par ~40 MOC pour l'activité du jour, offline-first.

### Layout (mobile portrait)

```
┌─────────────────────────────────────┐
│ STATUS BAR : [Offline/Online] [Sync 3]│
├─────────────────────────────────────┤
│ ACTIVITÉ : Trouaison · 150 Ar/trou    │
│ [Changer activité]                    │
├─────────────────────────────────────┤
│ [🔍 Rechercher un MOC____________]    │
│ [Appliquer défaut: 50 ▼] [Tous=50]   │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ [photo 48] Rakoto R.  MAT-001   │ │
│ │            [____50____] trou  📷│ │
│ ├─────────────────────────────────┤ │
│ │ [photo 48] Rasoa M.   MAT-002   │ │
│ │            [____45____] trou  📷│ │
│ │ ... scroll ~40 lignes ...       │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ TOTAL PRÉVISIONNEL : 1 875 000 Ar   │
│ [        ENREGISTRER (48px)       ] │
└─────────────────────────────────────┘
```

### Composants détaillés

#### Bandeau statut (fixe top)

| Élément | Contenu |
|---------|---------|
| Connexion | Badge « En ligne » vert / « Hors ligne » gris |
| Sync | Chip « 3 en attente » → tap ouvre écran sync |
| Date | Date du jour (non éditable) |

#### En-tête activité

| Champ | Source | Action |
|-------|--------|--------|
| Libellé + tarif | Activité sélectionnée (UC-FE-PWA-DAY) | Tap « Changer » → retour sélection |
| Unité | Ex. « trou », « m² » | Affiché après quantité |

#### Barre outils saisie

| Composant | Comportement |
|-----------|--------------|
| Recherche | Filtre instantané nom/matricule ; debounce 150ms |
| Quantité défaut | Number input ; bouton « Tous = X » remplit lignes vides |
| Compteur | « 38/40 saisis » discret |

#### Ligne MOC (répétée)

| Zone | Spec |
|------|------|
| Photo | 48×48px, rond, placeholder initiales si absent |
| Identité | Prénom Nom (truncate) + matricule 12px muted |
| Quantité | Input number, clavier numérique, min 0, step 1, largeur 80px |
| Unité | Label unité activité |
| Photo pointage | Icône caméra 44px ; badge si photo attachée |
| Absent | Quantité vide = pas de pointage créé |

#### Footer fixe

| Élément | Spec |
|---------|------|
| Total prévisionnel | Somme(qty × tarif jour) ; format Ar sans décimales |
| Bouton Enregistrer | Primary full-width 48px ; disabled si 0 saisi |
| Feedback | Toast « 38 pointages enregistrés localement » |

#### Interactions

| Action | Résultat |
|--------|----------|
| Enregistrer | Crée N Pointage en IndexedDB, status PENDING_SYNC, clientUuid v4 each |
| Tap photo | Ouvre caméra (UC-FE-PWA-PHOTO) ; compression 1 Mo |
| Scroll | Virtual list si >30 MOC (perf) |
| Retour arrière | Dialog « Quitter sans enregistrer ? » si champs modifiés |

#### États offline

- Tout fonctionne sans réseau si activité + MOC en cache
- Bandeau « Synchronisation au retour de connexion »

#### Critères UX

- 40 MOC saisis en < 5 minutes
- Pas de perte saisie au scroll ou rotation écran
- Gros touch targets (min 48px)

---

## Écran 3 — Validation CDS (PWA)

**Route :** `/validation`  
**Rôle :** Chef de Service  
**Référence spec :** §5.2.5, `UC-FE-PWA-VAL`, `UC-FE-PWA-BIO`

### Objectif

Consulter les pointages de la semaine par équipe, effectuer contrôle biométrique, valider ou rejeter par MOC.

### Layout (mobile/tablette)

```
┌─────────────────────────────────────┐
│ Validation · Semaine 29 (S29)  [▼]  │
│ Équipe [Toutes ▼]  [Filtrer statut] │
├─────────────────────────────────────┤
│ ÉQUIPE Alpha — Chef: Jean R.        │
│ ┌─────────────────────────────────┐ │
│ │● Rakoto R.  3 pnt · 125 000 Ar  │ │
│ │  Bio [🟢 OK]  [Bio] [Valider] [✕]│ │
│ ├─────────────────────────────────┤ │
│ │● Rasoa M.   2 pnt ·  98 500 Ar  │ │
│ │  Bio [🟠 DOUBT] [Bio] [Valider*] │ │
│ │ ...                             │ │
│ └─────────────────────────────────┘ │
│ ÉQUIPE Beta — ...                   │
├─────────────────────────────────────┤
│ Résumé : 85/120 validés · 2 450 000│
│ [    Clôturer la semaine (V1)     ] │
└─────────────────────────────────────┘
```

### Composants détaillés

#### Filtres

| Filtre | Options | Défaut |
|--------|---------|--------|
| Semaine | Sélecteur semaine ISO | Semaine courante |
| Équipe | Toutes + liste équipes site | Toutes |
| Statut | Tous / En attente / Validé / Rejeté / Bio manquante | En attente |

#### Groupe équipe (accordéon)

| Header | Nom équipe + chef d'équipe + compteur MOC |
| Body | Liste cartes MOC |

#### Carte MOC

| Zone | Contenu |
|------|---------|
| Avatar + nom | Photo 40px + nom complet |
| Résumé | « N pointages · XXX Ar prévisionnel » |
| Pastille bio | 🟢 OK · 🟠 DOUBT · 🔴 KO · ⚪ Non fait |
| Actions | Boutons 44px : Bio · Valider · Rejeter |

| Bouton | État enabled | Action |
|--------|--------------|--------|
| Bio | Toujours | Ouvre écran caméra biométrique |
| Valider | Bio OK ou DOUBT+confirm | PATCH validate all MOC week |
| Rejeter | Toujours | Modal motif obligatoire → reject |

#### Modal rejet

| Champ | Validation |
|-------|------------|
| Motif | Textarea min 10 car., required |
| Actions | Annuler · Confirmer rejet |

#### Écran biométrique (overlay full-screen)

```
┌─────────────────────────────────────┐
│ ✕                          MOC: Rakoto│
│                                       │
│         ┌─────────────────┐           │
│         │  OVAL GUIDE     │           │
│         │  (caméra live)  │           │
│         └─────────────────┘           │
│                                       │
│         [   CAPTURE (64px)   ]        │
│                                       │
│ Résultat: OK — score 0.92             │
│ [Valider quand même] [Nouvelle photo] │
└─────────────────────────────────────┘
```

| Élément | Spec |
|---------|------|
| Guide facial | Oval overlay SVG, instructions « Centrer le visage » |
| Capture | POST /biometric/check ; loader 2–5s |
| Résultat | Pastille + score ; auto-retour liste après 2s si OK |
| Mode dégradé | Lien « Validation manuelle » si BIO-503 |

#### Footer résumé

| Métrique | Calcul |
|----------|--------|
| Validés / Total | MOC avec tous pointages VALIDATED |
| Montant | Somme montants validés semaine |

#### Clôture semaine

- Bouton visible si ≥90% validés ou confirmation explicite
- Déclenche UC-22 (PDF + signature)

---

## Écran 4 — Bordereau paiement (Admin)

**Route :** `/paiements/bordereau`  
**Rôle :** Admin uniquement  
**Référence spec :** §5.1.6, `UC-FE-ADM-PAY-BORD/EXP/IMP`

### Objectif

Générer, consulter, ajuster et exporter le bordereau de paiement hebdomadaire consolidé (5 sites).

### Layout (desktop)

```
┌──────────┬────────────────────────────────────────────────────────────┐
│ SIDEBAR  │ Paiements › Bordereau                                       │
│          ├────────────────────────────────────────────────────────────┤
│          │ Période [Semaine 29 ▼]  Site [Tous ▼]  [Générer bordereau] │
│          │ Statut: 520 PENDING · 80 EXPORTED · 12 PAID               │
│          ├────────────────────────────────────────────────────────────┤
│          │ [Exporter MVola] [Importer retour] [Historique exports]     │
│          ├────────────────────────────────────────────────────────────┤
│          │ TABLE (virtualized, ~600 rows)                            │
│          │ ☐ Prénom Nom | Site | MVola | Montant | Bio | Statut | ✎  │
│          │ ☐ Rakoto R.  | MNK  | 034… | 125 000 | OUI | PENDING | ✎  │
│          │ ...                                                         │
│          ├────────────────────────────────────────────────────────────┤
│          │ TOTAL : 45 230 000 Ar · 612 lignes · 3 bio NON             │
└──────────┴────────────────────────────────────────────────────────────┘
```

### Composants détaillés

#### Barre actions période

| Composant | Comportement |
|-----------|--------------|
| Sélecteur période | Semaine ISO ; disabled si bordereau EXPORTED sans mode correctif |
| Filtre site | Optionnel pour preview ; export toujours tous sites |
| Générer | POST /payments/generate ; confirm si bordereau existant (PAY-CONFLICT) |

#### Barre export/import

| Bouton | Action | Feedback |
|--------|--------|----------|
| Exporter MVola | GET /payments/:period/export | Progress bar ; download `.xlsx` ; toast succès |
| Importer retour | Ouvre modal drag&drop | Preview PAID/FAILED avant confirm |
| Historique | Drawer liste exports archivés MinIO | Re-download |

#### Table bordereau

| Colonne | Type | Éditable | Notes |
|---------|------|----------|-------|
| ☐ | Checkbox | — | Sélection batch (future) |
| Prénom Nom | Text | Non | Lien → fiche MOC |
| Site | Badge | Non | Code 3 lettres |
| N° MVola | Text mono | Non | Format 034XXXXXXX |
| Montant (Ar) | Number | Oui inline | Édition → modal motif obligatoire |
| Bio validée | Badge | Non | OUI / NON / N/A |
| Statut | Badge | Non | PENDING/EXPORTED/PAID/FAILED |
| Actions | Icon ✎ | — | Ouvre drawer détail |

#### Badge statut paiement

| Statut | Couleur | Signification |
|--------|---------|---------------|
| PENDING | Jaune | Généré, non exporté |
| EXPORTED | Bleu | Fichier MVola produit |
| PAID | Vert | Retour MVola OK |
| FAILED | Rouge | Échec MVola ; tooltip motif |

#### Drawer détail ligne

| Section | Contenu |
|---------|---------|
| MOC | Fiche résumée + photo |
| Détail calcul | Liste pointages VALIDATED agrégés (activité, qty, tarif, sous-total) |
| Bio | Dernier BiometricCheck : date, résultat, provider |
| Historique | Modifications montant (audit) |
| Actions | Corriger montant · Exclure ligne (motif) |

#### Modal correction montant

| Champ | Validation |
|-------|------------|
| Montant actuel | Read-only |
| Nouveau montant | Number > 0, integer |
| Motif | Required min 10 car. |

#### Modal import retour MVola

```
┌─────────────────────────────────────────┐
│ Importer fichier retour MVola           │
│ ┌─────────────────────────────────────┐ │
│ │  Glisser le fichier .xlsx ici       │ │
│ └─────────────────────────────────────┘ │
│ Preview:                                │
│  ✓ 580 PAID · ✗ 12 FAILED · ? 3 non match│
│ [Annuler]              [Appliquer statuts]│
└─────────────────────────────────────────┘
```

#### Cas limites

| Cas | Comportement |
|-----|--------------|
| 600+ lignes | Virtual scroll TanStack Virtual ; pagination server 50 |
| Bio NON / absente | Ligne **exclue** du bordereau (RG-03) ; non exportable MVola ; action « Forcer mode dégradé » réservée CDS avec audit |
| Mode dégradé (N/A) | Ligne exportable si audit trail complet ; badge distinct |
| Doublon période | Dialog correctif vs annuler |
| Export partiel | Non supporté V1 — export complet période |

---

## Livrables Figma attendus (post-design — statut `NOT_CREATED`)

| Frame Figma | Écrans | Variantes | Statut |
|-------------|--------|-----------|--------|
| `Admin/Dashboard` | Desktop 1280 | Loading, empty, alertes | `NOT_CREATED` |
| `Admin/Bordereau` | Desktop 1280 | PENDING, post-export, import modal | `NOT_CREATED` |
| `PWA/Saisie-lot` | Mobile 360 | Online, offline, avec photos | `NOT_CREATED` |
| `PWA/Validation-CDS` | Mobile + Tablet 768 | Liste, bio overlay, rejet modal | `NOT_CREATED` |

---

## Prochaines étapes design

1. Valider wireframes avec PO + 1 CDS (30 min review)
2. Produire maquettes haute-fidélité Figma
3. Mettre à jour ce document avec liens Figma réels
4. Test prototype saisie lot sur device Android cible

---

*Références : Spec fonctionnelle §5 · Backlog UC-CAD-03 · Prompt Dashboard KPIs*
