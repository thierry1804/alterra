# Task 38 — QA-V2

**Module:** QA-V2 — Assurance qualité V2  
**Branch:** feat/backlog-implementation  
**Date:** 2026-07-21

## Livrables

| Step | Statut | Détail |
|------|--------|--------|
| 1 — E2E NFC + bio offline | ✅ | `nfc-presence.spec.ts`, `bio-offline.spec.ts` |
| 2 — Offline journée complète | ✅ | `offline-day.spec.ts` enrichi (CDE lot + CDS clôture) |
| 3 — Recette + hypercare V2 | ✅ | `docs/qa/recette-v2.md`, `docs/ops/hypercare-v2.md` |

## Specs Playwright ajoutées

| Fichier | Scénario |
|---------|----------|
| `nfc-presence.spec.ts` | CDE — présence mode manuel (dégradé Web NFC) |
| `bio-offline.spec.ts` | CDS — capture bio hors ligne |
| `workflows.spec.ts` | CDS demande activité → Admin file demandes |
| `offline-day.spec.ts` | + CDS preview clôture journalière |

## Config

- `playwright.config.ts` — testMatch étendu (nfc, bio, workflows)
- `e2e/fixtures/sample-photo.png` — fixture capture bio
- `e2e/helpers/env.ts` — `ADMIN_URL`, `SEED_WORKER_ID`
- `e2e/helpers/auth.ts` — `unlockPwaIfNeeded` (rechargement SPA + PIN)
- `pwa/UnlockPin.tsx` — retour vers `state.from` après déverrouillage

## Résultat

8/8 tests Playwright passés (`npm run test:e2e`).

## Suite

- **Task 39** — MARGE-V2 provision imprévus
