# Task 37 — BE-DAILY + FE-PWA-CLOSE

**Module:** BE-DAILY — Rapport journalier  
**Branch:** feat/backlog-implementation  
**Date:** 2026-07-21

## Livrables

| Step | Statut | Détail |
|------|--------|--------|
| 1 — POST /reports/daily | ✅ | Agrégation jour, PDF Puppeteer, MinIO |
| 2 — UI clôture CDS | ✅ | `DailyClose.tsx`, preview, signature, confirmation |
| 3 — Envoi Admin | ✅ | Email `notifyAdminsDailyReportReady` |

## API

| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/reports/daily/preview?date=` | CDS, ADMIN |
| POST | `/reports/daily` | CDS, ADMIN |
| GET | `/reports/daily/jobs/:jobId` | CDS, ADMIN |

## Fichiers backend

- `routes/daily-reports.routes.ts`
- `services/reports/daily-data.service.ts`
- `services/reports/daily-pdf.service.ts`
- `templates/daily-report.hbs`
- Queue BullMQ `daily-pdf` dans `jobs/pdf.worker.ts`

## PWA

- Route `/daily-close` — nav « Clôture » (CDS)

## Tests

- `backend/src/__tests__/daily-pdf.test.ts` — 4 scénarios

## Suite

- **Task 38** — QA V2 E2E Playwright
