# Task 1 Report — Module CAD — Cadrage projet

**Date :** 21 juillet 2026  
**Branche :** `feat/backlog-implementation`  
**Statut :** DONE (review fixes appliquées)

---

## Objectif

Produire les livrables de cadrage Sprint 1 (UC-CAD-01 à UC-CAD-03) : compte-rendu atelier, backlog MoSCoW V1, wireframes écrans clés, documentation format MVola.

---

## Livrables créés

| Fichier | Step | Description |
|---------|------|-------------|
| `docs/cadrage/ateliers-compte-rendu.md` | Step 1 | CR synthétique « cadrage documenté en attente validation métier » + 20 questions ouvertes |
| `docs/cadrage/backlog-moscow.md` | Step 2 | MoSCoW complet V1 (55 UC) avec critères d'acceptation résumés |
| `docs/cadrage/maquettes-figma-liens.md` | Step 3 | Wireframes détaillés 4 écrans (layout, composants, champs, interactions) |
| `docs/cadrage/mvola-format.md` | Step 4 | Spec format Bulk Transfer 5 colonnes + import retour ; statut échantillon |

---

## Self-review vs brief

| Step | Brief | Réalisé | Écart |
|------|-------|---------|-------|
| Step 1 | Atelier métier live CDS+Admin | Synthèse documentaire + questions ouvertes | Atelier réel non tenu (contrainte session) |
| Step 2 | Backlog priorisé + CA par UC | MoSCoW V1 complet | OK |
| Step 3 | Maquettes Figma 4 écrans | Wireframes specs designer-ready ; lien Figma placeholder | Fichiers Figma non produits |
| Step 4 | Échantillon Excel MVola | Spec documentée ; `modele.xlsx` = backlog, pas MVola | Échantillon ALTERRA en attente |

---

## Concerns

1. **Atelier métier non animé** — validation métier requise avant figer specs.
2. **Figma non produit** — wireframes textuels suffisants pour designer ; maquettes HF à planifier.
3. **Échantillon MVola absent** — `basedocs/modele.xlsx` est un fichier backlog/chiffrage, pas un template MVola. Condition Sprint 1 non remplie côté ALTERRA.
4. **Décisions D1–D6** proposées mais non signées par référent ALTERRA.

---

## Tests

N/A — livrables documentation uniquement.

---

## Commit

Message : `docs: cadrage Sprint 1 — compte-rendu, MoSCoW, wireframes, MVola`

---

## Prochaines actions recommandées

1. Planifier atelier ALTERRA (2 × ½ journée) et mettre à jour `ateliers-compte-rendu.md`.
2. Demander échantillon MVola Bulk Transfer (export + retour).
3. Brief designer UX pour production Figma depuis `maquettes-figma-liens.md`.
4. Valider MoSCoW avec PO après atelier.

---

## Review fixes (2026-07-21)

Corrections appliquées suite à la revue Task 1 :

| # | Sévérité | Fichier | Correction |
|---|----------|---------|------------|
| 1 | Critique | `backlog-moscow.md` | Budget V1 aligné **50 j-h firm** ; marge ~7 j-h (`UC-MARGE-V1`) séparée |
| 2 | Critique | `backlog-moscow.md` | Stack : **npm workspaces + Express** (suppression mandats NestJS/Fastify/pnpm/Turborepo) |
| 3 | Critique | `backlog-moscow.md`, `ateliers-compte-rendu.md` | MFA TOTP Admin repassé en **Must** (D6 + MoSCoW) |
| 4 | Important | `mvola-format.md`, `maquettes-figma-liens.md` | RG-03 : pas de ligne paiement sans bio OK ; mode dégradé `N/A` + audit uniquement |
| 5 | Important | `backlog-moscow.md` | JWT **HS256** explicite dans critères auth |
| 6 | Important | `backlog-moscow.md` | Note : synthèse MoSCoW dérivée du backlog détaillé (pas duplicate US) |
| 7 | Mineur | `ateliers-compte-rendu.md` | Questions ouvertes réduites à 5 prioritaires ; reste en annexe 9.1 |
| 8 | Mineur | `maquettes-figma-liens.md` | Statut Figma `NOT_CREATED` explicite |

**Tests :** N/A — livrables documentation uniquement.

**Commit :** `docs: fix Task 1 cadrage per review findings`

---

## Review fixes round 2 (2026-07-21)

Corrections appliquées suite à la revue Task 1 (findings restants) :

| # | Sévérité | Fichier | Correction |
|---|----------|---------|------------|
| 1 | Critique | `mvola-format.md`, `maquettes-figma-liens.md`, `backlog-moscow.md` | **RG-03 strict** : seul Bio **OK** autorise validation et export MVola bulk ; DOUBT/KO/absent/N/A bloquent ; mode dégradé = override Admin + audit uniquement, jamais inclus export bulk |
| 2 | Critique | `backlog-moscow.md` | Terminologie **Express** : `@Roles()`/Guard/Interceptor → middleware `requireRole()`, middleware audit |
| 3 | Critique | `backlog-moscow.md` | **Budget 50 j-h firm** : `UC-MARGE-V1` repassé en **R** (réserve contingence hors firm) ; Must = 38 UC ~50 j-h livrable contractuel |

**Tests :** N/A — livrables documentation uniquement.

**Commit :** `docs: Task 1 cadrage — RG-03 strict, Express terms, budget scope`

---

## Consistency fixes (2026-07-21)

Corrections finales d'alignement documentaire Task 1 :

| # | Fichier | Correction |
|---|---------|------------|
| 1 | `ateliers-compte-rendu.md` | **RG-03 strict** : suppression exception mode dégradé CDS / `N/A` en export bulk ; override Admin + audit hors export MVola ; colonne Excel `OUI` uniquement |
| 2 | `backlog-moscow.md` | Table budget : Must = **50 j-h firm** livrable contractuel ; Should/Could **non additifs** — négociation scope ou absorption capacité |

**Tests :** N/A — livrables documentation uniquement.

**Commit :** `docs: Task 1 — align atelier CR and budget table with RG-03`

---

## Références sources utilisées

- `basedocs/ALTERRA - Spécification fonctionnelle détaillée.md`
- `basedocs/ALTERRA - Spécification technique détaillée.md`
- `basedocs/ALTERRA - Backlog détaillé.md`
- `basedocs/ALTERRA_Cursor_Prompt_Dashboard_KPIs.md`
- `basedocs/ALTERRA - Brief Chef de Projet.md`
- `basedocs/modele.xlsx` (inspecté — backlog, pas MVola)
