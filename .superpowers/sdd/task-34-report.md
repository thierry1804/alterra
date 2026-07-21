# Task 34 — FE-PWA-WF

**Module:** FE-PWA-WF — Workflows côté terrain  
**Branch:** feat/backlog-implementation  
**Date:** 2026-07-21

## Livrables

| Step | Statut | Détail |
|------|--------|--------|
| 1 — Précisions CDS→CDE | ✅ | Formulaire, liste, réponse CDE (texte + photo), clôture CDS |
| 2 — Demande activité | ✅ | Formulaire libellé/unité/tarif/justification, suivi + annulation |
| 3 — Demande MOC | ✅ | Formulaire complet + photo MinIO, suivi + annulation |

## Pages PWA

| Route | Rôle | Fichier |
|-------|------|---------|
| `/clarifications` | CDS, CDE, ADMIN | `ClarificationRequest.tsx` |
| `/activity-requests` | CDS, ADMIN | `ActivityRequest.tsx` |
| `/worker-requests` | CDS, ADMIN | `WorkerRequest.tsx` |

## Intégration

- Navigation `AppShell` — liens Précisions / Activités / MOC
- Validation CDS — bouton « Précisions » par pointage → `/clarifications?pointageId=…`
- `pwa/src/lib/workflows.ts` — types, pagination, upload photo presigné

## Backend complémentaire (0.25 j-h)

- `POST /worker-requests/photo-upload-url` (CDS, ADMIN)
- `POST /clarification-requests/photo-upload-url` (CDE, ADMIN)
- `workflowPhotoUploadUrl()` dans `presigned-url.service.ts`

## Hors scope V2 immédiat

- Notifications push CDE / email Admin (spec UC-18/20 — infra absente)

## Suite

- **Task 35** — Admin file demandes unifiée (`Requests.tsx`)
