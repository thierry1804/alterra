# ALTERRA — Biométrie V2 : vérification online-only via Intent APK YAS

**Statut :** Proposition d'évolution — non intégrée à l'architecture technique ni au backlog MoSCoW
**Date :** 6 août 2026
**Documents impactés (à mettre à jour ultérieurement) :** `docs/architecture-technique.md`, `docs/cadrage/backlog-moscow.md`, `docs/cadrage/ateliers-compte-rendu.md` (§3 Règles biométriques)

---

## 1. Contexte et changements

Deux décisions actent une rupture avec le design V1 documenté (`ateliers-compte-rendu.md` §3, `architecture-technique.md`) :

1. **Suppression du mode offline.** La vérification biométrique doit **toujours** se faire en ligne. Le fallback `LOCAL_OFFLINE` (prévu comme report V2 dans `backlog-moscow.md` §V2, ligne "Biométrie offline") est abandonné, pas seulement reporté.
2. **Le provider YAS n'est plus un appel API REST cloud depuis le backend.** La vérification se fait via une **APK Android** installée sur le device terrain, invoquée par la PWA. Ceci remplace l'hypothèse initiale `AxianBiometricProvider.ts` (POST direct vers `https://biometric.yas.mg/api/v1/kyc/compare`).

---

## 2. Mécanisme retenu : Intent / deep-link Android

Confirmé (question posée le 6 août 2026, options envisagées : Intent/deep-link, serveur HTTP local, SDK natif embarqué) : **Intent/deep-link Android**.

Une PWA (page web dans Chrome) ne peut pas appeler une APK comme une librairie locale — pas de process partagé, pas de pont JS↔natif sans wrapper. Le mécanisme Android standard pour déléguer une action à une autre app et récupérer un résultat est l'Intent avec callback par deep-link (pattern utilisé par les apps mobile money / OAuth mobile).

### 2.1 Flux proposé

1. PWA génère une référence de vérification (ex. token lié au `Pointage` / `Worker` en cours) et une callback URL PWA (`https://<pwa-host>/bio-callback?ref=<token>`).
2. PWA déclenche l'intent :
   ```
   intent://yas.verify/#Intent;
     package=com.yas.bio;
     scheme=yas;
     S.reference_number=<mvolaNumber>;
     S.callback=<callback-url-encodée>;
     S.ref=<token>;
   end
   ```
3. L'APK YAS prend le focus, effectue la capture caméra + vérification faciale localement/via son propre backend.
4. L'APK redirige vers la callback URL avec le résultat : `?ref=<token>&result=OK|DOUBT|KO&score=0.91&signature=<sig>`.
5. PWA reprend le focus sur la callback, transmet le résultat au backend ALTERRA (`POST /biometric/check`) pour validation et création du `BiometricCheck`.

### 2.2 Point de vigilance sécurité — à trancher avant implémentation

Le retour d'intent transite par des query params côté client, donc **falsifiable** par l'utilisateur (modifier `result=KO` en `result=OK` sans vraie vérification). Le backend ne doit **jamais faire confiance** au résultat brut reçu de la PWA. Options à évaluer avec YAS :

- Signature cryptographique du payload de retour (`signature=<sig>`), vérifiée côté backend avec la clé publique YAS.
- Backend rappelle YAS en confirmation (server-to-server) avec le `ref`/token avant de marquer `BiometricCheck` comme `OK`.
- Token à usage unique, court TTL, lié au `Pointage` pour éviter le rejeu.

**Sans mécanisme de preuve vérifiable côté serveur, ce flux introduit une faille de contournement du contrôle biométrique.** À valider avec YAS avant tout développement.

---

## 3. Impacts techniques identifiés (non appliqués)

| Zone | Impact |
| --- | --- |
| `backend/src/services/biometric/AxianBiometricProvider.ts` | Obsolète tel quel (appel REST cloud direct). À remplacer par un endpoint recevant + validant le callback transmis par la PWA. |
| `backend/src/services/biometric/check-offline.service.ts` | À supprimer (plus d'offline). |
| Enum `BioProvider` (Prisma) | Retirer `LOCAL_OFFLINE`. Garder `MOCK` / `MANUAL` (tests, formation, recette sans YAS) + nouveau mode intent (nom à définir, ex. `YAS_APK`). |
| PWA `services/biometric/` | Ajouter déclenchement intent + page/route de callback (`/bio-callback`) qui parse le retour et relaie au backend. |
| `pwa/db/` (Dexie/IndexedDB) | Retirer tout cache biométrique offline lié à l'ancien design. |
| `docs/cadrage/ateliers-compte-rendu.md` §3 | Règles biométriques (seuils, provider, stockage photo) à revalider — la photo n'est plus envoyée par le backend à YAS, elle est capturée par l'APK elle-même. |

---

## 4. Questions ouvertes avant implémentation

| ID | Question | Responsable |
| --- | --- | --- |
| Q-BIO-APK-01 | Format exact de l'intent (package name réel, scheme, paramètres attendus) — doc technique YAS à obtenir | YAS |
| Q-BIO-APK-02 | Le retour de callback est-il signé/vérifiable côté serveur ? Quel mécanisme (clé publique, endpoint de confirmation server-to-server) ? | YAS |
| Q-BIO-APK-03 | L'APK est-elle pré-requise/pré-installée sur les devices terrain, ou installée à la volée si absente (fallback si intent échoue — app non installée) ? | YAS + Admin ALTERRA |
| Q-BIO-APK-04 | Comportement si connectivité coupée pendant le flux intent (PWA online-only désormais — quel état/erreur si l'APK elle-même a besoin de réseau) ? | YAS |
| Q-BIO-APK-05 | ~~La photo est-elle toujours "non stockée après envoi" comme en V1, sachant que la capture est maintenant faite par l'APK, pas par la PWA ?~~ **Réponse : oui, confirmé.** | YAS + RGPD |

**Réponses obtenues :**

- **Q-BIO-APK-05 (répondu) :** la photo capturée par l'APK n'est pas stockée après envoi — comportement identique à la V1, malgré le changement de qui effectue la capture (APK au lieu de la PWA). Pas d'impact sur la conformité RGPD/loi 2014-038 déjà actée.

---

## 5. Prochaine étape

Ne pas modifier `architecture-technique.md` ni `backlog-moscow.md` tant que Q-BIO-APK-01 et Q-BIO-APK-02 ne sont pas répondues par YAS — le design de la preuve de vérification (signature/confirmation serveur) conditionne le schéma `BiometricCheck` et les routes backend.
