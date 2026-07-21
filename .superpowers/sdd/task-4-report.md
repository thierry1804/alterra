# Task 4 Report — Module BE-AUTH : Authentification

**Date:** 2026-07-21  
**Branch:** `feat/backlog-implementation`  
**Commit:** _(see git log)_  
**Status:** ✅ Complet — login, refresh rotation, logout, MFA TOTP Admin

---

## Checklist

| Step | Item | Status |
| ---- | ---- | ------ |
| 1 | Login Argon2id + JWT HS256 (access 15 min) | ✅ |
| 2 | Refresh token HttpOnly 7j avec rotation + blacklist Redis | ✅ |
| 3 | Logout révocation DB + blacklist + clear cookie | ✅ |
| 4 | MFA TOTP Admin (secret chiffré AES-256-GCM) | ✅ |
| 5 | Tests unitaires auth (vitest + supertest, mocks Prisma) | ✅ |
| 6 | `npm run lint -w backend && npm run test -w backend` | ✅ PASS |

---

## Changements principaux

### Redis (`backend/src/lib/redis.ts`)

- Client lazy via `REDIS_URL`
- Fallback in-memory automatique si `NODE_ENV=test` ou si Redis injoignable
- Fonctions `blacklistRefreshToken()` / `isRefreshTokenBlacklisted()` avec préfixe `refresh:blacklist:`

### Refresh token service (`backend/src/services/auth/refresh.service.ts`)

- Token aléatoire 32 bytes (base64url), hash SHA-256 en DB (`RefreshToken.tokenHash`)
- Cookie HttpOnly `refreshToken`, 7 jours, SameSite strict
- Rotation : révoque l'ancien, blacklist Redis (TTL = durée restante), émet nouveau token + access JWT
- Logout : révocation DB + blacklist + `clearCookie`

### JWT (`backend/src/lib/jwt.ts`)

- Algorithme explicite `HS256` sur sign et verify
- Payload access : `{ sub, role, siteId }`
- Suppression des refresh JWT (remplacés par tokens opaques)

### MFA (`backend/src/services/auth/mfa.service.ts`)

- `otplib` v13 (`generateSecret`, `generateURI`, `verifySync`)
- Chiffrement AES-256-GCM via `MFA_ENCRYPTION_KEY` (64 hex = 32 bytes)
- Endpoints :
  - `POST /auth/mfa/setup` — ADMIN, retourne `otpauthUrl`
  - `POST /auth/mfa/verify` — ADMIN, active MFA après code TOTP
- Login : si `role=ADMIN` et `mfaSecret` défini → `mfaCode` obligatoire

### Routes (`backend/src/routes/auth.routes.ts`)

- Login, refresh, logout, me, mfa/setup, mfa/verify refactorisés

### Env

- `.env.example` : ajout `MFA_ENCRYPTION_KEY`

### Tests (`backend/src/__tests__/auth.test.ts`)

- Mock Prisma (pas de Docker requis)
- 5 tests : credentials invalides, login OK, HS256, refresh sans cookie, MFA requis

---

## Tests & lint

```
npm run lint -w backend  → PASS
npm run test -w backend  → PASS
  ✓ auth: invalid credentials → 401
  ✓ auth: valid login → 200 + accessToken + cookie
  ✓ auth: JWT header alg = HS256
  ✓ auth: refresh without cookie → 401
  ✓ auth: MFA required when mfaSecret set
  ✓ health endpoints (×2)
  ↷ seed data counts (skipped — DB unavailable)
  (7 passed | 1 skipped, 8 total)
```

---

## Notes techniques

- **Redis test** : `vitest.config.ts` force `NODE_ENV=test` → store in-memory, pas de Docker Redis
- **otplib v13** : API fonctionnelle (`generateSecret`, `verifySync`) — pas de namespace `authenticator`
- **Pending MFA** : secret temporaire en mémoire (Map) pendant 10 min entre setup et verify

---

## Fichiers touchés

| Fichier | Action |
| ------- | ------ |
| `backend/src/lib/redis.ts` | Créé |
| `backend/src/services/auth/refresh.service.ts` | Créé |
| `backend/src/services/auth/mfa.service.ts` | Créé |
| `backend/src/lib/jwt.ts` | Modifié |
| `backend/src/routes/auth.routes.ts` | Modifié |
| `backend/src/__tests__/auth.test.ts` | Créé |
| `backend/vitest.config.ts` | Modifié |
| `backend/package.json` | +otplib |
| `.env.example` | +MFA_ENCRYPTION_KEY |
