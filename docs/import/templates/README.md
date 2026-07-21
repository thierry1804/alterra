# Templates import campagne ALTERRA

Fichiers générés par `npm run import:templates -w backend`.

| Fichier | Contenu |
| ------- | ------- |
| `sites.xlsx` | Sites (shortCode, name, location) |
| `activities.xlsx` | Activités et tarifs |
| `workers.xlsx` | MOC (matricule, MVola, site, équipe) |

## Import

```bash
npm run import:initial -w backend -- --dir docs/import/templates --dry-run
npm run import:initial -w backend -- --dir docs/import/templates
```

Ordre d'import : sites → activités → MOC. Le rapport JSON est archivé dans `docs/import/reports/` et MinIO (`rapports-pdf/imports/`).
