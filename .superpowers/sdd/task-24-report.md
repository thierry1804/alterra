# Task 24 — DOC V1

**Module:** DOC — Documentation et formation  
**Branch:** feat/backlog-implementation  
**Date:** 2026-07-21

## Livrables

| Step | Statut | Détail |
|------|--------|--------|
| 1 — Guides utilisateur | ✅ | 3 guides MD + PDF (~15 p. équivalent chacun) |
| 2 — Doc exploitation | ✅ | `docs/runbook.md` enrichi (MEP, backup/restore) |
| 3 — Formation pilote | ✅ | `docs/guides/formation-pilote.md` (½j Admin+CDS, ½j CDE) |

## Fichiers

```
docs/guides/
├── guide-admin.md / .pdf
├── guide-cds.md / .pdf
├── guide-cde.md / .pdf
├── formation-pilote.md
└── README.md
docs/runbook.md          (playbook MEP, backup/restore détaillé)
scripts/generate-guide-pdfs.mjs
npm run docs:guides
```

## Contenu guides

| Guide | Sections principales |
|-------|---------------------|
| Admin | Connexion MFA, 9 modules sidebar, MVola, audit, dépannage |
| CDS | PWA, PIN, validation hebdo, bio, sync |
| CDE | Activité jour, saisie lot, offline, sync, rejets |

Les encarts `[Capture]` marquent les emplacements screenshots à compléter en session formation.

## Regénération PDF

```bash
npm run docs:guides
```

Utilise `md-to-pdf` (npx, Chromium embarqué).

## Liens runbook

- Playbook MEP avec go/no-go et checklist
- Procédure restore staging documentée
- Renvois vers `docs/deploy/production.md` et `docs/qa/recette-v1.md`
