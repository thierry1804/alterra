# Task 29 — FE-PWA-TEAM

**Module:** FE-PWA-TEAM — Équipes côté terrain  
**Branch:** feat/backlog-implementation  
**Date:** 2026-07-21

## Livrables

| Step | Statut | Détail |
|------|--------|--------|
| 1 — CDS CRUD équipes | ✅ | Nom, chef, membres (autocomplétion MOC) |
| 2 — CDE membres locaux | ✅ | Ajout/retrait MOC, pas de CRUD structure |

## API

| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/teams?active=` | CDS, CDE, ADMIN |
| GET | `/teams/:id` | CDS, CDE (own), ADMIN |
| GET | `/teams/chef-candidates` | CDS, ADMIN |
| POST | `/teams` | CDS, ADMIN |
| PATCH | `/teams/:id` | CDS, ADMIN |
| DELETE | `/teams/:id` | CDS, ADMIN (désactive si MOC présents) |
| POST | `/teams/:id/members` | CDS, CDE (own team) |
| DELETE | `/teams/:id/members/:workerId` | CDS, CDE (own team) |

## Fichiers

- `backend/src/routes/teams.routes.ts`
- `backend/src/__tests__/teams.test.ts`
- `pwa/src/pages/TeamManagement.tsx`
- `pwa/src/lib/teams.ts`
- Route `/teams` + nav AppShell PWA

## Tests

`npm test -- teams.test.ts` — liste, création CDS, refus CDE, membres add/remove.

## Notes

- Mutations `worker.teamId` via `basePrisma` (contourne RLS CDE pour retrait MOC).
- Sync Dexie référentiels après changement membres (`syncReferentials`).
