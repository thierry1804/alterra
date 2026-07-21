---
target: toutes les interfaces admin + pwa
total_score: 21
p0_count: 1
p1_count: 4
timestamp: 2026-07-21T19-02-30Z
slug: admin-src-pwa-src
---
Method: dual-agent (A: 71c53b7c · B: 0fd20aea)

## Design Health Score

| # | Heuristique | Score | Problème clé |
|---|-------------|-------|--------------|
| 1 | Visibilité du statut système | 3 | SyncStatusBar OK ; labels équipe UUID |
| 2 | Correspondance système / monde réel | 2 | Jargon MOC, Sync technique |
| 3 | Contrôle et liberté | 2 | window.prompt rejet ; delete sans confirm |
| 4 | Cohérence et standards | 2 | Admin shadcn vs PWA inline |
| 5 | Prévention des erreurs | 2 | Suppression MOC directe |
| 6 | Reconnaissance plutôt que mémorisation | 2 | Nav 12 entrées ; équipes UUID |
| 7 | Flexibilité et efficacité | 2 | Pas de raccourcis clavier |
| 8 | Design esthétique et minimaliste | 3 | Admin propre ; PWA utilitaire |
| 9 | Récupération d'erreurs | 2 | Messages génériques |
| 10 | Aide et documentation | 1 | Aucune aide contextuelle |
| **Total** | | **21/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM :** Admin shadcn générique mais pas du slop ; PWA honnête mais brouillon. Deux apps sans identité partagée.

**Détecteur :** 0 finding Codex. Finding manuel P0 : PWA sans pipeline Tailwind (CSS 0.07 kB).

## Priority Issues (post-fix status)

- [P0 FIXED] Tailwind PWA configuré — CSS 16.56 kB
- [P1 FIXED] Rejet pointage via RejectDialog modal
- [P1 FIXED] Nav admin groupée en 5 sections
- [P1 FIXED] Composant Button PWA + touch targets min-h-11
- [P1 FIXED] Nav PWA scroll horizontal + libellés français
- [P2 FIXED] Labels équipe via API /teams
- [P2 FIXED] Confirmation suppression travailleur admin
- [P2 FIXED] Contrastes placeholder et icônes KPI
- [P2 FIXED] Copy Sync page user-friendly

## Persona Red Flags (remaining)

- Alex : pas de raccourcis clavier, validation unitaire
- Jordan : jargon MOC persiste dans certains libellés internes
- Sam : bio capture alt="" toujours à corriger
