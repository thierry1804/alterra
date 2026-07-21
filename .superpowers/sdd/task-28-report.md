# Task 28 — BE-GEO / FE-ADM-GEO

**Module:** BE-GEO — Zone / Parcelle  
**Branch:** feat/backlog-implementation  
**Date:** 2026-07-21

## Livrables

| Step | Statut | Détail |
|------|--------|--------|
| 1 — Modèle Prisma | ✅ | Déjà en schema + migration init |
| 2 — FK Pointage.parcelleId | ✅ | Déjà en schema |
| 3 — CRUD API + GET /sites/geo | ✅ | 5 endpoints zone + 5 parcelle + geo |
| 4 — UI Admin hiérarchique + GeoJSON | ✅ | `admin/src/pages/Zones.tsx` |

## API

| Méthode | Route | Rôle |
|---------|-------|------|
| GET | `/zones?siteId=` | ADMIN |
| GET | `/zones/:id` | ADMIN |
| POST | `/zones` | ADMIN |
| PATCH | `/zones/:id` | ADMIN |
| DELETE | `/zones/:id` | ADMIN |
| GET | `/parcels?zoneId=&siteId=` | ADMIN |
| GET | `/parcels/:id` | ADMIN |
| POST | `/parcels` | ADMIN |
| PATCH | `/parcels/:id` | ADMIN |
| DELETE | `/parcels/:id` | ADMIN |
| GET | `/sites/geo` | ADMIN |

## Tests

`backend/src/__tests__/geo.test.ts` — zones, parcels, sites/geo.

## UI

- Navigation **Zones** (`/zones`)
- Table expandable Site → Zone → Parcelle
- Éditeur GeoJSON (textarea + exemple)

Carte Leaflet : Task 36 (`/map`).
