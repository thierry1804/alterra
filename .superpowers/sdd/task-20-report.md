# Task 20 Report — Module BE-RPT : Rapports PDF hebdo

**Date :** 21 juillet 2026  
**Statut :** ✅ Complet

---

## Checklist

| Step | Item | Status |
| ---- | ---- | ------ |
| 1 | Job BullMQ génération PDF hebdo | ✅ |
| 2 | Templates Handlebars → HTML → Puppeteer PDF | ✅ |
| 3 | Stockage MinIO + notification email Admin | ✅ |

---

## Fichiers

| Fichier | Rôle |
| ------- | ---- |
| `jobs/pdf.worker.ts` | Queue BullMQ + worker + fallback sync (test) |
| `services/reports/weekly-data.service.ts` | Agrégation Prisma site/semaine |
| `services/reports/pdf-render.service.ts` | Handlebars + Puppeteer |
| `services/reports/weekly-pdf.service.ts` | Orchestration upload + email |
| `services/notifications/email.service.ts` | Mailgun ou mock log |
| `templates/weekly-report.hbs` | Rapport détaillé par jour/activité |
| `templates/weekly-invoice.hbs` | Facture récap paiements |
| `routes/reports.routes.ts` | POST generate + GET job status |

## API

| Méthode | Route | Rôle |
| ------- | ----- | ---- |
| POST | `/api/v1/reports/weekly/generate` | CDS, ADMIN |
| GET | `/api/v1/reports/weekly/jobs/:jobId` | CDS, ADMIN |

Body generate : `{ "weekIso": "2026-W29", "siteId?": "uuid" }` — CDS utilise son site JWT.

## Variables env

| Variable | Défaut | Description |
| -------- | ------ | ----------- |
| `PDF_WORKER_ENABLED` | `true` | Démarrer le worker BullMQ |
| `PDF_RENDERER` | — | `mock` force PDF stub (tests/CI) |
| `MAILGUN_*` | — | Notification Admin si configuré |
