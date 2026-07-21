# Task 19 Report — Module BE-BIO : Biométrie

**Date :** 21 juillet 2026  
**Statut :** ✅ Complet

---

## Checklist

| Step | Item | Status |
| ---- | ---- | ------ |
| 1 | Adapter pattern, choix runtime `BIOMETRIC_PROVIDER` | ✅ |
| 2 | Mock + Manual providers | ✅ |
| 3 | AxianBiometricProvider (API Key, 5xx → UNAVAILABLE, logs rawResponse) | ✅ |
| 4 | Mode manuel documenté si AXIAN absent (`.env.example`) | ✅ |

---

## Fichiers

| Fichier | Rôle |
| ------- | ---- |
| `services/biometric/BiometricProvider.interface.ts` | Interface + `mvolaNumber` pour AXIAN |
| `services/biometric/MockBiometricProvider.ts` | Dev — OK si photo |
| `services/biometric/ManualBiometricProvider.ts` | Dégradé — DOUBT systématique |
| `services/biometric/AxianBiometricProvider.ts` | API multipart, timeout 8s |
| `services/biometric/score-mapping.ts` | Seuil OK / plancher DOUBT 0.5 |
| `services/biometric/index.ts` | Factory `getBiometricProvider()` |
| `services/biometric/check.service.ts` | Passe `mvolaNumber`, persiste `rawResponse` |

## Décision AXIAN (Step 4)

- **Dev / CI :** `BIOMETRIC_PROVIDER=MOCK` (défaut)
- **Recette sans sandbox AXIAN :** `BIOMETRIC_PROVIDER=MANUAL` — DOUBT + revue Admin
- **Prod quand API disponible :** `BIOMETRIC_PROVIDER=AXIAN` + `AXIAN_API_KEY`

Engagement contractuel AXIAN reste une action métier PO ; le code bascule sans redeploy via env.

## Variables env

| Variable | Défaut | Description |
| -------- | ------ | ----------- |
| `BIOMETRIC_PROVIDER` | `MOCK` | `MOCK` \| `MANUAL` \| `AXIAN` |
| `AXIAN_API_URL` | `https://biometric.axian.mg/api/v1/kyc/compare` | Endpoint compare |
| `AXIAN_API_KEY` | — | Clé API (obligatoire si AXIAN) |
| `AXIAN_MATCH_THRESHOLD` | `0.85` | Seuil OK |
