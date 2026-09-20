# Rapport de recette — Sprint 3 « Admin complet et PWA setup » (jalon 3)

Recette réalisée **sur l'environnement de démonstration déployé** (pas en local), le 20 septembre 2026, en deux temps : la **recette initiale** (avant correction, §1 à §11 ci-dessous) puis son **rejeu après correction** (résumé ci-après). Aucun mot de passe n'apparaît dans ce document, dans les tests ni dans les fichiers versionnés.

## Mise à jour : rejeu après correction

**Conclusion actuelle : le jalon 3 est atteint sur la démonstration, sous trois réserves.** La suite rejouée après correction et déploiement (HEAD `0937e4d`, 20/09/2026 après 14 h 12 UTC) donne **95 tests réussis sur 95**, contre 74 sur 95 à la recette initiale. Le verdict « jalon non atteint » des sections suivantes décrit l'état **avant correction**.

| Indicateur | Recette initiale | Rejeu après correction |
|---|---:|---:|
| Tests réussis / échoués | 74 / 21 | **95 / 0** |
| Cas d'usage conformes / partiels | 5 / 7 | **12 / 0** |
| Anomalies traitées | 15 constatées | 14 corrigées, A13 à trancher (réglage, pas un défaut) |

- **Corrections** : `docs/qa/sprint3-corrections.md` (commits `cfa8c22`, `a3cc121`, `10951f3`, `0937e4d`).
- **Détail test par test du rejeu** : `RESULTATS-RECETTE-SPRINT3.md`, section 0.
- **Paiements de test** : purgés (15 lignes de la recette initiale, puis celles du rejeu) ; les périodes de paie portent désormais une année, les tests écrivent en 2090 et ne verrouillent plus les semaines réelles. Le point d'attention sur S47 à S51 (§1, §8) est levé.
- **Tests adaptés** au rejeu : lectures avec l'année de période, import du relevé en deux temps (aperçu puis confirmation), bordereau ciblé (la page contient aussi l'historique des exports), recherche par « Charger plus » dans la liste des utilisateurs, codes de catégorie `ACT80` à `ACT89` (`ACT90` à `ACT99` épuisés).

**Réserves :**

1. Format d'export MVola : 5 colonnes (spécification) par défaut, à confirmer avec Etech ; `MVOLA_EXPORT_FORMAT=compact3` revient à 3 colonnes.
2. Nom affiché « RAKOTO » ou « ALTERRA » (A13) : décision à prendre.
3. Non couvert par un rejeu automatique : rapport PDF hebdomadaire, sauvegarde et restauration, appareils réels, NFC, biométrie, critère « 600+ MOC ».

Le rejeu doit se faire en deux passes (Admin, puis PWA) : l'API limite `/api/v1/auth/*` à 100 requêtes par 5 minutes et par adresse IP.

---

# Recette initiale (avant correction)


## 1. Synthèse

**Conclusion : le jalon 3 n'est pas atteint en l'état de la démonstration.**

Le socle Admin fonctionne bien pour le rôle **administrateur** (référentiels, tarif versionné RG-04, correction de pointage avec motif, bordereau, export MVola, journal d'audit, PWA installable et utilisable hors ligne). En revanche, **tous les rôles non administrateur** (chef de service, chef d'équipe) sont touchés par un défaut serveur commun qui rend inutilisables plusieurs parcours métier, et plusieurs critères d'acceptation ne sont que partiellement couverts.

| Indicateur | Valeur |
|---|---|
| Tests exécutés (dernier résultat par test) | 95 (74 OK, 21 KO) |
| Dont KO = écran sans message d'erreur ou d'état vide | 8 (mineurs) |
| Dont KO = anomalies fonctionnelles ou de sécurité | 13 tests → 15 anomalies (voir §5) |
| Anomalies bloquantes | 3 (A1, A2, A3), une seule cause racine probable |
| Anomalies majeures | 5 |
| Anomalies mineures | 7 |

Résultat par UC : **OK 5 · Partiel 7 · KO 0** (détail au §4).

**Les trois anomalies bloquantes ont une seule cause racine probable** : le filtre de périmètre (RLS applicatif) réécrit la clause `where` des requêtes Prisma `findUnique`, `findUniqueOrThrow`, `update` et `delete` sous une forme invalide pour les rôles autres qu'administrateur. Elles se manifestent par des erreurs HTTP 500 sur `GET /me`, sur la validation d'un pointage par le chef de service et sur le rejeu d'une synchronisation de pointage.

**Point d'attention immédiat sur la base de démonstration** : la méthode de test a laissé, pour les semaines de paie **S47 à S51**, des paiements de test (`E2E-S3-`) au statut `EXPORTED` ou `PAID`. L'API ne permet pas de les supprimer, et le verrou de période ne tient pas compte de l'année (anomalie A14) : **tant qu'ils ne sont pas purgés en base, la génération d'un vrai bordereau pour les semaines 47 à 51 sera refusée** (HTTP 409 `PAY_CONFLICT`). Voir §8.

---

## 2. Environnement et version testés

| Élément | Valeur |
|---|---|
| Admin | https://alterra-admin.boss-etech.net (titre d'onglet « RAKOTO — Back-office ») |
| PWA | https://alterra-pwa.boss-etech.net (titre « ALTERRA — Terrain ») |
| Comptes utilisés | `admin@alterra.mg` ; `cds.amb`, `cds.anj` (chefs de service) ; `cde.amb2` (chef d'équipe) ; `auditeur.sprint2` (compte inactif, 1 tentative par exécution) ; comptes `E2E-S3-` créés pour l'occasion |
| MFA | Aucun écran MFA rencontré : l'administrateur s'est connecté avec son mot de passe seul |
| Navigateur de test | Google Chrome installé sur le poste (canal `chrome`), Playwright 1.61.1 |
| Code de référence | branche `develop`, HEAD `34087e7` (20/09/2026 08:04 UTC) |

**Version déployée : non identifiable de façon certaine.** Les frontends sont des builds sans numéro de version ni en-tête `Last-Modified`/`ETag`. Empreintes relevées :

| Front | Bundle JS / CSS | `sw.js` (empreinte) |
|---|---|---|
| Admin | `assets/index-BlFv9qJE.js` / `index-7LPp1ijo.css` | `06c1951e9980` |
| PWA | `assets/index-BXhw9Xfp.js` / `index-CZhYqiI3.css` | `bd613e8a442c` |

Le dossier `dist/` local date du 19/08 et ne permet pas de rapprocher ces empreintes du code. **Écart visible avec `develop` : aucun fonctionnel** — les évolutions du 20/09 sont présentes (fond de collines et feuilles sur les pages de connexion, tri des colonnes sur Activités). **Écart de marque à confirmer** : l'Admin affiche « RAKOTO » alors que la PWA et la documentation disent « ALTERRA » (réglage `appName`, voir A13).

---

## 3. Méthode et garde-fous

- **Config dédiée** `e2e/playwright.remote.config.ts` (projets `setup`, `admin`, `pwa`, `cleanup`), 1 worker, 0 retry. La configuration existante n'a pas été touchée.
- **Mots de passe** lus uniquement dans `ALTERRA_ADMIN_PASSWORD` et `ALTERRA_USERS_PASSWORD`, jamais écrits sur disque. Les traces Playwright sont **désactivées globalement** (elles enregistreraient le corps des requêtes de connexion) ; les specs démarrent leur propre trace après la connexion et ne la conservent qu'en cas d'échec, dans un dossier ignoré par git.
- **`storageState` non utilisé** : les jetons de rafraîchissement sont à usage unique (rotation), un état sauvegardé ne peut donc pas être rejoué. Les sessions UI sont ouvertes une fois par rôle et gardées en mémoire par le worker.
- **Aucune donnée existante modifiée** : toute donnée de test est créée par le test, préfixée `E2E-S3-`, puis désactivée en fin de recette. Les écritures sur pointages, paiements et imports MVola ne portent que sur des données créées par les tests.
- **Semaine de paie vierge obligatoire** avant toute écriture du bordereau : `periodIso` est stocké sous la forme `S<n>` sans année, et la génération supprime tous les paiements `PENDING` de cette période. Le test refuse d'écrire si la semaine contient un seul paiement non `E2E-S3-`.
- **Échecs de connexion** : jamais sur `admin@alterra.mg` ; 2 tentatives maximum par compte, sur des comptes `E2E-S3-` ; `auditeur.sprint2` : 1 tentative par exécution de la suite RBAC (2 exécutions au total).
- **Exclus volontairement** : rapport hebdomadaire PDF (envoie un e-mail réel), routes `/system/backup` et `/system/restore`, test de charge.
- **Effets de bord inévitables** : chaque connexion réussie met à jour `lastLoginAt` du compte réel et crée un jeton de rafraîchissement ; le journal d'audit conserve toutes les entrées de test.
- **Campagne** : un run complet de référence (setup → admin → PWA → nettoyage), puis 3 runs complémentaires limités aux specs que des erreurs de conception de mes propres tests avaient bloquées (conditions de course, chaînes interrompues par un constat). Les résultats du §4 sont, pour chaque test, ceux de la dernière exécution.
- **Limite** : le rendu réel n'a été observé que par ces scénarios automatisés ; la recette manuelle par le référent ALTERRA reste à faire.

---

## 4. Résultat par UC

Légende : **OK** = critères du backlog satisfaits (réserves de finition possibles) ; **Partiel** = UC utilisable mais au moins un critère ou un parcours n'est pas satisfait ; **KO** = UC inutilisable.

| UC | Résultat | Tests OK / KO | Constat principal |
|---|---|---|---|
| UC-FE-ADM-SITES | **OK** | 5 / 2 | Table paginée, création, validations (code 2–3 lettres, doublon → 409), édition (code immuable), désactivation, audit : OK. Aucun message d'état vide ni d'erreur (A9). |
| UC-FE-ADM-ACT | **OK** | 6 / 1 | RG-04 validée : changement de tarif → ancienne version close la veille, nouvelle ouverte le jour même, historique visible dans le tiroir, pointage passé inchangé (snapshot 1 000 Ar, montant 2 000 Ar), audit `RATE_CHANGE`. Pas de message d'erreur si l'API échoue (A9). |
| UC-FE-ADM-WORKERS | **Partiel** | 9 / 2 | Pagination par curseur, recherche, filtres, création, édition, suppression et import Excel (valide, corrompu, colonne absente, doublons, lignes en erreur) : OK. Volumétrie « 600+ » **non éprouvée** (319 MOC réels). Numéro MVola invalide accepté à la création (A8) ; l'import met à jour silencieusement un MOC existant (observation O2). |
| UC-FE-ADM-USERS | **Partiel** | 5 / 4 | Création (mot de passe généré), édition, désactivation : OK. Création avec mot de passe saisi : HTTP 500 (A4) ; e-mail en doublon : 500 au lieu de 409 (A4) ; réinitialisation : compte bloqué 15 min (A5). |
| UC-FE-ADM-PNT | **Partiel** | 4 / 3 | Consultation, filtres, détail, **correction avec motif obligatoire** (≥ 10 caractères, audit `CORRECT` avant/après) : OK pour l'administrateur. Validation par le chef de service : 500 (A3) ; rejeu de synchronisation : 500 (A2). |
| UC-FE-ADM-PAY-BORD | **OK** | 3 / 0 | Semaine vierge : état vide, génération (3 lignes), statut bio (OUI/NON, « Bloquées bio »), correction inline avec motif ≥ 10 caractères (montant d'origine conservé), régénération, isolation de la période. |
| UC-FE-ADM-PAY-EXP | **Partiel** | 2 / 1 | Export téléchargé et vérifié colonne par colonne : ligne bio KO exclue (RG-03), montants arrondis, numéro en texte, compteurs `X-ALTERRA-*`, second export refusé, régénération refusée (409), correction refusée. **3 colonnes au lieu des 5 de la spécification** (A10). Pas d'historique des exports dans l'écran (critère du backlog). |
| UC-FE-ADM-PAY-IMP | **Partiel** | 2 / 2 | Relevé généré : confirmé (→ `PAID`), écart de montant (reste `EXPORTED`), orphelin, frais rattachés, ligne ignorée, ligne interne, « non confirmés » : compteurs corrects. Pas d'aperçu avant écriture, pas de compteur FAILED (A12) ; fichier non Excel accepté (A11). Non vérifiés faute de test correct : affichage « Payé » dans le bordereau après import et idempotence du rejeu (voir §9). |
| UC-FE-ADM-REP | **Partiel** | 4 / 2 | Trois rapports, période, filtre site, état vide, exports CSV et Excel identiques à l'aperçu : OK. L'export « PDF » livre un fichier `.html`, sans job asynchrone (A12). |
| UC-FE-ADM-AUDIT | **OK** | 4 / 1 | Table paginée, filtres, état vide, réinitialisation, tiroir avant/après, journal en lecture seule ; **toutes les entités créées par la recette sont tracées** (17 utilisateurs, 13 MOC, 15 pointages, 18 paiements… : 100 %). Pas de message d'erreur si l'API échoue (A9). |
| UC-FE-PWA-SETUP | **OK** | 6 / 0 | Manifest dynamique (`/api/v1/manifest.webmanifest`) valide et **installable** (Chrome : aucune erreur hors « in-incognito » propre au contexte de test), service worker actif, précache Workbox (8 entrées), assets servis par le service worker, cache API network-first, navigation hors ligne, schéma Dexie complet. |
| UC-FE-PWA-AUTH | **Partiel** | 12 / 2 | Connexion, validations du PIN, jeton chiffré (AES-GCM/PBKDF2, aucun JWT en clair), déverrouillage par PIN, verrouillage à 30 min, reconnexion hors ligne, périmètre CDS/CDE, comptes inactifs, absence de panneau de démo : OK. **Déconnexion : données locales non purgées** (A7) ; **« Se déconnecter » depuis l'écran verrouillé ne révoque pas la session serveur** (A6). |

**Transverses**

| Contrôle | Résultat |
|---|---|
| RBAC Admin, écrans : administrateur (14 écrans), chef de service (Tableau de bord + Pointages), chef d'équipe (tout refusé → `/forbidden`) | **OK** — mais le chef de service perd sa session au moindre rechargement de page (A1) |
| RBAC API : 12 routes interdites au chef de service, 10 au chef d'équipe → HTTP 403 ; sans jeton / jeton falsifié → 401 | **OK** |
| Isolation par site : AMB et ANJ sans MOC ni pointage commun, en API et à l'écran | **OK** |
| Compte inactif refusé (compte `E2E-S3-` désactivé et `auditeur.sprint2`) ; message de connexion générique après 2 échecs ; connexion normale ensuite | **OK** |
| Aucun panneau de comptes de démonstration (Admin et PWA) | **OK** |
| Cohérence UI/API (réponses interceptées) sur les listes, aperçus, tiroirs, résultats d'import | **OK** |
| Volumétrie écran MOC : 319 MOC, rendu initial 2,5 s, chargement complet 7,5 s (6 clics « Charger plus »), recherche 1,0 s | Correct ; critère « 600+ » non éprouvé sur le réel |
| Traçabilité de chaque mutation de test dans l'audit | **OK** (100 %) |

---

## 5. Anomalies

Numérotées par gravité. Les preuves (captures, traces en cas d'échec) sont dans `e2e/test-results-remote*/` et `e2e/.remote-tmp/`, dossiers ignorés par git.

### Bloquantes

**A1 — `GET /me` renvoie HTTP 500 pour le chef de service et le chef d'équipe ; le chef de service perd sa session Admin à chaque rechargement**
- UC : UC-FE-ADM-AUTH, RBAC « chef de service limité à son site sur l'Admin ».
- Repro : se connecter sur l'Admin avec `cds.amb` ; recharger la page (F5). Ou appeler `GET /api/v1/me` avec le jeton reçu au login de `cds.amb` ou `cde.amb2`.
- Attendu : profil de l'utilisateur, session conservée. Obtenu : 500 `INTERNAL_ERROR`, `useAuthBootstrap` déconnecte et redirige vers `/login`. Sonde en lecture seule confirmée sur les deux comptes réels ; le rechargement est testé (`sprint3-rbac › la session Admin survit à un rechargement`).
- Fichiers suspects : `backend/src/middleware/prisma-rls.ts:97-103` (`mergeWhere`) et `:312`, `:328-330`, `:348-350` ; `backend/src/routes/auth.routes.ts:140` (`findUniqueOrThrow`).
- Cause probable : pour un rôle scopé, `mergeWhere` transforme `where: { id }` en `where: { AND: [{ id }, scope] }` ; Prisma refuse un `where` unique sans champ unique de premier niveau pour `findUnique`, `findUniqueOrThrow`, `update`, `delete`, `upsert`.
- Correctif proposé : conserver les champs uniques au premier niveau, par exemple `{ ...existing, AND: [scope] }` (Prisma ≥ 5 accepte des filtres non uniques en plus du champ unique) ; à défaut, lire le profil avec le client non scopé pour `/me`.

**A2 — Le rejeu d'une synchronisation de pointage (même `clientUuid`) renvoie HTTP 500 au lieu de `already_exists`**
- UC : UC-FE-PWA-SETUP / synchronisation (idempotence, critère « zéro perte de données offline »).
- Repro : avec un chef d'équipe, envoyer deux fois `POST /pointages/sync` avec le même lot. Premier appel : `created`. Second : 500 `INTERNAL_ERROR`.
- Attendu : 200 avec `already_exists` et le même `id`. Obtenu : 500 (test `sprint3-pointages › sync des pointages`).
- Fichier suspect : `backend/src/services/pointages/sync.service.ts:59-66` (`findUnique` par `clientUuid` après l'erreur `P2002`), même cause racine que A1.
- Impact : un client qui n'a pas reçu la réponse du premier envoi rejoue le lot et se heurte à une erreur permanente : file de synchronisation bloquée.

**A3 — La validation d'un pointage par le chef de service renvoie HTTP 500**
- UC : UC-FE-ADM-PNT (écran Pointages ouvert au chef de service), UC-BE-PNT-VAL.
- Repro : chef de service d'un site, pointage `PENDING` de son site, `PATCH /pointages/:id/validate`. Avec bio OK ou sans bio : 500. Le même appel avec l'administrateur répond correctement (200, ou 422 `BIO_NOT_OK` sans contrôle bio).
- Attendu : 200, ou 422 `BIO_NOT_OK`. Obtenu : 500 (constaté à chaque exécution, y compris avec un contrôle bio OK). Le rejet avec motif par le chef de service n'a pas pu être testé positivement.
- Fichier suspect : `backend/src/services/pointages/validation.service.ts:26-38` (`findUniqueOrThrow` puis `update`), même cause racine que A1.
- Impact : le chef de service ne peut valider aucun pointage depuis l'Admin ni la PWA.

### Majeures

**A4 — Création d'utilisateur : mot de passe saisi → HTTP 500 ; e-mail en doublon → HTTP 500 au lieu de 409**
- UC : UC-FE-ADM-USERS. Repro : formulaire « Nouvel utilisateur » avec le champ « Mot de passe (optionnel) » rempli ; ou `POST /users` avec un e-mail existant.
- Attendu : 201, ou 409. Obtenu : 500. Sans mot de passe saisi, la création réussit.
- Fichier suspect : `backend/src/routes/users.routes.ts:153-158` (`...req.body` transmet `password` à `prisma.user.create`) ; erreur `P2002` non convertie en 409.
- Correctif proposé : extraire `password` du corps avant `create` ; mapper `P2002` en `ApiError(409, "DUPLICATE")`.

**A5 — Après une réinitialisation de mot de passe, le compte est inutilisable pendant 15 minutes**
- UC : UC-FE-ADM-USERS (« reset MDP »). Repro : réinitialiser un utilisateur, se connecter avec le mot de passe temporaire (200), appeler n'importe quelle route : 401 `USER_BLOCKED`.
- Attendu : le nouveau mot de passe permet de travailler. Obtenu : blocage par identifiant pendant 15 min.
- Fichier suspect : `backend/src/services/users/user-admin.service.ts:28-37` (`blockUser(userId, 15 * 60)`) et `middleware/auth.ts:24`. Le blocage sert à invalider les anciens jetons d'accès mais frappe aussi les jetons neufs.
- Correctif proposé : invalider par date d'émission du jeton (`iat` < date du reset) au lieu d'un blocage par utilisateur.

**A6 — PWA : « Se déconnecter » depuis l'écran verrouillé ne révoque pas la session serveur**
- UC : UC-FE-PWA-AUTH. Repro : se connecter, créer le PIN, recharger (écran « Déverrouiller »), « Se déconnecter », puis `POST /api/v1/auth/refresh` avec les cookies du navigateur.
- Attendu : 401. Obtenu : 200 (nouveau jeton d'accès). L'appel `POST /auth/logout` part sans jeton d'accès (mémoire vidée), reçoit 401 et l'erreur est ignorée : le cookie de rafraîchissement reste valide 7 jours. La déconnexion depuis l'application déverrouillée, elle, révoque bien la session (204, refresh refusé ensuite).
- Fichiers suspects : `pwa/src/hooks/AuthProvider.tsx:111-119` ; `pwa/src/pages/UnlockPin.tsx:133-139`. Correctif : accepter le refresh cookie seul sur `/auth/logout`, ou tenter un refresh avant l'appel.

**A7 — PWA : la déconnexion ne purge pas les données locales sensibles**
- UC : UC-FE-PWA-AUTH (« déconnexion qui purge les données locales sensibles »).
- Obtenu après « Déconnexion » : PIN, session chiffrée et templates biométriques supprimés, mais **la table Dexie `workers` (noms, matricules, numéros MVola) reste** (4 lignes dans le test), ainsi que les réponses API du cache `api-cache` du service worker.
- Fichiers suspects : `pwa/src/hooks/AuthProvider.tsx:111-119` (`clearPersistedSession` ne vide que `settings`) ; `pwa/vite.config.ts:25-32` (cache `api-cache`, 5 min). Correctif : vider `workers`, `activities`, `pointages_synced`, `presenceLog`, `syncQueue` et les caches à la déconnexion (en gardant les pointages non synchronisés, avec avertissement).

**A8 — Un numéro MVola au format invalide est accepté à la création d'un MOC, et bloque plus tard l'export de toute la période**
- UC : UC-FE-ADM-WORKERS / PAY-EXP. Repro : `POST /workers` avec `mvolaNumber` = `999XXXXXXXX` → 201. Le formulaire annonce « 034XXXXXXXX ou 038XXXXXXXX ».
- Conséquence : à l'export, `422 INVALID_MVOLA_NUMBER` pour toute la période dès qu'une ligne exportable porte un numéro invalide (`mvola-export.service.ts:57-69`).
- Fichier : `backend/src/routes/workers.routes.ts:51-65` (`mvolaNumber: z.string().min(9)`). Correctif : valider `/^03[48]\d{7}$/` à la création, à l'édition et à l'import.

### Mineures

**A9 — Écrans sans message d'erreur ni d'état vide** : Sites, Activités, Travailleurs, Utilisateurs, Pointages, Rapports, Audit affichent un tableau vide si l'API renvoie 500 ; Sites n'affiche pas non plus de message quand la liste est vide (les autres écrans oui). Critères « états vides et d'erreur » non satisfaits. Correctif : composant d'erreur commun sur les requêtes React Query.

**A10 — Export MVola : 3 colonnes au lieu des 5 de la spécification** — colonnes exportées `Numéro téléphone`, `Description`, `Montant` ; `docs/cadrage/mvola-format.md §3.2` et le backlog (« 5 colonnes spec ») demandent en plus `Période` et `Bio Validée`. Le libellé exporté suit une grammaire plus récente (`<nom> <ACTIVITÉ> S<sem> <bordereau> <site> <code>`) que celle du document : la spécification est probablement obsolète. À trancher avec le référent ; en tout état de cause, mettre le document à jour. Fichier : `backend/src/services/payments/mvola-export.service.ts:74-87`.

**A11 — Import retour MVola : un fichier qui n'est pas un classeur Excel est accepté** — `POST /payments/import-status/columns` avec un texte brut renvoie 200 (lu comme CSV). Fichier : `mvola-releve-parser.service.ts:50-57`.

**A12 — Écarts avec les critères des UC de paiement et de reporting** — (a) import MVola : pas d'aperçu avant écriture (le bouton « Lancer le rapprochement » écrit tout de suite), pas de compteur PAID/FAILED (le statut `FAILED` n'est jamais produit) ; (b) le bordereau n'expose ni le statut de rapprochement (`ECART_MONTANT`, `NON_CONFIRME`) ni la référence MVola : un écart de montant n'est visible que dans la boîte de résultat de l'import ; (c) pas d'historique des exports MVola dans l'écran ; (d) export « PDF » des rapports = fichier HTML `.html`, sans job asynchrone.

**A13 — Marque incohérente** : titre d'onglet et en-tête de l'Admin « RAKOTO » (réglage `appName`), PWA « ALTERRA ». À confirmer avec le référent.

**A14 — Période de paie sans année (`S<n>`)** — `generatePayments` supprime tous les paiements `PENDING` du numéro de semaine, toutes années confondues ; le verrou « bordereau déjà exporté ou payé » l'est aussi ; `GET /payments`, l'export et le rapprochement raisonnent sur `S<n>`. Risque de conception (une semaine 12 de l'année suivante entre en conflit avec celle de l'année précédente) ; il a aussi rendu les données de test définitives (§8). Fichiers : `backend/src/lib/period-iso.ts:52-100`, `backend/src/services/payments/generate.service.ts:56-70,168-171`, `list.service.ts:13-20`.

**A15 — Écran Pointages : requêtes N+1** — 30 pointages affichés → 12 requêtes `GET /workers/:id` (une par MOC distinct, jusqu'à 50 par page). Fichier : `admin/src/pages/Pointages.tsx:170-178`. Correctif : joindre le nom du MOC dans `GET /pointages` ou grouper la requête.


---

## 6. Écarts avec les critères d'acceptation (backlog Sprint 3)

| UC | Critère (backlog-moscow.md) | État |
|---|---|---|
| SITES | Table paginée ; modal formulaire ; validation | ✔ |
| ACT | Table ; drawer historique tarifs | ✔ |
| WORKERS | Cursor pagination ; filtres ; fiche ; import Excel drag&drop ; **600+ lignes** | ✔ sauf 600+ non éprouvé (319 MOC réels) ; A8 |
| USERS | CRUD ; reset MDP ; activation/désactivation | ✘ partiel : A4, A5 |
| PNT | Table filtrable ; drawer détail ; correction motif obligatoire | ✔ administrateur ; ✘ chef de service (A3) |
| PAY-BORD | Sélection période ; table ; statut bio ; édition inline motif | ✔ |
| PAY-EXP | Bouton Exporter ; download ; **historique exports** | ✔ ; ✘ historique absent ; A10 |
| PAY-IMP | Drag&drop ; **preview** ; **résumé PAID/FAILED** | ✔ drag&drop ; ✘ preview et FAILED (A12) |
| REP | 3 rapports prédéfinis ; **exports CSV/Excel/PDF via jobs** | ✔ 3 rapports, CSV, Excel ; ✘ PDF et jobs (A12) |
| AUDIT | Table paginée ; filtres ; drawer diff JSON | ✔ |
| PWA-SETUP | manifest ; SW cache-first assets ; Dexie schema | ✔ |
| PWA-AUTH | Token IndexedDB chiffré WebCrypto ; PIN déverrouillage 30 min | ✔ ; ✘ purge à la déconnexion (A6, A7) |
| Global | Zéro perte de données offline | ✘ risque A2 |
| Global | Toute correction manuelle tracée avec motif | ✔ (pointage : motif ≥ 10 caractères, audit avant/après ; paiement : idem) |

---

## 7. Observations (non classées en anomalie)

- **O1** — Le contrôle biométrique des pointages de test a été obtenu par `POST /biometric/check-offline` (résultat déclaré par le client) parce que le fournisseur déployé ne renvoie pas « OK » sur `/biometric/check` pour un MOC sans photo. Cette route permet à tout chef d'équipe de déclarer un résultat « OK » pour un MOC (l'API accepte le résultat fourni) : à examiner du point de vue de la règle RG-03, hors périmètre du Sprint 3.
- **O2** — L'import Excel des MOC met à jour, sans avertissement bloquant, le MOC dont le numéro MVola existe déjà (mention « à mettre à jour » dans l'aperçu seulement). Comportement peut-être voulu ; à confirmer. Vérifié uniquement sur des MOC de test.
- **O3** — La régénération d'un bordereau remplace toutes les lignes `PENDING` (nouveaux identifiants) et perd les corrections manuelles de montant.
- **O4** — Le catalogue « Activités » filtre aussi les sous-activités par la recherche (la recherche par libellé de catégorie ne montre pas de sous-activité) ; c'est cohérent mais peu intuitif.
- **O5** — Le chef d'équipe peut se connecter sur l'Admin (l'API `/auth/login` est commune) puis est renvoyé vers `/forbidden` ; les routes API d'administration répondent 403.
- **O6** — Le test de rafraîchissement de session déclenché par un 401 n'a pas pu être observé depuis l'interface du chef d'équipe (l'écran ne fait aucune requête GET, les données viennent de Dexie) : **inconclusif** ; le rafraîchissement direct par cookie répond 200.
- **O7** — Un changement de tarif effectué le jour même de la création de la sous-activité ouvre la nouvelle version le lendemain (RG-04, `computeRateChangeDates`) : jusqu'à demain, la version fermée est désactivée et la nouvelle n'est pas encore en vigueur. Cas limite non testé en détail.

---

## 8. Données `E2E-S3-` créées et état de nettoyage

Le nettoyage automatique (projet `cleanup`, exécuté même en cas d'échec) balaie tout ce dont le libellé commence par `E2E-S3-` : **0 erreur** à la dernière exécution. Ce que le nettoyage a fait et ce qui reste :

| Type | Créés (runs 1 à 4 ; ≈ 98 entités) | État final |
|---|---|---|
| Sites | 6 (+ tentatives d'exploration antérieures, toutes nettoyées) | **désactivés** (codes à 3 lettres consommés définitivement : 12 au total) |
| Catégories d'activité (`ACT9x`, `E2ES3…`) | 5 | **désactivées** (10 codes consommés) |
| Sous-activités (toutes versions) | 6 | **désactivées** |
| Utilisateurs | 19 | **désactivés** (29 au total avec l'exploration) |
| Équipes | 4 | **désactivées** |
| MOC | 16 | **supprimés (suppression logique `deletedAt`)** |
| Pointages | 18 | 15 **rejetés** ; **3 restent `VALIDATED`** (datés de 2090, non supprimables) |
| Paiements | 24 (15 en état résiduel) | **conservés** : non supprimables par l'API |
| Contrôles biométriques | ≈ 25 (MOC de test) | conservés |
| Archives d'export MVola (stockage objet) | 5 fichiers `mvola/ALTERRA_MVola_S…xlsx` | conservés (données de test uniquement) |
| Entrées d'audit | toutes | conservées (normal) |

**Paiements de test résiduels, par numéro de semaine** (lecture seule, base de démonstration) :

| Semaine | Lignes `E2E-S3-` | Statuts | Lignes réelles |
|---|---|---|---|
| S47 | 3 | 1 `PAID`, 1 `EXPORTED`, 1 `PENDING` | 0 |
| S48 | 3 | 1 `PAID`, 1 `EXPORTED`, 1 `PENDING` | 0 |
| S49 | 3 | 2 `EXPORTED`, 1 `PENDING` | 0 |
| S50 | 3 | 2 `EXPORTED`, 1 `PENDING` | 0 |
| S51 | 3 | 2 `EXPORTED`, 1 `PENDING` | 0 |
| S37 | 0 | — | 4 (réelles, non touchées) |

**Action requise avant la semaine 47 (16 novembre 2026)** : purger en base les paiements des MOC `E2E-S3-` (et leurs pointages, contrôles biométriques et le stockage objet correspondant), car l'API ne le permet pas et le verrou de période ignore l'année. Requête indicative, à faire valider par Etech avant exécution :
`DELETE FROM "Payment" WHERE "workerId" IN (SELECT id FROM "Worker" WHERE matricule LIKE 'E2E-S3-%');`
Les 4 lignes réelles de S37 n'ont pas été touchées : les tests n'écrivent jamais sur une semaine contenant un paiement non `E2E-S3-`.

Pour éviter de consommer une semaine de plus à chaque rejeu, la suite est désormais protégée : `E2E_S3_SKIP_PAY=1` ignore la chaîne bordereau/export/import, et les semaines candidates démarrent à S46.

---

## 9. Non vérifié ou inconclusif

- Après l'import MVola : l'affichage « Payé » dans le tableau du bordereau et l'idempotence du rejeu du même relevé ne sont pas vérifiés (le test aurait dû rouvrir la période avant de lire le tableau). Les états serveur, eux, sont vérifiés : ligne confirmée `PAID` avec date de paiement, ligne en écart de montant restée `EXPORTED`.
- Rafraîchissement de session déclenché par un 401 depuis l'interface (O6).
- Rejet d'un pointage par le chef de service (bloqué par A3).
- Volumétrie 600+ MOC (319 réels).
- Rapport PDF hebdomadaire asynchrone (exclu : envoi d'e-mail réel).
- Tests exécutés uniquement en Chrome bureau et émulation Pixel 7 ; pas de test sur appareil réel, ni NFC/biométrie.

---

## 10. Rejouer les tests

Prérequis : Chrome installé (sinon `npx playwright install chromium` puis `E2E_S3_CHANNEL=chromium`), dépendances installées (`npm install` à la racine).

```powershell
cd e2e
$env:ALTERRA_ADMIN_PASSWORD = '<saisir le mot de passe admin>'
$env:ALTERRA_USERS_PASSWORD = '<saisir le mot de passe des comptes @alterra.test>'
# Recette complète (crée les données E2E-S3-, teste, puis nettoie)
npm run test:remote
# Sans écriture de paiements (n'occupe aucune semaine de paie)
$env:E2E_S3_SKIP_PAY = '1'; npm run test:remote
# Rapport HTML
npm run report:remote
```

Variables optionnelles : `ALTERRA_ADMIN_URL`, `ALTERRA_PWA_URL`, `E2E_S3_KEEP=1` (garde le jeu de test, pour mettre au point une spec), `E2E_S3_CHANNEL=chromium`. Les specs sont dans `e2e/tests/remote/` (`sprint3-<uc>.spec.ts`, dossier `support/`). Les traces, captures et fichiers téléchargés vont dans `e2e/test-results-remote*/`, `e2e/playwright-report-remote/` et `e2e/.remote-tmp/`, tous ignorés par git.

**Précautions** : ne lancer la suite que si les mots de passe sont saisis dans le terminal et non collés dans un fichier ; ne pas activer les traces globales de Playwright.

---

## 11. Conclusion sur le jalon 3

**Le jalon 3 « Admin back-office fonctionnel complet » n'est pas atteint** :

1. Trois défauts bloquants (A1, A2, A3), de cause racine unique, empêchent le chef de service de travailler normalement sur l'Admin et fragilisent la synchronisation hors ligne.
2. Deux UC critiques restent partiels sur des critères explicites du backlog : gestion des utilisateurs (A4, A5) et cycle de paiement (A10, A12).
3. La déconnexion PWA ne respecte pas le critère de purge des données sensibles (A6, A7).
4. La volumétrie « 600+ MOC » n'a pas pu être éprouvée sur le réel.

**Ce qui est acquis** : référentiels (sites, activités avec tarif versionné, MOC avec import Excel), correction de pointage avec motif et audit, bordereau, export MVola conforme aux règles métier (RG-03), audit complet, PWA installable, chiffrée, hors ligne, comptes inactifs et RBAC API corrects.

**Ordre de correction recommandé** : A1–A3 (une seule correction dans `prisma-rls.ts`) ; A4, A5 ; A6, A7 ; A8 ; puis les écarts de critères (A10, A12) à arbitrer avec le référent ALTERRA ; puis A9, A11, A13–A15. Après correction, rejouer la suite complète (`npm run test:remote`), de préférence avec `E2E_S3_SKIP_PAY=1` tant que les paiements de test ne sont pas purgés.
