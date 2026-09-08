# Design: Import Excel MOC — auto-mapping, import partiel, feedback d’avancement

Date: 2026-09-08  
Statut: validé en brainstorming (choix utilisateur : fuzzy map B, import partiel A, progression C)

## Objectif

Améliorer le wizard d’import Excel MOC (`ImportDialog`) pour :

1. **Préremplir le mapping** des colonnes via alias + fuzzy matching sur les en-têtes.
2. **Importer les lignes valides** même si d’autres lignes du fichier sont en erreur.
3. **Afficher un état « Import en cours… »** puis un récap final (créés / mis à jour / erreurs ignorées), sans barre de progression réelle ni job async.

## Contexte actuel

- UI : `admin/src/components/workers/ImportDialog.tsx` (étapes upload → mapping → preview).
- API : `POST /workers/import/columns`, `POST /workers/import?dryRun=true|false` (`backend/src/routes/workers.routes.ts`).
- Parse / upsert : `backend/src/services/import/workers-import.service.ts`.
- Champs : `backend/src/services/import/worker-import-fields.ts`.
- Blocages : mapping 100 % manuel ; bouton Importer désactivé si `errors.length > 0` ; backend `422 IMPORT_VALIDATION_FAILED` si erreurs au commit.

## Décisions produit

| Sujet | Choix |
|---|---|
| Auto-map | Alias exacts + fuzzy (sous-chaîne / similarité) ; préremplissage éditable |
| Import partiel | Bouton « Importer les X lignes valides » dès qu’il y a ≥ 1 ligne OK ; erreurs listées au-dessus |
| Progression | Texte « Import en cours… » pendant la mutation ; récap à la fin (pas de % / SSE / job) |

## Architecture (approche retenue)

**Backend-first pour les suggestions de mapping** ; le front consomme et reste maître des corrections utilisateur.

```
Excel → POST /columns → { columns, fields, suggestedMapping }
     → utilisateur ajuste mapping
     → POST /import?dryRun=true → { valid, errors }
     → POST /import?dryRun=false → importe valid uniquement
         → { created, updated, skippedErrors, imported }
```

## Unités de design

### 1. Suggestions de mapping (backend)

**Fichiers**

- Étendre `detectWorkersImportColumns` / réponse de `POST /workers/import/columns`.
- Nouveau helper dédié (ex. `backend/src/services/import/suggest-column-mapping.ts`) pour garder le service lisible.
- Alias par champ dans ou à côté de `worker-import-fields.ts`.

**Comportement**

- Uniquement si `hasHeaderRow === true` ; sinon `suggestedMapping = {}`.
- Pour chaque champ ALTERRA, candidats = labels de colonnes détectées (non encore prises).
- Scoring :
  1. Match exact après normalisation (casse, accents, espaces) sur le label du champ ou un alias.
  2. Sinon fuzzy : inclusion / similarité (ex. Levenshtein normalisé) avec seuil minimal pour éviter les faux positifs.
- Une colonne → au plus un champ (premier meilleur score gagne ; pas de collision).
- Retour : `suggestedMapping: Partial<Record<fieldKey, columnLetter>>`.

**Alias (exemples, non exhaustifs)**

- `firstName` : prénom, prenom, first name, firstname  
- `lastName` : nom, nom de famille, last name, lastname  
- `mvolaNumber` : mvola, numéro mvola, num mvola, telephone, téléphone  
- `siteShortCode` : code site, site, shortcode, site code  
- `matricule` : matricule  
- `legacyMocId` : id moc, legacy, id historique  
- `hiredAt` : date embauche, date d'embauche, hired at  

### 2. Import partiel (backend + API)

**Fichiers**

- `workers.routes.ts` : retirer le `422` bloquant quand `preview.errors.length > 0` en mode commit.
- Réponse 201 enrichie : `skippedErrors: preview.errors.length` (et conserver `created` / `updated` / `imported`).
- Si `valid.length === 0` : `422` avec message clair (rien à importer), pas d’upsert vide « succès ».

**Comportement**

- `dryRun=true` inchangé (preview complet).
- `dryRun=false` : `importWorkersRows(preview.valid)` même si des erreurs existent.
- Audit log : inclure `skippedErrors` dans `after`.

### 3. UI wizard (frontend)

**Fichier** : `admin/src/components/workers/ImportDialog.tsx` (+ types dans `admin/src/lib/referentials.ts`).

**Mapping**

- Sur succès de `/columns`, initialiser `mapping` avec `suggestedMapping`.
- Si l’utilisateur change `hasHeaderRow` / ligne d’en-tête, recharger colonnes et réappliquer les suggestions.
- Les selects restent éditables ; aucune obligation d’accepter l’auto-map.

**Preview / import**

- Remplacer le disable `preview.errors.length > 0` par `preview.valid.length === 0`.
- Label du bouton : `Importer les {n} ligne(s) valide(s)`.
- Pendant `importMutation.isPending` : afficher « Import en cours… » (et désactiver les actions).
- Succès : toast / message avec créés, mis à jour, et nombre d’erreurs ignorées ; puis `onImported` + fermeture comme aujourd’hui.

## Hors scope

- Job async, SSE, barre de progression en %.
- Correction automatique des lignes en erreur.
- Changements sur l’import initial CLI (`import-initial-data`).

## Tests

- Unitaires : scoring alias exact, fuzzy, collision de colonnes, pas de suggestion sans en-tête.
- Route/intégration : commit avec mix valid+errors → 201 + `skippedErrors` ; zéro valid → 422.
- Régression : dryRun preview inchangé ; mapping manuel complet toujours supporté.

## Critères de succès

- Fichier avec en-têtes proches des libellés ALTERRA → champs obligatoires souvent préremplis sans action manuelle.
- Présence d’erreurs de lignes n’empêche plus l’import des lignes valides.
- L’utilisateur voit clairement « Import en cours… » puis le bilan créé / mis à jour / ignoré.
