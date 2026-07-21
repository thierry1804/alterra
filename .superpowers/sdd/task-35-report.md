# Task 35 — FE-ADMIN-WF

**Module:** FE-ADMIN-WF — Traitement demandes Admin  
**Branch:** feat/backlog-implementation  
**Date:** 2026-07-21

## Livrables

| Step | Statut | Détail |
|------|--------|--------|
| 1 — File unifiée onglets | ✅ | Activités / MOC / Précisions |
| 2 — Tri ancienneté + drawer | ✅ | `sortByOldest`, drawer détail |
| 3 — Actions décision | ✅ | Accepter / Refuser / Complément |

## Fichiers

- `admin/src/pages/Requests.tsx` — page principale
- `admin/src/components/requests/RequestDetailDrawer.tsx` — détail + actions
- `admin/src/lib/workflows.ts` — API client + libellés
- Navigation `/requests` (ADMIN)

## Backend complémentaire

- `PATCH /activity-requests/:id/complement` — commentaire, statut PENDING
- `PATCH /worker-requests/:id/complement` — idem
- Services `complementActivityRequest` / `complementWorkerRequest`

## Comportement

- **Activités / MOC en attente** : Accepter crée l'entité (BE Task 33), Refuser exige un motif, Complément enregistre un commentaire sans clôturer
- **Précisions** : consultation seule (traitement CDS/CDE sur PWA)

## Suite

- **Task 36** — Cartographie Leaflet admin
