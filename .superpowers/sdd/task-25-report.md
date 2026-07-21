# Task 25 — OPS-HYPERCARE V1

**Module:** OPS-HYPERCARE — Support post-MEP V1  
**Branch:** feat/backlog-implementation  
**Date:** 2026-07-21

## Livrables

| Step | Statut | Détail |
|------|--------|--------|
| 1 — Astreinte 3 semaines | ✅ | Organisation, canaux, calendrier S1–S3 |
| 2 — Hotfix bugs bloquants | ✅ | Workflow + commandes deploy/rollback |
| 3 — UX mineurs | ✅ | Critères ≤ 0,5 j-h, process validation |
| 4 — Réunion hebdo bilan | ✅ | Template 30–45 min |

## Fichiers

```
docs/ops/
├── README.md
├── hypercare-v1.md
├── incident-register.md
└── weekly-bilan-template.md
docs/runbook.md   (liens hypercare)
```

## Exécution terrain

Les steps 1–4 sont des **activités post-MEP** ; ce commit fournit le cadre opérationnel à activer dès J+1 après MEP (contacts à compléter §8 hypercare-v1).

## Liens

- Hotfix : `infra/scripts/deploy.sh`, `rollback.sh`
- QA : `docs/qa/recette-v1.md`
- Marge / retro : `docs/retrospective-v1.md` (Task 26)
