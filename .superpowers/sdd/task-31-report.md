# Task 31 — BE-NFC

**Module:** BE-NFC — Backend présence  
**Branch:** feat/backlog-implementation  
**Date:** 2026-07-21

## Livrables

| Step | Statut | Détail |
|------|--------|--------|
| 1 — PresenceRecord + sync | ✅ | `POST /presence/sync` idempotent (clientUuid) |
| 2 — Badge CRUD | ✅ | `GET/POST/PATCH/DELETE /badges` |
| 3 — Tests Android | ⏭ | Tests unitaires API ; tests physiques = checklist flotte |

## API

| Méthode | Route | Rôle |
|---------|-------|------|
| POST | `/presence/sync` | CDE, CDS, ADMIN |
| GET | `/presence` | CDE, CDS, ADMIN |
| GET | `/badges` | CDE, CDS, ADMIN |
| GET | `/badges/:id` | CDE, CDS, ADMIN |
| POST | `/badges` | ADMIN |
| PATCH | `/badges/:id` | ADMIN |
| DELETE | `/badges/:id` | ADMIN (révocation) |

## Fichiers

- `backend/src/routes/presence.routes.ts`
- `backend/src/routes/badges.routes.ts`
- `backend/src/services/presence/sync.service.ts`
- `backend/src/lib/nfc-tag.ts`
- `backend/src/__tests__/presence.test.ts`
- `backend/src/__tests__/badges.test.ts`
- `pwa/src/sync/PresenceSync.ts` — push présences offline
- `pwa/src/sync/ReferentialSync.ts` — cache badges Dexie

## Notes

- Modèles Prisma déjà en migration init (pas de nouvelle migration).
- Scope badges : CDE = équipe, CDS = site.
- Sync auto inclut présences après pointages (`SyncManager`).

## Suite

- **Task 32** — cache biométrique offline
- **Task 36** — E2E Playwright NFC
