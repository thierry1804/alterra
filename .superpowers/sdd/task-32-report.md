# Task 32 — FE-PWA-BIO

**Module:** FE-PWA-BIO — Cache biométrique local  
**Branch:** feat/backlog-implementation  
**Date:** 2026-07-21

## Livrables

| Step | Statut | Détail |
|------|--------|--------|
| 1 — GET /biometric/templates/sync + chiffrement PIN | ✅ | TemplateCache AES-GCM clé session |
| 2 — Stockage IndexedDB | ✅ | Dexie v4 `biometricTemplates` |
| 3 — face-api lazy + seuil 0.6 | ✅ | `@vladmandic/face-api`, TinyFace, `/models` |
| 4 — POST /biometric/check-offline | ✅ | Provider `LOCAL_OFFLINE`, sync auto |

## API

| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/biometric/templates/sync` | CDE, CDS, ADMIN |
| POST | `/biometric/templates` | ADMIN |
| POST | `/biometric/check-offline` | CDE, CDS, ADMIN |

## Fichiers

**Backend**
- `backend/src/routes/biometric-templates.routes.ts`
- `backend/src/services/biometric/template.service.ts`
- `backend/src/services/biometric/check-offline.service.ts`
- `backend/src/routes/biometric.routes.ts` (+ check-offline)

**PWA**
- `pwa/src/services/biometric/TemplateCache.ts`
- `pwa/src/services/biometric/FaceMatcher.ts`
- `pwa/public/models/` — poids face-api (precache offline)
- `BiometricCapture.tsx` — match local puis sync
- Dexie `biometricTemplates`, `biometricOfflineChecks`

## Tests

`biometric-templates.test.ts` (3) + `biometric.test.ts` (1) — 4/4 passés.

## Seed

10 templates MOCK (descripteurs 128D) pour les premiers MOC.

## Suite

- **Task 33** — BE-WF workflows demandes
