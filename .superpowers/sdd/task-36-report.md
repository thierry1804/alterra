# Task 36 — FE-ADMIN-MAP

**Module:** FE-ADMIN-MAP — Cartographie Leaflet  
**Branch:** feat/backlog-implementation  
**Date:** 2026-07-21

## Livrables

| Step | Statut | Détail |
|------|--------|--------|
| 1 — Leaflet + tuiles | ✅ | OSM par défaut, MapTiler si `VITE_MAPTILER_KEY` |
| 2 — Marqueurs sites | ✅ | CircleMarker + popup nom/code/stats |
| 3 — Couches zones/parcelles | ✅ | Polygones GeoJSON activables, popups |

## Fichiers

- `admin/src/pages/Map.tsx` — filtres site/couches, panneau latéral
- `admin/src/components/map/SiteMap.tsx` — carte react-leaflet
- `admin/src/lib/geo.ts` — helpers `geoPolygonToLatLngs`, `collectGeoBounds`
- Route `/map`, nav « Carte »
- Dépendances : `leaflet`, `react-leaflet@4`, `@types/leaflet`

## API

- `GET /sites/geo` (existant Task geo) — sites actifs + zones + parcelles

## Configuration

- Tuiles OSM sans clé
- Optionnel : `VITE_MAPTILER_KEY` dans `.env` admin pour MapTiler Streets

## Suite

- **Task 37** — BE-DAILY rapport journalier + clôture CDS PWA
