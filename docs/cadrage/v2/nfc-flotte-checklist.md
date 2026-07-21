# Checklist flotte Android NFC — condition Sprint 7

**UC :** `UC-CAD-V2` Step 3  
**Objectif :** confirmer ≥ 80 % des appareils CDE compatibles Web NFC (Chrome Android)

---

## Prérequis test

- Chrome ≥ 89 sur Android
- HTTPS ou localhost (PWA prod OK)
- Badges NFC NTAG213/215 programmés (UID enregistré backend Task 31)

## Procédure par appareil

| # | Modèle | Android | Chrome | Web NFC API | Scan OK | Notes |
|---|--------|---------|--------|-------------|---------|-------|
| 1 | | | | ☐ | ☐ | |
| 2 | | | | ☐ | ☐ | |
| 3 | | | | ☐ | ☐ | |

**Test Web NFC API :** ouvrir `/nfc` (Task 30) ou console :

```javascript
"NDEFReader" in window
```

## Critères Go Sprint 7

| Critère | Seuil |
|---------|-------|
| Appareils testés | ≥ 5 par site pilote |
| Taux compatibilité | ≥ 80 % |
| Scan badge seed | 100 % sur échantillon |
| Plan B documenté | Mode manuel MANUAL si NFC KO |

## Plan B (mode dégradé)

- Saisie présence manuelle par CDE (source `MANUAL`)
- Pas de blocage saisie lot si NFC indisponible
- Signalement Admin via registre hypercare

## Décision

- [ ] **Go** — démarrer Tasks 28–30
- [ ] **No-go** — remplacer flotte ou reporter NFC

**Date :** ___/___/2026  
**Validé par :**

---

*Task 27 Step 3*
