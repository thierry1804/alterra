# Task 33 — BE-WF

**Module:** BE-WF — Backend workflows  
**Branch:** feat/backlog-implementation  
**Date:** 2026-07-21

## Livrables

| Step | Statut | Détail |
|------|--------|--------|
| 1 — Modèles + state machine | ✅ | RequestStatus, ClarificationStatus, transitions validées |
| 2 — 5 endpoints / entité | ✅ | list, get, create, action, cancel/answer/close |

## API — ActivityRequest

| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/activity-requests` | CDS, ADMIN |
| GET | `/activity-requests/:id` | CDS, ADMIN |
| POST | `/activity-requests` | CDS, ADMIN |
| PATCH | `/activity-requests/:id/decision` | ADMIN |
| PATCH | `/activity-requests/:id/cancel` | CDS, ADMIN |

## API — WorkerRequest

| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/worker-requests` | CDS, ADMIN |
| GET | `/worker-requests/:id` | CDS, ADMIN |
| POST | `/worker-requests` | CDS, ADMIN |
| PATCH | `/worker-requests/:id/decision` | ADMIN (crée Worker si APPROVED) |
| PATCH | `/worker-requests/:id/cancel` | CDS, ADMIN |

## API — ClarificationRequest

| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/clarification-requests` | CDS, CDE, ADMIN |
| GET | `/clarification-requests/:id` | CDS, CDE, ADMIN |
| POST | `/clarification-requests` | CDS, ADMIN |
| PATCH | `/clarification-requests/:id/answer` | CDE, ADMIN |
| PATCH | `/clarification-requests/:id/close` | CDS, ADMIN |

## State machine

- **Activity/Worker:** `PENDING` → `APPROVED` | `REJECTED` (decision admin) ou annulation demandeur
- **Clarification:** `OPEN` → `ANSWERED` (CDE) → `CLOSED` (CDS) ; pointage `NEEDS_CLARIFICATION` puis retour `PENDING`

## Schema

- FK `ClarificationRequest.pointageId` → `Pointage` (migration `20260721183000_workflow_clarification_fk`)

## Tests

`backend/src/__tests__/workflows.test.ts` — 4 scénarios.

## Suite

- **Task 34** — pages PWA workflows terrain
