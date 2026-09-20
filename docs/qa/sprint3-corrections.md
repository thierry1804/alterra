# Corrections de la recette du Sprint 3

Suite à `sprint3-rapport-recette-demo.md` (20/09/2026). Chaque anomalie est renvoyée à sa correction et à son test.

| Anomalie | Correction | Test |
|---|---|---|
| A1, A2, A3 — 500 des rôles à portée (`/me`, rejeu de synchro, validation) | `mergeUniqueWhere` (`middleware/prisma-rls.ts`) : la portée est ajoutée dans `AND` sans masquer la clé unique du `where` | `rls-unique.test.ts` (client Prisma réel, lecture seule) |
| A4 — création d'utilisateur, doublons | `password` n'est plus transmis à Prisma ; `errorHandler` traduit P2002 en 409 `DUPLICATE`, P2025 en 404, `RlsScopeError` en 403 | `payments`/`auth` inchangés, `rls-unique.test.ts` |
| A5 — compte bloqué 15 min après réinitialisation | `invalidateTokensIssuedBefore` : seuls les jetons émis avant la réinitialisation sont refusés (`TOKEN_REVOKED`) ; le compte n'est plus bloqué | `token-revocation.test.ts`, `referentials.test.ts` |
| A6 — « Se déconnecter » sans révocation | `POST /auth/logout` n'exige plus de jeton d'accès (le cookie de rafraîchissement suffit) | `auth.test.ts` |
| A7 — pas de purge locale | `purgeLocalData()` (PWA) à la déconnexion : référentiels, pointages synchronisés, gabarits, cache d'API. Les saisies non envoyées et la file de synchronisation sont conservées | — |
| A8 — numéro MVola | `03[48]` + 7 chiffres exigé à la création, à la modification et à l'import (les 313 MOC actifs respectent déjà ce format) | `referentials.test.ts` |
| A9 — états vides/erreur | `QueryError` / `TableQueryError` sur Sites, Activités, MOC, Utilisateurs, Pointages, Audit, Rapports, Paiements ; état vide de Sites | recette Playwright |
| A10 — export MVola | 5 colonnes de la spécification par défaut ; `MVOLA_EXPORT_FORMAT=compact3` rétablit les 3 colonnes si MVola refuse les colonnes internes | `payments.test.ts` |
| A11 — fichier non Excel | signature `.xlsx` / `.xls` vérifiée, sinon 422 `IMPORT_BADFORMAT` | `mvola-releve-parser.test.ts` |
| A12 — import et rapports | aperçu avant écriture (`dryRun`, bouton « Confirmer et enregistrer »), `PATCH /payments/:id/fail` (statut `FAILED` avec motif), statut de rapprochement et référence dans le bordereau, historique des exports (`GET /payments/exports`), export « PDF » réellement en PDF (contenu échappé) | `report-export-pdf.test.ts` |
| A14 — période sans année | colonne `Payment.referenceYear` (migration `20260920140000_payment_reference_year`, rétro-remplie depuis `createdAt`), utilisée par le verrou de période, la génération, l'export (filtre `referenceYear`), le rapprochement (clé année:semaine, `weekKey`) et la liste | `mvola-reconciliation.test.ts`, `payments.test.ts`, recette `sprint3-zz-year-scope.spec.ts` |
| A15 — N+1 | `GET /pointages` inclut le MOC ; l'écran ne fait plus un `GET /workers/:id` par ligne | — |

A13 (nom « RAKOTO ») est un réglage de l'application (Paramètres), pas un défaut de code.

## Mise en service

```bash
./infra/scripts/deploy-dev.sh   # migration, prisma generate, build des frontends, redémarrage
```

La migration est additive (colonne nullable + index) : les anciennes versions du code continuent de fonctionner pendant le déploiement.
