# Résultats détaillés — Recette Sprint 3 sur l'environnement de démonstration

Détail complet, test par test, de la recette du Sprint 3 (jalon 3) sur l'environnement de démonstration, en deux temps le **20 septembre 2026** : la recette initiale (74 tests réussis sur 95, avant correction) puis son rejeu après correction (**95 sur 95**). Ce document complète `docs/qa/sprint3-rapport-recette-demo.md` (verdict initial, anomalies) et `docs/qa/sprint3-corrections.md` (corrections).

Aucun mot de passe, jeton ni identifiant secret n'apparaît ici. La recette initiale n'a modifié aucun code applicatif ; les corrections sont décrites en section 0.

## Sommaire

0. [Rejeu après correction](#0-rejeu-après-correction-20-septembre-2026)
1. [Contexte et campagne](#1-contexte-et-campagne)
2. [Synthèse chiffrée](#2-synthèse-chiffrée)
3. [Résultat détaillé par spec](#3-résultat-détaillé-par-spec)
4. [Échecs : messages complets](#4-échecs--messages-complets)
5. [Mesures et constats relevés pendant les tests](#5-mesures-et-constats-relevés-pendant-les-tests)
6. [Correspondance anomalies ↔ tests](#6-correspondance-anomalies--tests)
7. [Données créées et état du nettoyage](#7-données-créées-et-état-du-nettoyage)
8. [Comptes réels sollicités et effets de bord](#8-comptes-réels-sollicités-et-effets-de-bord)
9. [Preuves, limites et rejeu](#9-preuves-limites-et-rejeu)

## 0. Rejeu après correction (20 septembre 2026)

Les sections 1 à 9 ci-dessous décrivent la **recette initiale**, faite avant correction (74 tests réussis sur 95). Elles sont conservées telles quelles, comme état de départ. Cette section 0 rend compte du **rejeu de la même suite** après correction des anomalies A1 à A15 et déploiement sur la démonstration.

**Résultat : 95 tests sur 95 réussis, 0 échec, 0 test ignoré** (75 tests Admin, 20 tests PWA).

### 0.1 Contexte du rejeu

| Élément | Valeur |
|---|---|
| Date | 20/09/2026, après le déploiement de 14 h 12 UTC |
| Code déployé | branche `develop`, HEAD `0937e4d` (quatre commits de correction : `cfa8c22`, `a3cc121`, `10951f3`, `0937e4d`) |
| Bundles déployés | Admin `index-DPla6o6H.js` / `index-7LPp1ijo.css`, PWA `index-BTpov1yW.js` / `index-CZhYqiI3.css` |
| Migration | `20260920140000_payment_reference_year` appliquée |
| Navigateur | Chromium de Playwright (`E2E_S3_CHANNEL=chromium`), exécuté depuis le VPS, 1 worker, 0 retry |
| Passes | deux passes : projet `admin` (78 réussis : 75 tests plus 3 d'infrastructure), puis projet `pwa` (23 réussis : 20 tests plus 3 d'infrastructure) |
| Comptes | administrateur, `cds.amb`, `cde.amb2` et comptes de test `E2E-S3-` ; mots de passe passés par variables d'environnement |

**Pourquoi deux passes.** L'API limite les routes `/api/v1/auth/*` à 100 requêtes par 5 minutes et par adresse IP. Toute la suite depuis une seule adresse dépasse cette limite : un premier passage complet a reçu des HTTP 429 sur quatre tests PWA (dont la connexion de `cds.amb`), sans lien avec les corrections.

### 0.2 Synthèse par spec, avant et après

| Spec | UC | Avant (OK / KO) | Après (OK / KO) |
|---|---|---:|---:|
| `sprint3-sites.spec.ts` | UC-FE-ADM-SITES | 5 / 2 | 7 / 0 |
| `sprint3-activities.spec.ts` | UC-FE-ADM-ACT | 6 / 1 | 7 / 0 |
| `sprint3-workers.spec.ts` | UC-FE-ADM-WORKERS | 9 / 2 | 11 / 0 |
| `sprint3-users.spec.ts` | UC-FE-ADM-USERS | 5 / 4 | 9 / 0 |
| `sprint3-pointages.spec.ts` | UC-FE-ADM-PNT | 4 / 3 | 7 / 0 |
| `sprint3-pay.spec.ts` | UC-FE-ADM-PAY-BORD / PAY-EXP / PAY-IMP | 7 / 1 | 8 / 0 |
| `sprint3-zz-pay-format.spec.ts` | UC-FE-ADM-PAY-EXP / PAY-IMP | 0 / 2 | 2 / 0 |
| `sprint3-reports.spec.ts` | UC-FE-ADM-REP | 4 / 2 | 6 / 0 |
| `sprint3-audit.spec.ts` | UC-FE-ADM-AUDIT | 3 / 1 | 4 / 0 |
| `sprint3-zz-audit-trail.spec.ts` | Transverse | 1 / 0 | 1 / 0 |
| `sprint3-rbac.spec.ts` | Transverse (RBAC) | 12 / 1 | 13 / 0 |
| `sprint3-pwa-setup.spec.ts` | UC-FE-PWA-SETUP | 6 / 0 | 6 / 0 |
| `sprint3-pwa-auth.spec.ts` | UC-FE-PWA-AUTH | 12 / 2 | 14 / 0 |
| **Total** | | **74 / 21** | **95 / 0** |

Le nombre de tests d'un cas d'usage peut différer entre les deux colonnes : la recette initiale comptait le dernier résultat de chaque test sur plusieurs runs, et des tests ont été ajoutés ou adaptés pour le rejeu (voir 0.5).

### 0.3 Résultat détaillé par test

Légende : ✅ réussi. Aucun test n'est en échec ni ignoré. Les notes reprennent les annotations émises par les tests (mesures, constats).

#### Sites

`sprint3-sites.spec.ts` — UC-FE-ADM-SITES

| # | Test | Résultat | Durée | Notes |
|---:|---|---|---:|---|
| 1 | liste paginée, cohérente avec la réponse API (lecture seule) | ✅ OK | 1.4 s |  |
| 2 | création via le formulaire (écriture E2E-S3-) | ✅ OK | 2.7 s |  |
| 3 | validations du formulaire (UI + API) | ✅ OK | 2.3 s |  |
| 4 | édition : le code est immuable, la localisation modifiable | ✅ OK | 3.3 s |  |
| 5 | désactivation | ✅ OK | 3.1 s |  |
| 6 | état vide : message explicite attendu | ✅ OK | 1.3 s |  |
| 7 | état d'erreur : message explicite attendu | ✅ OK | 2.7 s |  |

#### Activités et tarif versionné RG-04

`sprint3-activities.spec.ts` — UC-FE-ADM-ACT

| # | Test | Résultat | Durée | Notes |
|---:|---|---|---:|---|
| 1 | liste des catégories, recherche et dépliage (lecture seule) | ✅ OK | 3.7 s |  |
| 2 | création d'une catégorie via le formulaire + validations | ✅ OK | 2.9 s |  |
| 3 | changement de tarif : version fermée + nouvelle version (RG-04), historique visible | ✅ OK | 2.9 s |  |
| 4 | validations du tarif | ✅ OK | 0.1 s |  |
| 5 | désactivation de la sous-activité et de la catégorie | ✅ OK | 0.2 s |  |
| 6 | état vide | ✅ OK | 1.5 s |  |
| 7 | état d'erreur : message explicite attendu | ✅ OK | 2.8 s |  |

#### MOC, volumétrie et import Excel

`sprint3-workers.spec.ts` — UC-FE-ADM-WORKERS

| # | Test | Résultat | Durée | Notes |
|---:|---|---|---:|---|
| 1 | volumétrie du référentiel réel : rendu, chargement par curseur, recherche (lecture seule) | ✅ OK | 7.8 s | volumétrie: 316 MOC réels ; rendu initial 1483 ms ; chargement complet (6 clics) 5738 ms ; recherche d'un nom réel (14 caractères, masqué) → 1 ligne(s) en 171 ms ; critère 600+: volume réel 316 < 600 MOC : critère « 600+ lignes » non éprouvé sur le réel (extrapolation seulement) |
| 2 | filtres site et statut (jeu E2E) | ✅ OK | 1.8 s |  |
| 3 | état d'erreur : message explicite attendu | ✅ OK | 2.8 s |  |
| 4 | création via le formulaire | ✅ OK | 3.6 s |  |
| 5 | validations serveur : doublons et formats | ✅ OK | 0.2 s |  |
| 6 | édition (fiche) puis suppression avec confirmation | ✅ OK | 3.3 s |  |
| 7 | import : fichier valide (aperçu puis import réel, données E2E) | ✅ OK | 3.3 s |  |
| 8 | import : fichier mal formé et mauvaise extension | ✅ OK | 3.3 s |  |
| 9 | import : colonne obligatoire absente | ✅ OK | 1.8 s |  |
| 10 | import : doublons dans le fichier, lignes en erreur, doublon en base (aperçu seulement) | ✅ OK | 0.3 s |  |
| 11 | import : un numéro MVola déjà en base met à jour le MOC existant (upsert silencieux) | ✅ OK | 0.2 s | constat: L'import met à jour sans avertissement bloquant le MOC dont le n° MVola existe déjà (mention « à mettre à jour » dans l'aperçu uniquement). |

#### Utilisateurs

`sprint3-users.spec.ts` — UC-FE-ADM-USERS

| # | Test | Résultat | Durée | Notes |
|---:|---|---|---:|---|
| 1 | liste et filtre par rôle, cohérents avec l'API (lecture seule) | ✅ OK | 1.8 s |  |
| 2 | état d'erreur : message explicite attendu | ✅ OK | 2.9 s |  |
| 3 | création via le formulaire avec mot de passe temporaire généré | ✅ OK | 4.4 s |  |
| 4 | création avec un mot de passe saisi (champ « optionnel » du formulaire) | ✅ OK | 2.6 s |  |
| 5 | validations serveur : e-mail invalide, mot de passe court, e-mail en doublon | ✅ OK | 0.5 s |  |
| 6 | édition via le formulaire | ✅ OK | 17.8 s |  |
| 7 | réinitialisation du mot de passe | ✅ OK | 18.7 s |  |
| 8 | mot de passe réinitialisé : le compte reste bloqué 15 min (jetons neufs refusés) | ✅ OK | 0.7 s |  |
| 9 | désactivation : compte inactif refusé, sessions existantes révoquées | ✅ OK | 3.7 s |  |

#### Pointages

`sprint3-pointages.spec.ts` — UC-FE-ADM-PNT

| # | Test | Résultat | Durée | Notes |
|---:|---|---|---:|---|
| 1 | liste, requêtes réseau et filtres cohérents avec l'API | ✅ OK | 4.3 s | performance: 50 pointages affichés → 0 requêtes GET /workers/:id (une par MOC distinct, N+1) |
| 2 | état d'erreur : message explicite attendu | ✅ OK | 2.4 s |  |
| 3 | sync des pointages : création, idempotence, validations | ✅ OK | 0.3 s |  |
| 4 | détail puis correction avec motif obligatoire, tracée dans l'audit | ✅ OK | 3.3 s |  |
| 5 | validation refusée sans bio OK, rejet avec motif obligatoire | ✅ OK | 3.2 s | diagnostic: validate sans bio : admin → HTTP 422 BIO_NOT_OK ; CDS → HTTP 422 BIO_NOT_OK |
| 6 | isolation : CDE et CDS E2E ne voient que leurs pointages | ✅ OK | 0.1 s |  |
| 7 | état vide : message explicite | ✅ OK | 1.5 s |  |

#### Bordereau, export et import MVola

`sprint3-pay.spec.ts` — UC-FE-ADM-PAY-BORD / PAY-EXP / PAY-IMP

| # | Test | Résultat | Durée | Notes |
|---:|---|---|---:|---|
| 1 | préparation : pointages validés (bio OK) et garde-fou de période | ✅ OK | 2.1 s | biométrie: contrôle bio obtenu via : offline |
| 2 | état vide, génération du bordereau, statut bio, régénération | ✅ OK | 2.8 s | constat: Régénération : identifiants de lignes tous remplacés (suppression + recréation des lignes PENDING). |
| 3 | correction inline du montant avec motif obligatoire | ✅ OK | 2.5 s |  |
| 4 | export MVola : téléchargement, en-têtes, contenu vérifié colonne par colonne | ✅ OK | 2.5 s |  |
| 5 | règles après export : nouvel export, régénération et correction refusés | ✅ OK | 0.2 s |  |
| 6 | import : relevé sans rapprochement possible => paiements « non confirmés » | ✅ OK | 0.1 s |  |
| 7 | import : fichier mal formé ou colonnes manquantes | ✅ OK | 2.1 s | constat: fichier non Excel envoyé à /payments/import-status/columns → HTTP 422 |
| 8 | import du relevé : confirmé, écart de montant, orphelin, frais, ignoré, interne | ✅ OK | 2.9 s |  |

#### Conformité du fichier exporté et rejet d'un fichier non Excel

`sprint3-zz-pay-format.spec.ts` — UC-FE-ADM-PAY-EXP / PAY-IMP

| # | Test | Résultat | Durée | Notes |
|---:|---|---|---:|---|
| 1 | un fichier qui n'est pas un classeur Excel est refusé à la lecture des colonnes | ✅ OK | 0.0 s |  |
| 2 | l'en-tête du fichier exporté respecte la spécification MVola (5 colonnes) | ✅ OK | 0.0 s |  |

#### Rapports

`sprint3-reports.spec.ts` — UC-FE-ADM-REP

| # | Test | Résultat | Durée | Notes |
|---:|---|---|---:|---|
| 1 | aperçu « Pointages mensuels » cohérent avec l'API | ✅ OK | 1.4 s |  |
| 2 | aperçu « Paiements mensuels » cohérent avec l'API | ✅ OK | 1.6 s |  |
| 3 | aperçu « Présence par site » cohérent avec l'API | ✅ OK | 1.7 s |  |
| 4 | période sans donnée : état vide ; filtre site | ✅ OK | 1.8 s |  |
| 5 | état d'erreur : message explicite attendu | ✅ OK | 2.8 s |  |
| 6 | export CSV, Excel et « PDF » du rapport Pointages | ✅ OK | 2.0 s |  |

#### Journal d'audit

`sprint3-audit.spec.ts` — UC-FE-ADM-AUDIT

| # | Test | Résultat | Durée | Notes |
|---:|---|---|---:|---|
| 1 | table paginée cohérente avec l'API, navigation Précédent/Suivant | ✅ OK | 2.1 s |  |
| 2 | filtres action, entité, période ; état vide ; réinitialisation | ✅ OK | 3.2 s |  |
| 3 | le journal est en lecture seule (aucune route de modification) | ✅ OK | 0.2 s |  |
| 4 | état d'erreur : message explicite attendu | ✅ OK | 2.8 s |  |

#### Traçabilité de toutes les mutations de test

`sprint3-zz-audit-trail.spec.ts` — Transverse

| # | Test | Résultat | Durée | Notes |
|---:|---|---|---:|---|
| 1 | toutes les entités créées par la recette sont tracées dans l'audit (API = source de l'écran Audit) | ✅ OK | 1.1 s | audit: site: 14/14 tracés ; category: 13/13 tracés ; subActivity: 16/16 tracés ; user: 43/43 tracés ; team: 10/10 tracés ; worker: 39/39 tracés ; pointage: 42/42 tracés ; payment: 24/24 tracés |

#### RBAC, isolation par site, comptes inactifs

`sprint3-rbac.spec.ts` — Transverse (RBAC)

| # | Test | Résultat | Durée | Notes |
|---:|---|---|---:|---|
| 1 | administrateur : accès à tous les écrans | ✅ OK | 20.4 s |  |
| 2 | chef de service (AMB) : uniquement Tableau de bord et Pointages | ✅ OK | 13.9 s |  |
| 3 | chef d'équipe : refusé sur tout l'Admin | ✅ OK | 12.3 s |  |
| 4 | chef de service : la session Admin survit à un rechargement de page (F5) | ✅ OK | 4.2 s |  |
| 5 | écran de connexion Admin : aucun panneau de comptes de démonstration | ✅ OK | 1.3 s |  |
| 6 | sans jeton ou avec un jeton falsifié : 401 | ✅ OK | 0.4 s |  |
| 7 | chef de service : 403 sur les routes Admin, lectures limitées à son site | ✅ OK | 0.9 s |  |
| 8 | chef d'équipe : 403 sur les routes Admin et de validation | ✅ OK | 0.6 s |  |
| 9 | isolation entre sites : AMB et ANJ ne partagent aucune donnée | ✅ OK | 0.5 s |  |
| 10 | isolation UI : l'écran Pointages du chef de service n'affiche que son site | ✅ OK | 3.1 s |  |
| 11 | compte inactif : connexion refusée (API + écran de connexion) | ✅ OK | 2.4 s |  |
| 12 | compte de démonstration inactif réel : 1 seule tentative | ✅ OK | 0.2 s |  |
| 13 | mauvais mot de passe : message générique, puis connexion normale | ✅ OK | 2.8 s |  |

#### Manifest, service worker, précache, Dexie

`sprint3-pwa-setup.spec.ts` — UC-FE-PWA-SETUP

| # | Test | Résultat | Durée | Notes |
|---:|---|---|---:|---|
| 1 | manifest servi, lié à la page et installable (contrôle CDP « installabilityErrors ») | ✅ OK | 1.0 s | manifest: display=standalone start_url=/ icônes=192x192:image/png,512x512:image/png ; installabilité: aucune erreur |
| 2 | service worker enregistré, actif ; précache Workbox complet | ✅ OK | 1.8 s | précache: 8 entrées ; caches : workbox-precache-v2-https://alterra-pwa.boss-etech.net/(8), api-cache(1) ; version: sw.js 13d36729809f ; bundle /assets/index-BTpov1yW.js /assets/index-CZhYqiI3.css |
| 3 | assets servis par le service worker (cache-first) et cache API (network-first) | ✅ OK | 1.7 s |  |
| 4 | navigation hors ligne : l'application se recharge depuis le cache | ✅ OK | 1.9 s |  |
| 5 | schéma Dexie complet (base « alterra ») | ✅ OK | 1.0 s |  |
| 6 | écran de connexion PWA : aucun panneau de comptes de démonstration | ✅ OK | 1.1 s |  |

#### Connexion PWA, PIN, hors ligne, déconnexion

`sprint3-pwa-auth.spec.ts` — UC-FE-PWA-AUTH

| # | Test | Résultat | Durée | Notes |
|---:|---|---|---:|---|
| 1 | connexion, validations du PIN, session chiffrée en local | ✅ OK | 2.1 s |  |
| 2 | référentiel synchronisé dans Dexie (persistance après rechargement) | ✅ OK | 0.6 s | dexie: après synchro : {"workers":4,"activities":19,"pointages":0,"pointings_synced":0,"media":0,"syncQueue":0,"biometricTemplates":0,"presenceLog":0,"badges":0,"biometricOfflineChecks":0} |
| 3 | verrouillage : mauvais PIN refusé, bon PIN accepté | ✅ OK | 0.6 s |  |
| 4 | rafraîchissement de session : un 401 déclenche /auth/refresh puis rejoue la requête | ✅ OK | 25.3 s | inconclusif: Aucun GET API émis par l'écran chef d'équipe : le rejeu après 401 n'a pas pu être observé depuis l'UI. ; refresh: POST /auth/refresh direct → HTTP 200 |
| 5 | hors ligne : déverrouillage local puis retour en ligne | ✅ OK | 1.0 s |  |
| 6 | verdict : le rechargement hors ligne fonctionne (service worker) | ✅ OK | 0.0 s | hors ligne: {"reloadError":null,"controlled":true,"offlineWorkers":4,"before":4} |
| 7 | verrouillage automatique après 30 min d'inactivité | ✅ OK | 0.8 s |  |
| 8 | le chef d'équipe est renvoyé hors des écrans chef de service | ✅ OK | 0.8 s |  |
| 9 | déconnexion : session révoquée et données locales sensibles purgées | ✅ OK | 0.6 s | purge: Dexie après déconnexion : {"workers":0,"activities":0,"pointages":0,"pointings_synced":0,"media":0,"syncQueue":0,"biometricTemplates":0,"presenceLog":0,"badges":0,"biometricOfflineChecks":0} |
| 10 | le chef de service n'accède qu'aux données de son site (PWA) | ✅ OK | 8.4 s |  |
| 11 | « Se déconnecter » depuis l'écran verrouillé révoque la session serveur | ✅ OK | 0.4 s |  |
| 12 | 2 échecs de connexion : message générique, puis connexion normale et périmètre d'équipe | ✅ OK | 6.7 s | périmètre: Dexie : 3 MOC ; API (CDE) : 3 MOC ; jeu E2E : 3 |
| 13 | compte inactif : connexion PWA refusée, aucune session créée | ✅ OK | 2.0 s |  |
| 14 | l'API est jointe via la même origine que la PWA (aucune adresse d'API codée en dur) | ✅ OK | 3.2 s |  |

### 0.4 Anomalies : constat initial, correction, preuve du rejeu

| Anomalie | Correction | Test du rejeu qui la couvre |
|---|---|---|
| A1 — `GET /me` en 500 (chef de service, chef d'équipe) | Portée par site ou équipe : la clé unique reste au premier niveau du `where` (`mergeUniqueWhere`) | RBAC › la session du chef de service survit à un rechargement (F5) |
| A2 — rejeu de synchro en 500 | Même correction qu'A1 | Pointages › sync : création, idempotence |
| A3 — validation par le chef de service en 500 | Même correction qu'A1 | Pointages › validation refusée sans bio OK : CDS → 422 `BIO_NOT_OK` |
| A4 — création d'utilisateur en 500 | `password` retiré de l'appel Prisma ; doublon en 409 | Utilisateurs › création avec mot de passe saisi ; validations serveur |
| A5 — compte bloqué 15 min après réinitialisation | Invalidation des seuls jetons émis avant la réinitialisation | Utilisateurs › le compte fonctionne après réinitialisation |
| A6 — déconnexion sans révocation (écran verrouillé) | `POST /auth/logout` sans jeton d'accès | PWA-AUTH › « Se déconnecter » depuis l'écran verrouillé révoque la session |
| A7 — pas de purge locale | `purgeLocalData()` à la déconnexion | PWA-AUTH › données locales purgées à la déconnexion |
| A8 — numéro MVola invalide accepté | 034 ou 038 + 7 chiffres | MOC › validations serveur |
| A9 — pas d'état d'erreur ou vide | Composant d'erreur avec « Recharger » ; état vide de Sites | les 8 tests « état vide » / « état d'erreur » |
| A10 — export à 3 colonnes | 5 colonnes de la spécification (`MVOLA_EXPORT_FORMAT=compact3` pour revenir à 3) | zz-pay-format › en-tête à 5 colonnes |
| A11 — fichier non Excel accepté | Signature `.xlsx` / `.xls` vérifiée, 422 `IMPORT_BADFORMAT` | zz-pay-format › fichier non Excel refusé |
| A12 — import sans aperçu, sans échec ; « PDF » en HTML | Aperçu puis confirmation ; `PATCH /payments/:id/fail` ; rapprochement dans le bordereau ; historique des exports ; vrai PDF | Paiements › import du relevé ; Rapports › export CSV, Excel et PDF |
| A13 — nom « RAKOTO » | Aucune : réglage de l'application (Paramètres), pas un défaut | — (décision à prendre) |
| A14 — période sans année | Colonne `Payment.referenceYear` ; verrou, génération, export et liste tiennent compte de l'année | Paiements : la suite écrit en 2090 sans toucher aux semaines 2026 |
| A15 — N+1 sur Pointages | MOC inclus dans `GET /pointages` | Pointages › liste : 0 requête `GET /workers/:id` pour 50 lignes |

### 0.5 Tests adaptés pour le rejeu

Les tests ont été modifiés uniquement là où le comportement de l'application a changé volontairement :

- **Périodes de paie** : les lectures `GET /payments` passent `referenceYear` (2090 pour les données de test), puisque les périodes portent désormais une année.
- **Import du relevé MVola** : le test suit le parcours en deux temps (« Prévisualiser le rapprochement » puis « Confirmer et enregistrer »), vérifie que l'aperçu n'écrit rien, contrôle le statut de rapprochement et la référence dans le bordereau, puis le marquage en échec avec motif. L'ancien contrôle « compteur FAILED dans le résumé » est remplacé, l'import ne pouvant pas déduire un échec.
- **Écran Paiements** : le bordereau est ciblé explicitement (`table` première position), la page contenant aussi le tableau de l'historique des exports.
- **Liste des utilisateurs** : nouvel utilitaire `findRowLoadMore` (clics « Charger plus »), la liste dépassant 50 comptes.
- **Codes de catégorie** : un code n'est jamais réutilisable après désactivation ; `ACT90` à `ACT99` sont épuisés, la série `ACT80` à `ACT89` prend le relais.
- **Affichage « Payé »** : le test charge la période de test avant l'import, ce qui permet de vérifier l'affichage « Payé » du bordereau après import (point « non vérifié » de la recette initiale, désormais couvert et réussi).

### 0.6 Mesures relevées pendant le rejeu

| Mesure | Valeur |
|---|---|
| Requêtes `GET /workers/:id` sur l'écran Pointages | 0 pour 50 pointages affichés (12 pour 30 avant correction) |
| Volumétrie de l'écran MOC | 316 MOC lus, rendu initial 1 483 ms, chargement complet (6 clics) 5 738 ms, recherche 171 ms. Le critère « 600+ lignes » reste non éprouvé sur le réel |
| MOC réels dans l'API | 313 actifs ; l'écart avec 316 (rejeu) et 319 (recette initiale) correspond aux MOC de test actifs au moment de la mesure (explication probable, non vérifiée ligne à ligne) |
| Fichier non Excel envoyé à `/payments/import-status/columns` | HTTP 422 (200 avant correction) |

### 0.7 Données après le rejeu

- **Paiements** : les 15 paiements de test de la recette initiale ont été supprimés avant le rejeu, puis ceux du rejeu (année 2090) après. Les lignes supprimées sont sauvegardées en JSON hors dépôt. Il reste les **4 paiements réels de S37/2026**, intacts ; les semaines S47 à S51 sont libres. Grâce à l'année portée par chaque paiement, la purge annoncée en §7 n'est plus une condition pour la semaine 47.
- **Pointages de test de 2090** : rejetés (les pointages validés de 2090 d'une passe alimentaient la génération de la passe suivante).
- **Autres données de test** : sites, utilisateurs, sous-activités, catégories, équipes désactivés ; MOC supprimés (logique) ; entrées d'audit conservées.
- **Effets de bord** : chaque connexion réussie met à jour `lastLoginAt` et crée un jeton de rafraîchissement.

### 0.8 Réserves et limites

- **Format d'export MVola** : 5 colonnes par défaut, à confirmer avec Etech ; `MVOLA_EXPORT_FORMAT=compact3` rétablit les 3 colonnes sans changer le code.
- **A13** : décider si le nom affiché reste « RAKOTO » ou revient à ALTERRA.
- **PWA** : les saisies non envoyées sont conservées à la déconnexion (pour ne rien perdre) ; elles restent visibles du chef d'équipe suivant sur un téléphone partagé.
- **Non couvert par le rejeu** : rapport PDF hebdomadaire (envoi d'e-mail), sauvegarde et restauration de la base, appareils réels, NFC, biométrie, critère « 600+ MOC », rejeu après 401 depuis l'interface PWA.
- **Import Excel des MOC** : met toujours à jour, sans blocage, un MOC dont le numéro MVola existe déjà (comportement inchangé).

---

## Recette initiale (avant correction)

Sections 1 à 9 : état de la démonstration constaté le 20 septembre 2026 avant toute correction. Elles ne décrivent plus l'état actuel ; voir la section 0.


## 1. Contexte et campagne (recette initiale)

| Élément | Valeur |
|---|---|
| Admin | https://alterra-admin.boss-etech.net |
| PWA | https://alterra-pwa.boss-etech.net |
| Code de référence | branche `develop`, HEAD `34087e7` (20/09/2026 08:04 UTC) |
| Version déployée | non identifiable ; bundles Admin `index-BlFv9qJE.js` / `index-7LPp1ijo.css`, PWA `index-BXhw9Xfp.js` / `index-CZhYqiI3.css` ; `sw.js` Admin `06c1951e9980`, PWA `bd613e8a442c` |
| Navigateur | Google Chrome installé (canal `chrome`), Playwright 1.61.1, 1 worker, 0 retry |
| Config | `e2e/playwright.remote.config.ts` — projets `setup`, `admin` (bureau), `pwa` (émulation Pixel 7), `cleanup` (teardown) |
| Specs | `e2e/tests/remote/sprint3-*.spec.ts` et `support/` |
| MFA | aucun écran MFA rencontré |

### Runs exécutés

Un run complet de référence, puis trois runs complémentaires limités aux specs que des erreurs de conception de mes propres tests avaient bloquées (condition de course sur un tableau paginé, chaîne interrompue par un constat, prémisse erronée sur `/me`). Les résultats du §3 sont, pour chaque test, ceux de la **dernière exécution** où il a tourné.

| Run | Périmètre | OK | KO | Non exécutés | Total |
|---|---|---:|---:|---:|---:|
| run1 | complet de référence (setup → admin → PWA → nettoyage) | 56 | 26 | 12 | 94 |
| run2-admin | complémentaire, projet admin (pay, sites, users, rbac, reports) | 30 | 12 | 1 | 43 |
| run2-pwa | complémentaire, projet PWA | 17 | 2 | 1 | 20 |
| run3 | complémentaire (pay, reports, users, audit-trail) | 17 | 9 | 0 | 26 |
| run4-admin | complémentaire, chaîne paiements | 7 | 1 | 0 | 8 |
| run4-pwa | complémentaire, PWA scénario chef d'équipe | 8 | 1 | 0 | 9 |

Des runs exploratoires antérieurs au run 1 (mise au point des specs, arrêtés ou partiels) ont aussi eu lieu ; leurs données ont été nettoyées et leurs résultats ne sont pas consolidés ici.

## 2. Synthèse chiffrée

Après consolidation (dernier résultat par test, hors projets `setup` et `cleanup`) : **95 tests — 74 OK, 21 KO, 0 non exécuté.**

| Spec | UC | OK | KO | Non exécuté |
|---|---|---:|---:|---:|
| `sprint3-sites.spec.ts` | UC-FE-ADM-SITES | 5 | 2 | 0 |
| `sprint3-activities.spec.ts` | UC-FE-ADM-ACT | 6 | 1 | 0 |
| `sprint3-workers.spec.ts` | UC-FE-ADM-WORKERS | 9 | 2 | 0 |
| `sprint3-users.spec.ts` | UC-FE-ADM-USERS | 5 | 4 | 0 |
| `sprint3-pointages.spec.ts` | UC-FE-ADM-PNT | 4 | 3 | 0 |
| `sprint3-pay.spec.ts` | UC-FE-ADM-PAY-BORD / PAY-EXP / PAY-IMP | 7 | 1 | 0 |
| `sprint3-zz-pay-format.spec.ts` | UC-FE-ADM-PAY-EXP / PAY-IMP | 0 | 2 | 0 |
| `sprint3-reports.spec.ts` | UC-FE-ADM-REP | 4 | 2 | 0 |
| `sprint3-audit.spec.ts` | UC-FE-ADM-AUDIT | 3 | 1 | 0 |
| `sprint3-zz-audit-trail.spec.ts` | Transverse | 1 | 0 | 0 |
| `sprint3-rbac.spec.ts` | Transverse (RBAC) | 12 | 1 | 0 |
| `sprint3-pwa-setup.spec.ts` | UC-FE-PWA-SETUP | 6 | 0 | 0 |
| `sprint3-pwa-auth.spec.ts` | UC-FE-PWA-AUTH | 12 | 2 | 0 |

Parmi les 21 KO, **8** sont des écrans sans message d'état vide ou d'erreur (mineurs) ; les autres correspondent aux anomalies A1 à A15 du rapport.

Tests d'infrastructure (hors décompte) :

| Test | Résultat | Durée |
|---|---|---:|
| Sprint 3 — nettoyage des données E2E-S3- | ✅ OK | 23.7 s |
| Sprint 3 — version déployée (lecture seule) | ✅ OK | 4.5 s |
| Sprint 3 — provisionnement du jeu de test E2E-S3- | ✅ OK | 10.9 s |

## 3. Résultat détaillé par spec

Légende : ✅ conforme · ❌ écart constaté (voir §4) · ⏭️ non exécuté. La colonne *Run* indique la dernière exécution. La colonne *Notes* reprend les annotations émises par le test (mesures, constats).

### Sites

`sprint3-sites.spec.ts` — UC-FE-ADM-SITES

| # | Test | Résultat | Durée | Run | Notes |
|---:|---|---|---:|---|---|
| 1 | liste paginée, cohérente avec la réponse API (lecture seule) | ✅ OK | 9.1 s | run2-admin |  |
| 2 | création via le formulaire (écriture E2E-S3-) | ✅ OK | 9.0 s | run2-admin |  |
| 3 | validations du formulaire (UI + API) | ✅ OK | 5.2 s | run2-admin |  |
| 4 | édition : le code est immuable, la localisation modifiable | ✅ OK | 5.0 s | run2-admin |  |
| 5 | désactivation | ✅ OK | 5.2 s | run2-admin |  |
| 6 | état vide : message explicite attendu | ❌ KO | 19.2 s | run2-admin |  |
| 7 | état d'erreur : message explicite attendu | ❌ KO | 26.8 s | run2-admin |  |

### Activités et tarif versionné RG-04

`sprint3-activities.spec.ts` — UC-FE-ADM-ACT

| # | Test | Résultat | Durée | Run | Notes |
|---:|---|---|---:|---|---|
| 1 | liste des catégories, recherche et dépliage (lecture seule) | ✅ OK | 9.9 s | run1 |  |
| 2 | création d'une catégorie via le formulaire + validations | ✅ OK | 8.4 s | run1 |  |
| 3 | changement de tarif : version fermée + nouvelle version (RG-04), historique visible | ✅ OK | 10.7 s | run1 |  |
| 4 | validations du tarif | ✅ OK | 1.3 s | run1 |  |
| 5 | désactivation de la sous-activité et de la catégorie | ✅ OK | 1.8 s | run1 |  |
| 6 | état vide | ✅ OK | 3.2 s | run1 |  |
| 7 | état d'erreur : message explicite attendu | ❌ KO | 18.8 s | run1 |  |

### MOC, volumétrie et import Excel

`sprint3-workers.spec.ts` — UC-FE-ADM-WORKERS

| # | Test | Résultat | Durée | Run | Notes |
|---:|---|---|---:|---|---|
| 1 | volumétrie du référentiel réel : rendu, chargement par curseur, recherche (lecture seule) | ✅ OK | 21.0 s | run1 | volumétrie: 319 MOC réels ; rendu initial 2479 ms ; chargement complet (6 clics) 7512 ms ; recherche d'un nom réel (12 caractères, masqué) → 7 ligne(s) en 979 ms ; critère 600+: volume réel 319 < 600 MOC : critère « 600+ lignes » non éprouvé sur le réel (extrapolation seulement) |
| 2 | filtres site et statut (jeu E2E) | ✅ OK | 7.2 s | run1 |  |
| 3 | état d'erreur : message explicite attendu | ❌ KO | 20.5 s | run1 |  |
| 4 | création via le formulaire | ✅ OK | 13.9 s | run1 |  |
| 5 | validations serveur : doublons et formats | ❌ KO | 2.5 s | run1 |  |
| 6 | édition (fiche) puis suppression avec confirmation | ✅ OK | 17.2 s | run1 |  |
| 7 | import : fichier valide (aperçu puis import réel, données E2E) | ✅ OK | 8.4 s | run1 |  |
| 8 | import : fichier mal formé et mauvaise extension | ✅ OK | 7.4 s | run1 |  |
| 9 | import : colonne obligatoire absente | ✅ OK | 5.1 s | run1 |  |
| 10 | import : doublons dans le fichier, lignes en erreur, doublon en base (aperçu seulement) | ✅ OK | 2.8 s | run1 |  |
| 11 | import : un numéro MVola déjà en base met à jour le MOC existant (upsert silencieux) | ✅ OK | 1.0 s | run1 | constat: L'import met à jour sans avertissement bloquant le MOC dont le n° MVola existe déjà (mention « à mettre à jour » dans l'aperçu uniquement). |

### Utilisateurs

`sprint3-users.spec.ts` — UC-FE-ADM-USERS

| # | Test | Résultat | Durée | Run | Notes |
|---:|---|---|---:|---|---|
| 1 | liste et filtre par rôle, cohérents avec l'API (lecture seule) | ✅ OK | 11.8 s | run3 |  |
| 2 | état d'erreur : message explicite attendu | ❌ KO | 19.7 s | run3 |  |
| 3 | création via le formulaire avec mot de passe temporaire généré | ✅ OK | 13.7 s | run3 |  |
| 4 | création avec un mot de passe saisi (champ « optionnel » du formulaire) | ❌ KO | 4.9 s | run3 |  |
| 5 | validations serveur : e-mail invalide, mot de passe court, e-mail en doublon | ❌ KO | 4.3 s | run3 |  |
| 6 | édition via le formulaire | ✅ OK | 11.2 s | run3 |  |
| 7 | réinitialisation du mot de passe | ✅ OK | 6.5 s | run3 |  |
| 8 | désactivation : compte inactif refusé, sessions existantes révoquées | ✅ OK | 16.7 s | run3 |  |
| 9 | mot de passe réinitialisé : le compte reste bloqué 15 min (jetons neufs refusés) | ❌ KO | 2.8 s | run3 |  |

### Pointages

`sprint3-pointages.spec.ts` — UC-FE-ADM-PNT

| # | Test | Résultat | Durée | Run | Notes |
|---:|---|---|---:|---|---|
| 1 | liste, requêtes réseau et filtres cohérents avec l'API | ✅ OK | 18.8 s | run1 | performance: 30 pointages affichés → 12 requêtes GET /workers/:id (une par MOC distinct, N+1) |
| 2 | état d'erreur : message explicite attendu | ❌ KO | 21.4 s | run1 |  |
| 3 | sync des pointages : création, idempotence, validations | ❌ KO | 7.5 s | run1 |  |
| 4 | détail puis correction avec motif obligatoire, tracée dans l'audit | ✅ OK | 20.3 s | run1 |  |
| 5 | validation refusée sans bio OK, rejet avec motif obligatoire | ❌ KO | 11.4 s | run1 | diagnostic: validate sans bio : admin → HTTP 422 BIO_NOT_OK ; CDS → HTTP 500 INTERNAL_ERROR |
| 6 | isolation : CDE et CDS E2E ne voient que leurs pointages | ✅ OK | 4.8 s | run1 |  |
| 7 | état vide : message explicite | ✅ OK | 14.5 s | run1 |  |

### Bordereau, export et import MVola

`sprint3-pay.spec.ts` — UC-FE-ADM-PAY-BORD / PAY-EXP / PAY-IMP

| # | Test | Résultat | Durée | Run | Notes |
|---:|---|---|---:|---|---|
| 1 | préparation : pointages validés (bio OK) et garde-fou de période | ✅ OK | 11.5 s | run4-admin | biométrie: contrôle bio obtenu via : offline ; constat: validation CDS → HTTP 500, repli sur validation admin ; constat: validation CDS → HTTP 500, repli sur validation admin ; constat: validation CDS → HTTP 500, repli sur validation admin |
| 2 | état vide, génération du bordereau, statut bio, régénération | ✅ OK | 14.1 s | run4-admin | constat: Régénération : identifiants de lignes tous remplacés (suppression + recréation des lignes PENDING). |
| 3 | correction inline du montant avec motif obligatoire | ✅ OK | 7.3 s | run4-admin |  |
| 4 | export MVola : téléchargement, en-têtes, contenu vérifié colonne par colonne | ✅ OK | 5.6 s | run4-admin |  |
| 5 | règles après export : nouvel export, régénération et correction refusés | ✅ OK | 1.7 s | run4-admin |  |
| 6 | import : relevé sans rapprochement possible => paiements « non confirmés » | ✅ OK | 0.6 s | run4-admin |  |
| 7 | import : fichier mal formé ou colonnes manquantes | ✅ OK | 4.0 s | run4-admin | constat: fichier non Excel envoyé à /payments/import-status/columns → HTTP 200 |
| 8 | import du relevé : confirmé, écart de montant, orphelin, frais, ignoré, interne | ❌ KO | 22.4 s | run4-admin |  |

### Conformité du fichier exporté et rejet d'un fichier non Excel

`sprint3-zz-pay-format.spec.ts` — UC-FE-ADM-PAY-EXP / PAY-IMP

| # | Test | Résultat | Durée | Run | Notes |
|---:|---|---|---:|---|---|
| 1 | l'en-tête du fichier exporté respecte la spécification MVola (5 colonnes) | ❌ KO | 0.0 s | run3 |  |
| 2 | un fichier qui n'est pas un classeur Excel est refusé à la lecture des colonnes | ❌ KO | 0.0 s | run3 |  |

### Rapports

`sprint3-reports.spec.ts` — UC-FE-ADM-REP

| # | Test | Résultat | Durée | Run | Notes |
|---:|---|---|---:|---|---|
| 1 | aperçu « Pointages mensuels » cohérent avec l'API | ✅ OK | 9.4 s | run3 |  |
| 2 | aperçu « Paiements mensuels » cohérent avec l'API | ✅ OK | 3.5 s | run3 |  |
| 3 | aperçu « Présence par site » cohérent avec l'API | ✅ OK | 3.5 s | run3 |  |
| 4 | période sans donnée : état vide ; filtre site | ✅ OK | 4.4 s | run3 |  |
| 5 | état d'erreur : message explicite attendu | ❌ KO | 19.4 s | run3 |  |
| 6 | export CSV, Excel et « PDF » du rapport Pointages | ❌ KO | 12.4 s | run3 |  |

### Journal d'audit

`sprint3-audit.spec.ts` — UC-FE-ADM-AUDIT

| # | Test | Résultat | Durée | Run | Notes |
|---:|---|---|---:|---|---|
| 1 | table paginée cohérente avec l'API, navigation Précédent/Suivant | ✅ OK | 10.5 s | run1 |  |
| 2 | filtres action, entité, période ; état vide ; réinitialisation | ✅ OK | 6.2 s | run1 |  |
| 3 | le journal est en lecture seule (aucune route de modification) | ✅ OK | 2.1 s | run1 |  |
| 4 | état d'erreur : message explicite attendu | ❌ KO | 20.9 s | run1 |  |

### Traçabilité de toutes les mutations de test

`sprint3-zz-audit-trail.spec.ts` — Transverse

| # | Test | Résultat | Durée | Run | Notes |
|---:|---|---|---:|---|---|
| 1 | Transverse › toutes les entités créées par la recette sont tracées dans l'audit (API = source de l'écran Audit) | ✅ OK | 10.7 s | run3 | audit: site: 5/5 tracés ; category: 4/4 tracés ; subActivity: 5/5 tracés ; user: 17/17 tracés ; team: 3/3 tracés ; worker: 13/13 tracés ; pointage: 15/15 tracés ; payment: 18/18 tracés |

### RBAC, isolation par site, comptes inactifs

`sprint3-rbac.spec.ts` — Transverse (RBAC)

| # | Test | Résultat | Durée | Run | Notes |
|---:|---|---|---:|---|---|
| 1 | administrateur : accès à tous les écrans | ✅ OK | 97.8 s | run2-admin |  |
| 2 | chef de service (AMB) : uniquement Tableau de bord et Pointages | ✅ OK | 72.0 s | run2-admin |  |
| 3 | chef d'équipe : refusé sur tout l'Admin | ✅ OK | 24.9 s | run2-admin |  |
| 4 | écran de connexion Admin : aucun panneau de comptes de démonstration | ✅ OK | 12.9 s | run2-admin |  |
| 5 | sans jeton ou avec un jeton falsifié : 401 | ✅ OK | 6.7 s | run2-admin |  |
| 6 | chef de service : 403 sur les routes Admin, lectures limitées à son site | ✅ OK | 8.9 s | run2-admin |  |
| 7 | chef d'équipe : 403 sur les routes Admin et de validation | ✅ OK | 6.7 s | run2-admin |  |
| 8 | isolation entre sites : AMB et ANJ ne partagent aucune donnée | ✅ OK | 3.6 s | run2-admin |  |
| 9 | isolation UI : l'écran Pointages du chef de service n'affiche que son site | ✅ OK | 14.3 s | run2-admin |  |
| 10 | compte inactif : connexion refusée (API + écran de connexion) | ✅ OK | 15.6 s | run2-admin |  |
| 11 | compte de démonstration inactif réel : 1 seule tentative | ✅ OK | 2.4 s | run2-admin |  |
| 12 | mauvais mot de passe : message générique, puis connexion normale | ✅ OK | 12.4 s | run2-admin |  |
| 13 | chef de service : la session Admin survit à un rechargement de page (F5) | ❌ KO | 18.0 s | run2-admin |  |

### Manifest, service worker, précache, Dexie

`sprint3-pwa-setup.spec.ts` — UC-FE-PWA-SETUP

| # | Test | Résultat | Durée | Run | Notes |
|---:|---|---|---:|---|---|
| 1 | manifest servi, lié à la page et installable (contrôle CDP « installabilityErrors ») | ✅ OK | 4.1 s | run2-pwa | manifest: display=standalone start_url=/ icônes=192x192:image/png,512x512:image/png ; installabilité: in-incognito |
| 2 | service worker enregistré, actif ; précache Workbox complet | ✅ OK | 8.6 s | run2-pwa | précache: 8 entrées ; caches : workbox-precache-v2-https://alterra-pwa.boss-etech.net/(8), api-cache(1) ; version: sw.js bd613e8a442c ; bundle /assets/index-BXhw9Xfp.js /assets/index-CZhYqiI3.css |
| 3 | assets servis par le service worker (cache-first) et cache API (network-first) | ✅ OK | 8.0 s | run2-pwa |  |
| 4 | navigation hors ligne : l'application se recharge depuis le cache | ✅ OK | 8.6 s | run2-pwa |  |
| 5 | schéma Dexie complet (base « alterra ») | ✅ OK | 2.5 s | run2-pwa |  |
| 6 | écran de connexion PWA : aucun panneau de comptes de démonstration | ✅ OK | 2.7 s | run2-pwa |  |

### Connexion PWA, PIN, hors ligne, déconnexion

`sprint3-pwa-auth.spec.ts` — UC-FE-PWA-AUTH

| # | Test | Résultat | Durée | Run | Notes |
|---:|---|---|---:|---|---|
| 1 | connexion, validations du PIN, session chiffrée en local | ✅ OK | 5.9 s | run4-pwa |  |
| 2 | référentiel synchronisé dans Dexie (persistance après rechargement) | ✅ OK | 2.9 s | run4-pwa | dexie: après synchro : {"workers":4,"activities":19,"pointages":0,"pointings_synced":0,"media":0,"syncQueue":0,"biometricTemplates":0,"presenceLog":0,"badges":0,"biometricOfflineChecks":0} |
| 3 | verrouillage : mauvais PIN refusé, bon PIN accepté | ✅ OK | 1.2 s | run4-pwa |  |
| 4 | rafraîchissement de session : un 401 déclenche /auth/refresh puis rejoue la requête | ✅ OK | 26.9 s | run4-pwa | inconclusif: Aucun GET API émis par l'écran chef d'équipe : le rejeu après 401 n'a pas pu être observé depuis l'UI. ; refresh: POST /auth/refresh direct → HTTP 200 |
| 5 | hors ligne : déverrouillage local puis retour en ligne | ✅ OK | 1.0 s | run4-pwa |  |
| 6 | verrouillage automatique après 30 min d'inactivité | ✅ OK | 0.6 s | run4-pwa |  |
| 7 | le chef d'équipe est renvoyé hors des écrans chef de service | ✅ OK | 0.9 s | run4-pwa |  |
| 8 | déconnexion : session révoquée et données locales sensibles purgées | ❌ KO | 2.2 s | run4-pwa | purge: Dexie après déconnexion : {"workers":4,"activities":19,"pointages":0,"pointings_synced":0,"media":0,"syncQueue":0,"biometricTemplates":0,"presenceLog":0,"badges":0,"biometricOfflineChecks":0} |
| 9 | verdict : le rechargement hors ligne fonctionne (service worker) | ✅ OK | 0.0 s | run4-pwa | hors ligne: {"reloadError":null,"controlled":true,"offlineWorkers":4,"before":4} |
| 10 | le chef de service n'accède qu'aux données de son site (PWA) | ✅ OK | 13.5 s | run2-pwa |  |
| 11 | « Se déconnecter » depuis l'écran verrouillé révoque la session serveur | ❌ KO | 3.4 s | run2-pwa |  |
| 12 | 2 échecs de connexion : message générique, puis connexion normale et périmètre d'équipe | ✅ OK | 14.4 s | run2-pwa | périmètre: Dexie : 3 MOC ; API (CDE) : 3 MOC ; jeu E2E : 3 |
| 13 | compte inactif : connexion PWA refusée, aucune session créée | ✅ OK | 5.5 s | run2-pwa |  |
| 14 | l'API est jointe via la même origine que la PWA (aucune adresse d'API codée en dur) | ✅ OK | 5.3 s | run2-pwa |  |

## 4. Échecs : messages complets

Message d'erreur (12 premières lignes utiles) de chaque test KO, tel que rapporté par Playwright. Les identifiants sont ceux des données `E2E-S3-`.

### Sites

**état vide : message explicite attendu** — run2-admin, 19.2 s

```text
Error: Aucun message d'état vide sur l'écran Sites
expect(locator).toBeVisible() failed
Locator: getByText(/aucun site/i)
Expected: visible
Timeout: 15000ms
Error: element(s) not found
Call log:
  - Aucun message d'état vide sur l'écran Sites with timeout 15000ms
  - waiting for getByText(/aucun site/i)
  142 |     await page.goto("/sites");
  143 |     await expect(heading(page, "Sites")).toBeVisible();
> 144 |     await expect.soft(page.getByText(/aucun site/i), "Aucun message d'état vide sur l'écran Sites").toBeVisible();
```

**état d'erreur : message explicite attendu** — run2-admin, 26.8 s

```text
Error: Aucun message d'erreur sur l'écran Sites si l'API échoue
expect(locator).toBeVisible() failed
Locator: getByText(/erreur|échec|impossible|réessayer/i)
Expected: visible
Timeout: 15000ms
Error: element(s) not found
Call log:
  - Aucun message d'erreur sur l'écran Sites si l'API échoue with timeout 15000ms
  - waiting for getByText(/erreur|échec|impossible|réessayer/i)
  154 |     await expect
  155 |       .soft(page.getByText(/erreur|échec|impossible|réessayer/i), "Aucun message d'erreur sur l'écran Sites si l'API échoue")
> 156 |       .toBeVisible();
```

### Activités et tarif versionné RG-04

**état d'erreur : message explicite attendu** — run1, 18.8 s

```text
Error: Aucun message d'erreur sur l'écran Activités si l'API échoue (l'écran affiche « Aucune catégorie. »)
expect(locator).toBeVisible() failed
Locator: getByText(/erreur|échec|impossible|réessayer/i)
Expected: visible
Timeout: 15000ms
Error: element(s) not found
Call log:
  - Aucun message d'erreur sur l'écran Activités si l'API échoue (l'écran affiche « Aucune catégorie. ») with timeout 15000ms
  - waiting for getByText(/erreur|échec|impossible|réessayer/i)
  235 |         "Aucun message d'erreur sur l'écran Activités si l'API échoue (l'écran affiche « Aucune catégorie. »)",
  236 |       )
> 237 |       .toBeVisible();
```

### MOC, volumétrie et import Excel

**état d'erreur : message explicite attendu** — run1, 20.5 s

```text
Error: Aucun message d'erreur sur l'écran Travailleurs si l'API échoue
expect(locator).toBeVisible() failed
Locator: getByText(/erreur|échec|impossible|réessayer/i)
Expected: visible
Timeout: 15000ms
Error: element(s) not found
Call log:
  - Aucun message d'erreur sur l'écran Travailleurs si l'API échoue with timeout 15000ms
  - waiting for getByText(/erreur|échec|impossible|réessayer/i)
  135 |     await expect
  136 |       .soft(page.getByText(/erreur|échec|impossible|réessayer/i), "Aucun message d'erreur sur l'écran Travailleurs si l'API échoue")
> 137 |       .toBeVisible();
```

**validations serveur : doublons et formats** — run1, 2.5 s

```text
Error: numéro MVola au format invalide (préfixe ≠ 034/038) accepté à la création : l'export MVola échouera plus tard
expect(received).toBeGreaterThanOrEqual(expected)
Expected: >= 400
Received:    201
  197 |     expect
  198 |       .soft(badFormat.status, "numéro MVola au format invalide (préfixe ≠ 034/038) accepté à la création : l'export MVola échouera plus tard")
> 199 |       .toBeGreaterThanOrEqual(400);
      |        ^
  200 |   });
  201 |
  202 |   test(`${UC} › édition (fiche) puis suppression avec confirmation`, async ({ openAdmin, admin }) => {
    at D:\ALTERRA\e2e\tests\remote\sprint3-workers.spec.ts:199:8
```

### Utilisateurs

**état d'erreur : message explicite attendu** — run3, 19.7 s

```text
Error: Aucun message d'erreur sur l'écran Utilisateurs si l'API échoue
expect(locator).toBeVisible() failed
Locator: getByText(/erreur|échec|impossible|réessayer/i)
Expected: visible
Timeout: 15000ms
Error: element(s) not found
Call log:
  - Aucun message d'erreur sur l'écran Utilisateurs si l'API échoue with timeout 15000ms
  - waiting for getByText(/erreur|échec|impossible|réessayer/i)
  38 |     await expect
  39 |       .soft(page.getByText(/erreur|échec|impossible|réessayer/i), "Aucun message d'erreur sur l'écran Utilisateurs si l'API échoue")
> 40 |       .toBeVisible();
```

**création avec un mot de passe saisi (champ « optionnel » du formulaire)** — run3, 4.9 s

```text
Error: création avec mot de passe explicite : HTTP 500 attendu 201 (le champ « Mot de passe (optionnel) » du formulaire est inutilisable)
expect(received).toBe(expected) // Object.is equality
Expected: 201
Received: 500
  109 |     const status = resp.status();
  110 |     if (status === 201) track("user", (await resp.json()).user.id, email);
> 111 |     expect(status, "création avec mot de passe explicite : HTTP 500 attendu 201 (le champ « Mot de passe (optionnel) » du formulaire est inutilisable)").toBe(201);
      |                                                                                                                                                          ^
  112 |   });
  113 |
  114 |   test(`${UC} › validations serveur : e-mail invalide, mot de passe court, e-mail en doublon`, async ({ admin, world }) => {
    at D:\ALTERRA\e2e\tests\remote\sprint3-users.spec.ts:111:154
```

**validations serveur : e-mail invalide, mot de passe court, e-mail en doublon** — run3, 4.3 s

```text
Error: e-mail en doublon : HTTP 500 (409 attendu)
expect(received).toBe(expected) // Object.is equality
Expected: 409
Received: 500
  120 |     expect(dup.status, "e-mail en doublon accepté").toBeGreaterThanOrEqual(400);
  121 |     if (dup.status === 201) track("user", dup.body.user.id, "dup-email");
> 122 |     expect.soft(dup.status, `e-mail en doublon : HTTP ${dup.status} (409 attendu)`).toBe(409);
      |                                                                                     ^
  123 |     expectStatus(await admin.post("/users", { role: "CHEF_EQUIPE", firstName: "X", lastName: "Y" }), 201, 400, 422); // sans e-mail ni téléphone
  124 |   });
  125 |
    at D:\ALTERRA\e2e\tests\remote\sprint3-users.spec.ts:122:85
```

**mot de passe réinitialisé : le compte reste bloqué 15 min (jetons neufs refusés)** — run3, 2.8 s

```text
Error: après réinitialisation, le nouveau jeton est refusé (HTTP 401 USER_BLOCKED) : compte inutilisable pendant 15 min
expect(received).toBe(expected) // Object.is equality
Expected: 200
Received: 401
  177 |     const probe = await fresh.probe("GET", "/sites");
  178 |     // … mais le compte est bloqué (USER_BLOCKED) pendant 15 min : le nouveau jeton est refusé
> 179 |     expect(probe.status, `après réinitialisation, le nouveau jeton est refusé (HTTP ${probe.status} ${probe.body?.code ?? ""}) : compte inutilisable pendant 15 min`).toBe(200);
      |                                                                                                                                                                       ^
  180 |     await fresh.dispose();
  181 |   });
  182 |
    at D:\ALTERRA\e2e\tests\remote\sprint3-users.spec.ts:179:167
```

### Pointages

**état d'erreur : message explicite attendu** — run1, 21.4 s

```text
Error: Aucun message d'erreur sur l'écran Pointages si l'API échoue
expect(locator).toBeVisible() failed
Locator: getByText(/erreur|échec|impossible|réessayer/i)
Expected: visible
Timeout: 15000ms
Error: element(s) not found
Call log:
  - Aucun message d'erreur sur l'écran Pointages si l'API échoue with timeout 15000ms
  - waiting for getByText(/erreur|échec|impossible|réessayer/i)
  53 |     await expect
  54 |       .soft(page.getByText(/erreur|échec|impossible|réessayer/i), "Aucun message d'erreur sur l'écran Pointages si l'API échoue")
> 55 |       .toBeVisible();
```

**sync des pointages : création, idempotence, validations** — run1, 7.5 s

```text
Error: rejeu du même clientUuid : HTTP 500 {"code":"INTERNAL_ERROR","message":"Unexpected server error","traceId":1769} (200 + already_exists attendu — idempotence)
expect(received).toBe(expected) // Object.is equality
Expected: 200
Received: 500
  78 |         `rejeu du même clientUuid : HTTP ${replay.status} ${JSON.stringify(replay.body)?.slice(0, 160)} (200 + already_exists attendu — idempotence)`,
  79 |       )
> 80 |       .toBe(200);
     |        ^
  81 |     if (replay.status === 200) {
  82 |       expect(replay.body.results[0].status).toBe("already_exists");
  83 |       expect(replay.body.results[0].id).toBe(first.body.results[0].id);
    at D:\ALTERRA\e2e\tests\remote\sprint3-pointages.spec.ts:80:8
```

**validation refusée sans bio OK, rejet avec motif obligatoire** — run1, 11.4 s

```text
Error: validation CDS sans bio (HTTP 500 = erreur serveur au lieu de BIO_NOT_OK)
expect(received).toBe(expected) // Object.is equality
Expected: 422
Received: 500
  160 |     test.info().annotations.push({ type: "diagnostic", description: `validate sans bio : admin → HTTP ${asAdmin.status} ${asAdmin.body?.code ?? ""} ; CDS → HTTP ${denied.status} ${denied.body?.code ?? ""}` });
  161 |     expect(asAdmin.status, "validation admin sans bio").toBe(422);
> 162 |     expect.soft(denied.status, "validation CDS sans bio (HTTP 500 = erreur serveur au lieu de BIO_NOT_OK)").toBe(422);
      |                                                                                                             ^
  163 |     expect.soft(denied.body.code).toBe("BIO_NOT_OK");
  164 |
  165 |     // Rejet : motif obligatoire côté serveur
    at D:\ALTERRA\e2e\tests\remote\sprint3-pointages.spec.ts:162:109
```
```text
Error: expect(received).toBe(expected) // Object.is equality
Expected: "BIO_NOT_OK"
Received: "INTERNAL_ERROR"
  161 |     expect(asAdmin.status, "validation admin sans bio").toBe(422);
  162 |     expect.soft(denied.status, "validation CDS sans bio (HTTP 500 = erreur serveur au lieu de BIO_NOT_OK)").toBe(422);
> 163 |     expect.soft(denied.body.code).toBe("BIO_NOT_OK");
      |                                   ^
  164 |
  165 |     // Rejet : motif obligatoire côté serveur
  166 |     expectStatus(await cds.patch(`/pointages/${rejectId}/reject`, {}), 400, 422);
    at D:\ALTERRA\e2e\tests\remote\sprint3-pointages.spec.ts:163:35
```

### Bordereau, export et import MVola

**import du relevé : confirmé, écart de montant, orphelin, frais, ignoré, interne** — run4-admin, 22.4 s

```text
Error: Le résumé d'import ne présente pas de compteur PAID/FAILED (confirmés / écarts / orphelins / non confirmés)
expect(locator).toBeVisible() failed
Locator: getByRole('dialog').getByText(/échec|failed/i)
Expected: visible
Timeout: 2000ms
Error: element(s) not found
Call log:
  - Le résumé d'import ne présente pas de compteur PAID/FAILED (confirmés / écarts / orphelins / non confirmés) with timeout 2000ms
  - waiting for getByRole('dialog').getByText(/échec|failed/i)
  369 |     await expect
  370 |       .soft(dialog.getByText(/échec|failed/i), "Le résumé d'import ne présente pas de compteur PAID/FAILED (confirmés / écarts / orphelins / non confirmés)")
> 371 |       .toBeVisible({ timeout: 2_000 });
```
```text
Error: expect(locator).toContainText(expected) failed
Locator: locator('tbody tr').filter({ hasText: '0389104991' })
Expected substring: "Payé"
Timeout: 15000ms
Error: element(s) not found
Call log:
  - Expect "toContainText" with timeout 15000ms
  - waiting for locator('tbody tr').filter({ hasText: '0389104991' })
  379 |     expect(a1.paidAt).toBeTruthy();
  380 |     expect(a2.status, "l'écart de montant laisse le paiement EXPORTED").toBe("EXPORTED");
> 381 |     await expect(page.locator("tbody tr").filter({ hasText: world.workers[0].mvolaNumber })).toContainText("Payé");
      |                                                                                              ^
```

### Conformité du fichier exporté et rejet d'un fichier non Excel

**l'en-tête du fichier exporté respecte la spécification MVola (5 colonnes)** — run3, 0.0 s

```text
Error: En-tête exporté ["Numéro téléphone","Description","Montant"] (3 colonnes) ≠ spécification (Numéro téléphone, Description, Période, Montant, Bio Validée)
expect(received).toEqual(expected) // deep equality
- Expected  - 2
+ Received  + 0
  Array [
    "Numéro téléphone",
    "Description",
-   "Période",
    "Montant",
-   "Bio Validée",
  ]
  19 |     st.header,
```

**un fichier qui n'est pas un classeur Excel est refusé à la lecture des colonnes** — run3, 0.0 s

```text
Error: fichier texte accepté par /payments/import-status/columns (HTTP 200) : lu comme CSV au lieu d'être rejeté
expect(received).toBeGreaterThanOrEqual(expected)
Expected: >= 400
Received:    200
  10 |   const st = stLoad<{ status?: number }>("pay-import-garbage");
  11 |   test.skip(st.status === undefined, "test d'import non exécuté");
> 12 |   expect(st.status, `fichier texte accepté par /payments/import-status/columns (HTTP ${st.status}) : lu comme CSV au lieu d'être rejeté`).toBeGreaterThanOrEqual(400);
     |                                                                                                                                           ^
  13 | });
  14 |
  15 | test("UC-FE-ADM-PAY-EXP › l'en-tête du fichier exporté respecte la spécification MVola (5 colonnes)", async () => {
    at D:\ALTERRA\e2e\tests\remote\sprint3-zz-pay-format.spec.ts:12:139
```

### Rapports

**état d'erreur : message explicite attendu** — run3, 19.4 s

```text
Error: Aucun message d'erreur sur l'écran Rapports si l'API échoue
expect(locator).toBeVisible() failed
Locator: getByText(/erreur|échec|impossible|réessayer/i)
Expected: visible
Timeout: 15000ms
Error: element(s) not found
Call log:
  - Aucun message d'erreur sur l'écran Rapports si l'API échoue with timeout 15000ms
  - waiting for getByText(/erreur|échec|impossible|réessayer/i)
  71 |     await expect
  72 |       .soft(page.getByText(/erreur|échec|impossible|réessayer/i), "Aucun message d'erreur sur l'écran Rapports si l'API échoue")
> 73 |       .toBeVisible();
```

**export CSV, Excel et « PDF » du rapport Pointages** — run3, 12.4 s

```text
Error: L'export « PDF » livre « ALTERRA_pointages_2026-09-01_2026-09-30.html » (HTML) : aucun vrai PDF ni job asynchrone
expect(received).toBe(expected) // Object.is equality
Expected: true
Received: false
  112 |       await pdfDl.saveAs(pdfPath);
  113 |       const head = fs.readFileSync(pdfPath).subarray(0, 8).toString("latin1");
> 114 |       expect.soft(name.endsWith(".pdf") && head.startsWith("%PDF"), `L'export « PDF » livre « ${name} » (${head.startsWith("%PDF") ? "PDF" : "HTML"}) : aucun vrai PDF ni job asynchrone`).toBe(true);
      |                                                                                                                                                                                            ^
  115 |     } finally {
  116 |       for (const f of files) fs.rmSync(f, { force: true });
  117 |     }
    at D:\ALTERRA\e2e\tests\remote\sprint3-reports.spec.ts:114:188
```

### Journal d'audit

**état d'erreur : message explicite attendu** — run1, 20.9 s

```text
Error: Aucun message d'erreur sur l'écran Audit si l'API échoue
expect(locator).toBeVisible() failed
Locator: getByText(/erreur|échec|impossible|réessayer/i)
Expected: visible
Timeout: 15000ms
Error: element(s) not found
Call log:
  - Aucun message d'erreur sur l'écran Audit si l'API échoue with timeout 15000ms
  - waiting for getByText(/erreur|échec|impossible|réessayer/i)
   99 |     await expect
  100 |       .soft(page.getByText(/erreur|échec|impossible|réessayer/i), "Aucun message d'erreur sur l'écran Audit si l'API échoue")
> 101 |       .toBeVisible();
```

### RBAC, isolation par site, comptes inactifs

**chef de service : la session Admin survit à un rechargement de page (F5)** — run2-admin, 18.0 s

```text
Error: après F5, GET /me échoue (HTTP 500) et le chef de service est renvoyé vers /login
expect(received).toEqual(expected) // deep equality
- Expected  - 2
+ Received  + 2
  Object {
-   "me": 200,
-   "path": "/",
+   "me": 500,
+   "path": "/login",
  }
  102 |         { path: new URL(page.url()).pathname, me: meResp.status() },
  103 |         "après F5, GET /me échoue (HTTP 500) et le chef de service est renvoyé vers /login",
```

### Connexion PWA, PIN, hors ligne, déconnexion

**déconnexion : session révoquée et données locales sensibles purgées** — run4-pwa, 2.2 s

```text
Error: table Dexie « workers » non purgée à la déconnexion (données personnelles des MOC / pointages restent dans le navigateur)
expect(received).toBe(expected) // Object.is equality
Expected: 0
Received: 4
  309 |       expect
  310 |         .soft(counts[table] ?? 0, `table Dexie « ${table} » non purgée à la déconnexion (données personnelles des MOC / pointages restent dans le navigateur)`)
> 311 |         .toBe(0);
      |          ^
  312 |     }
  313 |     const apiCache = await page.evaluate(async () => {
  314 |       const out: string[] = [];
    at D:\ALTERRA\e2e\tests\remote\sprint3-pwa-auth.spec.ts:311:10
```
```text
Error: réponses API personnelles conservées dans le cache du service worker après déconnexion
expect(received).toEqual(expected) // deep equality
- Expected  - 1
+ Received  + 3
- Array []
+ Array [
+   "/api/v1/workers",
+ ]
  318 |       return out.filter((p) => /\/api\/v1\/(workers|teams|pointages|users|me)/.test(p));
  319 |     });
> 320 |     expect.soft(apiCache, "réponses API personnelles conservées dans le cache du service worker après déconnexion").toEqual([]);
      |                                                                                                                     ^
```

**« Se déconnecter » depuis l'écran verrouillé révoque la session serveur** — run2-pwa, 3.4 s

```text
Error: après « Se déconnecter » (écran verrouillé), le refresh token est encore valide côté serveur
expect(received).toBe(expected) // Object.is equality
Expected: 401
Received: 200
  389 |       await page.request.post("/api/v1/auth/logout", { headers: { Authorization: `Bearer ${token}` } });
  390 |     }
> 391 |     expect(status, "après « Se déconnecter » (écran verrouillé), le refresh token est encore valide côté serveur").toBe(401);
      |                                                                                                                    ^
  392 |   });
  393 | });
  394 |
    at D:\ALTERRA\e2e\tests\remote\sprint3-pwa-auth.spec.ts:391:116
```

## 5. Mesures et constats relevés pendant les tests

| Test | Type | Valeur relevée |
|---|---|---|
| préparation : pointages validés (bio OK) et garde-fou de période | biométrie | contrôle bio obtenu via : offline |
| préparation : pointages validés (bio OK) et garde-fou de période | constat | validation CDS → HTTP 500, repli sur validation admin |
| état vide, génération du bordereau, statut bio, régénération | constat | Régénération : identifiants de lignes tous remplacés (suppression + recréation des lignes PENDING). |
| import : fichier mal formé ou colonnes manquantes | constat | fichier non Excel envoyé à /payments/import-status/columns → HTTP 200 |
| liste, requêtes réseau et filtres cohérents avec l'API | performance | 30 pointages affichés → 12 requêtes GET /workers/:id (une par MOC distinct, N+1) |
| validation refusée sans bio OK, rejet avec motif obligatoire | diagnostic | validate sans bio : admin → HTTP 422 BIO_NOT_OK ; CDS → HTTP 500 INTERNAL_ERROR |
| volumétrie du référentiel réel : rendu, chargement par curseur, recherche (lecture seule) | volumétrie | 319 MOC réels ; rendu initial 2479 ms ; chargement complet (6 clics) 7512 ms ; recherche d'un nom réel (12 caractères, masqué) → 7 ligne(s) en 979 ms |
| volumétrie du référentiel réel : rendu, chargement par curseur, recherche (lecture seule) | critère 600+ | volume réel 319 < 600 MOC : critère « 600+ lignes » non éprouvé sur le réel (extrapolation seulement) |
| import : un numéro MVola déjà en base met à jour le MOC existant (upsert silencieux) | constat | L'import met à jour sans avertissement bloquant le MOC dont le n° MVola existe déjà (mention « à mettre à jour » dans l'aperçu uniquement). |
| Transverse › toutes les entités créées par la recette sont tracées dans l'audit (API = sou | audit | site: 5/5 tracés ; category: 4/4 tracés ; subActivity: 5/5 tracés ; user: 17/17 tracés ; team: 3/3 tracés ; worker: 13/13 tracés ; pointage: 15/15 tracés ; payment: 18/18 tracés |
| référentiel synchronisé dans Dexie (persistance après rechargement) | dexie | après synchro : {"workers":4,"activities":19,"pointages":0,"pointings_synced":0,"media":0,"syncQueue":0,"biometricTemplates":0,"presenceLog":0,"badges":0,"biometricOfflineChecks":0} |
| rafraîchissement de session : un 401 déclenche /auth/refresh puis rejoue la requête | inconclusif | Aucun GET API émis par l'écran chef d'équipe : le rejeu après 401 n'a pas pu être observé depuis l'UI. |
| rafraîchissement de session : un 401 déclenche /auth/refresh puis rejoue la requête | refresh | POST /auth/refresh direct → HTTP 200 |
| déconnexion : session révoquée et données locales sensibles purgées | purge | Dexie après déconnexion : {"workers":4,"activities":19,"pointages":0,"pointings_synced":0,"media":0,"syncQueue":0,"biometricTemplates":0,"presenceLog":0,"badges":0,"biometricOfflineChecks":0} |
| verdict : le rechargement hors ligne fonctionne (service worker) | hors ligne | {"reloadError":null,"controlled":true,"offlineWorkers":4,"before":4} |
| 2 échecs de connexion : message générique, puis connexion normale et périmètre d'équipe | périmètre | Dexie : 3 MOC ; API (CDE) : 3 MOC ; jeu E2E : 3 |
| manifest servi, lié à la page et installable (contrôle CDP « installabilityErrors ») | manifest | display=standalone start_url=/ icônes=192x192:image/png,512x512:image/png |
| manifest servi, lié à la page et installable (contrôle CDP « installabilityErrors ») | installabilité | in-incognito |
| service worker enregistré, actif ; précache Workbox complet | précache | 8 entrées ; caches : workbox-precache-v2-https://alterra-pwa.boss-etech.net/(8), api-cache(1) |
| service worker enregistré, actif ; précache Workbox complet | version | sw.js bd613e8a442c ; bundle /assets/index-BXhw9Xfp.js /assets/index-CZhYqiI3.css |

Volumétrie de l'écran MOC : **319** MOC réels ; rendu initial 2 479 ms ; chargement complet 7 512 ms en 6 clics « Charger plus » ; recherche 979 ms (7 lignes). Le critère « 600+ lignes » n'est donc pas éprouvé sur le réel.

## 6. Correspondance anomalies ↔ tests

| Anomalie | Gravité | Test(s) qui la mettent en évidence |
|---|---|---|
| A1 — `GET /me` 500 pour chef de service et chef d'équipe ; session Admin perdue au F5 | Bloquante | RBAC › chef de service : la session Admin survit à un rechargement (F5) ; sonde en lecture seule de `GET /me` sur `cds.amb` et `cde.amb2` ; RBAC UI initial (renvoi vers `/login`) |
| A2 — rejeu de synchro (même `clientUuid`) : 500 | Bloquante | Pointages › sync des pointages : création, idempotence, validations |
| A3 — validation d'un pointage par le chef de service : 500 | Bloquante | Pointages › validation refusée sans bio OK… ; annotations « validation CDS → HTTP 500 » de Paiements › préparation |
| A4 — création d'utilisateur : mot de passe saisi 500, e-mail en doublon 500 | Majeure | Utilisateurs › création avec un mot de passe saisi ; › validations serveur |
| A5 — après reset de mot de passe, compte bloqué 15 min | Majeure | Utilisateurs › mot de passe réinitialisé : le compte reste bloqué 15 min |
| A6 — « Se déconnecter » (écran verrouillé) ne révoque pas la session | Majeure | PWA-AUTH › « Se déconnecter » depuis l'écran verrouillé… |
| A7 — déconnexion PWA sans purge Dexie / cache | Majeure | PWA-AUTH › déconnexion : session révoquée et données locales sensibles purgées |
| A8 — numéro MVola invalide accepté | Majeure | MOC › validations serveur : doublons et formats |
| A9 — écrans sans état d'erreur / vide | Mineure | les 8 tests « état d'erreur » / « état vide » KO (Sites ×2, Activités, MOC, Utilisateurs, Pointages, Rapports, Audit) |
| A10 — export MVola à 3 colonnes | Mineure | zz-pay-format › l'en-tête du fichier exporté respecte la spécification MVola |
| A11 — fichier non Excel accepté à l'import MVola | Mineure | zz-pay-format › un fichier qui n'est pas un classeur Excel est refusé |
| A12 — écarts import MVola / rapports (preview, FAILED, PDF) | Mineure | Paiements › import du relevé… (soft : pas de compteur FAILED) ; Rapports › export CSV, Excel et « PDF » |
| A13 — marque RAKOTO / ALTERRA | Mineure | constat visuel (titres d'onglet), non automatisé |
| A14 — période de paie sans année | Mineure | Paiements › préparation (garde-fou de semaine vierge) ; état des semaines S47 à S51 après nettoyage |
| A15 — N+1 sur l'écran Pointages | Mineure | Pointages › liste, requêtes réseau et filtres (annotation de performance) |

## 7. Données créées et état du nettoyage

Toute donnée de test est préfixée `E2E-S3-`, créée par les tests eux-mêmes, puis désactivée par le projet `cleanup` (teardown exécuté même en cas d'échec). Dernier nettoyage : **0 erreur**.

Entités enregistrées par les runs 1 à 4 (registre) : 6 site, 5 category, 6 subActivity, 19 user, 4 team, 16 worker, 18 pointage, 24 payment — total 98.

| Type | Créés (runs 1–4) | État final |
|---|---:|---|
| Sites | 6 | désactivés (codes à 3 lettres consommés définitivement) |
| Catégories d'activité | 5 | désactivées (codes `ACT9x` et `E2ES3…` consommés) |
| Sous-activités (toutes versions) | 6 | désactivées |
| Utilisateurs | 19 | désactivés |
| Équipes | 4 | désactivées |
| MOC | 16 | supprimés (suppression logique `deletedAt`) |
| Pointages | 18 | rejetés, sauf 3 restés `VALIDATED` (datés de 2090) |
| Paiements (lignes, régénérations comprises) | 24 | conservés : non supprimables par l'API |

Dernier passage de nettoyage (état des entités trouvées par balayage du préfixe) :

| Type | Trouvés | Détail |
|---|---:|---|
| sites | 12 | 11 déjà inactif, 1 désactivé |
| categories | 10 | 9 déjà inactive, 1 désactivée |
| subActivities | 15 | 14 déjà inactive, 1 désactivée |
| workers | 3 | 3 supprimé (logique) |
| users | 29 | 27 déjà inactif, 2 désactivé |
| teams | 4 | 4 désactivée |
| pointages | 3 | 3 VALIDATED |
| payments | 12 | 2 S50 EXPORTED, 1 S50 PENDING, 2 S49 EXPORTED, 1 S49 PENDING, 1 S48 PAID, 1 S48 EXPORTED, 1 S48 PENDING, 1 S47 PAID, 1 S47 EXPORTED, 1 S47 PENDING |

### Paiements de test résiduels par semaine (lecture seule, après le dernier nettoyage)

| Semaine | Lignes `E2E-S3-` | Statuts | Lignes réelles |
|---|---:|---|---:|
| S47 | 3 | 1 PAID, 1 EXPORTED, 1 PENDING | 0 |
| S48 | 3 | 1 PAID, 1 EXPORTED, 1 PENDING | 0 |
| S49 | 3 | 2 EXPORTED, 1 PENDING | 0 |
| S50 | 3 | 2 EXPORTED, 1 PENDING | 0 |
| S51 | 3 | 2 EXPORTED, 1 PENDING | 0 |
| S37 | 0 | — | 4 (réelles, non touchées) |

**Action requise avant la semaine 47 (16 novembre 2026)** : purge en base de ces paiements (et pointages, contrôles biométriques, fichiers d'export associés). L'API ne le permet pas et le verrou de période ignore l'année : sinon un vrai bordereau sur S47–S51 sera refusé (409 `PAY_CONFLICT`). Requête indicative, à valider par Etech : `DELETE FROM "Payment" WHERE "workerId" IN (SELECT id FROM "Worker" WHERE matricule LIKE 'E2E-S3-%');`

Autres résidus : ≈ 25 contrôles biométriques de MOC de test ; 5 fichiers d'export `mvola/ALTERRA_MVola_S…xlsx` dans le stockage objet (données de test uniquement) ; toutes les entrées d'audit (normal).

## 8. Comptes réels sollicités et effets de bord

| Compte | Usage | Effet |
|---|---|---|
| `admin@alterra.mg` | API (setup, nettoyage, vérifications) et session Admin | connexions réussies uniquement ; 0 échec de connexion |
| `cds.amb`, `cds.anj` | RBAC, isolation par site, PWA chef de service (`cds.amb`) | connexions réussies uniquement |
| `cde.amb2` | RBAC, PWA chef d'équipe (PIN, hors ligne, déconnexion) | connexions réussies uniquement |
| `auditeur.sprint2` | compte inactif | 1 tentative refusée par exécution de la suite RBAC (2 au total) |
| Comptes `E2E-S3-` | échecs de connexion, comptes inactifs, réinitialisation | ≤ 2 échecs par compte |

Effets de bord inévitables : chaque connexion réussie met à jour `lastLoginAt` du compte réel et crée un jeton de rafraîchissement. Les données existantes n'ont pas été modifiées ; toutes les écritures portent sur des données `E2E-S3-`.

## 9. Preuves, limites et rejeu

- **Résultats bruts** : un fichier JSON par run dans `e2e/.remote-tmp/` (`results-run1.json`, `results-run2-admin.json`, `results-run2-pwa.json`, `results-run3.json`, `results-run4-admin.json`, `results-run4-pwa.json`), ignoré par git.
- **Captures et traces** : Playwright vide `e2e/test-results-remote*/` à chaque exécution ; seules celles du dernier run y subsistent. Elles peuvent montrer des données réelles : à supprimer une fois la recette lue.
- **Sécurité des traces** : traces globales désactivées (elles enregistreraient le corps des requêtes de connexion) ; traces manuelles démarrées après la connexion, conservées en cas d'échec seulement.
- **Non vérifié ou inconclusif** : affichage « Payé » dans le bordereau après import et idempotence du rejeu du même relevé (le test n'a pas rouvert la période) ; rafraîchissement de session déclenché par un 401 depuis l'interface (l'écran du chef d'équipe n'émet aucun GET) ; rejet d'un pointage par le chef de service (bloqué par A3) ; volumétrie 600+ (319 MOC réels) ; rapport PDF hebdomadaire (exclu : envoi d'e-mail réel) ; appareils réels, NFC et biométrie.
- **Exclus volontairement** : `POST /reports/weekly/generate`, `/system/backup`, `/system/restore`, tout test de charge.

### Rejouer

```powershell
cd e2e
$env:ALTERRA_ADMIN_PASSWORD = '<mot de passe admin>'
$env:ALTERRA_USERS_PASSWORD = '<mot de passe des comptes @alterra.test>'
npm run test:remote                 # recette complète avec nettoyage final
$env:E2E_S3_SKIP_PAY = '1'          # sans écriture de paiements (n'occupe aucune semaine)
npm run report:remote               # rapport HTML Playwright
```

Variables optionnelles : `ALTERRA_ADMIN_URL`, `ALTERRA_PWA_URL`, `E2E_S3_KEEP=1` (garde le jeu de test), `E2E_S3_CHANNEL=chromium`.

## 10. Vérification complémentaire : portée par année de l'export et du rapprochement (20 septembre 2026)

Test ajouté après la relecture des commits de correction : `e2e/tests/remote/sprint3-zz-year-scope.spec.ts`, exécuté sur la démonstration déployée (HEAD `0937e4d`, migration `referenceYear` appliquée). Il crée, pour la **même semaine (S36) en 2090 et en 2091**, deux paiements de test par année (données 100 % `E2E-S3-`), exporte 2090, puis lit en **aperçu** (`dryRun`, sans écriture) le rapprochement d'un relevé qui ne confirme qu'un paiement de 2090.

| Test | Résultat | Durée |
|---|---|---:|
| UC-FE-ADM-PAY-EXP › l'export d'une année n'embarque pas les lignes des autres années ; le rapprochement ne marque pas « non confirmés » les paiements d'une autre année | ❌ KO (2 constats) | 14.3 s |

Annotations relevées par le test :

- `export S36/2090 → 4 ligne(s) exportée(s) ; statuts 2091 après l'export : EXPORTED,EXPORTED` (attendu : 2 lignes, 2091 restant `PENDING,PENDING`).
- `aperçu : confirmé 1, non confirmés 3 dont 2 de l'année 2091` (attendu : 1 non confirmé, aucun de 2091).

Messages d'échec :

```text
EXPORT : l'export de S36 demandé pour 2090 a aussi exporté les lignes de 2091 (mvola-export.service.ts filtre sur periodIso sans referenceYear)
RAPPROCHEMENT : un relevé de la semaine 36 marque « non confirmés » des paiements exportés d'une autre année (mvola-reconciliation.service.ts raisonne sur le numéro de semaine seul)
```

**Lecture** : les deux comportements de l'export et du rapprochement restent indépendants de l'année ; la correction A14 (`Payment.referenceYear`) est partielle. Le rejeu à 95 sur 95 ne pouvait pas le détecter (ses écritures se font sur des semaines vides de 2090). Détail, impact et correctif proposé : `docs/qa/sprint3-rapport-recette-demo.md`, « Mise à jour 2 ».

**Garde-fou** : la suite refuse désormais d'écrire des paiements sur une semaine qui contient un paiement réel, quelle que soit l'année (2024 à 2031), tant que l'export ignore l'année.

**Données laissées** : 4 paiements `E2E-S3-` `EXPORTED` (S36/2090 : 2 ; S36/2091 : 2), 4 pointages `VALIDATED` datés de 2090 et 2091, contrôles biométriques de test. Nettoyage : 0 erreur ; ces lignes ne verrouillent aucune semaine réelle de 2026 (les périodes portent une année).
