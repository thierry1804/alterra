### Task 4: Module BE-AUTH — Authentification

**Use Cases:** `UC-BE-AUTH` (×4)  
**Estimation:** 1.50 j-h (BE)

**Files:**
- Modifier : `backend/src/routes/auth.routes.ts`
- Modifier : `backend/src/lib/jwt.ts`
- Modifier : `backend/src/middleware/auth.ts`
- Créer : `backend/src/services/auth/refresh.service.ts`
- Créer : `backend/src/services/auth/mfa.service.ts`

**Interfaces:**
- `POST /auth/login` → `{ accessToken, user }`
- `POST /auth/refresh` → rotation refresh, blacklist Redis
- `POST /auth/logout` → révocation + suppression cookie
- MFA TOTP Admin : secret chiffré, QR code, vérification 6 chiffres

- [ ] **Step 1:** Implémenter login Argon2id + JWT HS256 (access 15 min)
- [ ] **Step 2:** Implémenter refresh token HttpOnly 7j avec rotation Redis
- [ ] **Step 3:** Implémenter logout + blacklist
- [ ] **Step 4:** Implémenter MFA TOTP pour Admin
- [ ] **Step 5:** Tests unitaires auth
