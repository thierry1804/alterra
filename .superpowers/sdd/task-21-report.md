# Task 21 Report — Module OPS-DATA : Migration initiale

**Date :** 21 juillet 2026  
**Statut :** ✅ Complet

---

## Checklist

| Step | Item | Status |
| ---- | ---- | ------ |
| 1 | Templates Excel sites, activités, MOC | ✅ |
| 2 | Script import avec validation métier | ✅ |
| 3 | Rapport d'import archivé (local + MinIO) | ✅ |

---

## Fichiers

| Fichier | Rôle |
| ------- | ---- |
| `scripts/import-initial-data.ts` | CLI import campagne |
| `scripts/generate-import-templates.ts` | Génère les templates Excel |
| `docs/import/templates/*.xlsx` | Fichiers modèles ALTERRA |
| `services/import/sites-import.service.ts` | Parse + upsert sites |
| `services/import/activities-import.service.ts` | Parse + create activités |
| `services/import/workers-initial-import.service.ts` | Parse MOC par shortCode/teamName |
| `services/import/initial-import.service.ts` | Orchestration atomique |
| `services/import/import-report.service.ts` | Archive JSON |

## Usage

```bash
npm run import:templates -w backend
npm run import:initial -w backend -- --dir docs/import/templates --dry-run
npm run import:initial -w backend -- --dir docs/import/templates
```

Import **atomique** : si une erreur est détectée sur l'un des 3 fichiers, aucune écriture n'est effectuée.

Rapports : `docs/import/reports/import-*.json` + MinIO `rapports-pdf/imports/`.
