# Task 30 — FE-PWA-NFC

**Module:** FE-PWA-NFC — Web NFC (démarrage)  
**Branch:** feat/backlog-implementation  
**Date:** 2026-07-21

## Livrables

| Step | Statut | Détail |
|------|--------|--------|
| 1 — NDEFReader lecture | ✅ | `pwa/src/lib/nfc.ts` — session continue, normalisation UID |
| 2 — Feedback visuel + son | ✅ | Pulse scan, flash états, bip Web Audio |
| 3 — Badge inconnu + log local | ✅ | Dexie `presenceLog` + `badges`, journal du jour |

## Fichiers

- `pwa/src/lib/nfc.ts` — Web NFC API wrapper
- `pwa/src/lib/presence-log.ts` — résolution badge, journal local
- `pwa/src/pages/NfcScan.tsx` — UI scan présence CDE
- `pwa/src/types/web-nfc.d.ts` — typings NDEFReader
- `pwa/src/db/db.ts` — v3 `badges`, `presenceLog`
- Route `/nfc` + nav **Présence** (CDE)

## UI

- Scan NFC continu avec relance automatique
- États : scanning, OK, badge inconnu, doublon jour, permission refusée
- Mode manuel dégradé (source `MANUAL`)
- Compteur sync pending (Task 31 branchera `POST /presence/sync`)

## Suite

- **Task 31** — backend Badge + `/presence/sync`, sync référentiel badges Dexie
- **Task 36** — E2E Playwright NFC
