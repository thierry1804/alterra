# Task 15 Report — Module FE-PWA-0 : Setup PWA

**Date :** 21 juillet 2026  
**Statut :** ✅ Complet

---

## Checklist

| Step | Item | Status |
| ---- | ---- | ------ |
| 1 | vite-plugin-pwa + Workbox (cache-first assets, network-first API) | ✅ |
| 2 | Schéma Dexie v2 (workers, pointages, syncQueue, settings) | ✅ |
| 3 | Login PWA + token chiffré WebCrypto (AES-GCM + PBKDF2) | ✅ |
| 4 | PIN 4 chiffres + verrouillage 30 min inactivité | ✅ |
| 5 | build PWA | ✅ PASS |

---

## Fichiers clés

| Fichier | Rôle |
| ------- | ---- |
| `public/manifest.webmanifest` | Manifest PWA standalone |
| `src/lib/crypto.ts` | Chiffrement session WebCrypto |
| `src/lib/session.ts` | Persistance PIN + token chiffré |
| `src/pages/Login.tsx` | Auth email/mot de passe |
| `src/pages/UnlockPin.tsx` | Création / saisie PIN |
| `src/db/db.ts` | Dexie v2 + migration v1 |
| `vite.config.ts` | Workbox NetworkFirst API |

## Auth flow

1. Login → API `/auth/login` (refresh HttpOnly cookie)
2. Premier login → création PIN 4 chiffres
3. Session chiffrée en IndexedDB (`settings`)
4. Après 30 min inactivité → écran PIN
5. Refresh token automatique via intercepteur axios

---

## Note

- MFA réservé aux comptes Admin (message explicite côté PWA)
- PDF rapports hebdo : Task 20
