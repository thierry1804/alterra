export interface GeoPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface Zone {
  id: string;
  siteId: string;
  name: string;
  geoPolygon: GeoPolygon | null;
  createdAt: string;
  _count?: { parcelles: number };
}

export interface Parcelle {
  id: string;
  zoneId: string;
  name: string;
  surfaceHa: string | null;
  geoPolygon: GeoPolygon | null;
  zone?: { id: string; name: string; siteId: string };
}

export interface SiteGeo {
  id: string;
  name: string;
  shortCode: string;
  geoLat: number | null;
  geoLng: number | null;
  zones: Array<{
    id: string;
    name: string;
    geoPolygon: GeoPolygon | null;
    parcelles: Array<{
      id: string;
      name: string;
      surfaceHa: string | null;
      geoPolygon: GeoPolygon | null;
    }>;
  }>;
}

export const EXAMPLE_GEO_POLYGON = `{
  "type": "Polygon",
  "coordinates": [[[47.52, -18.91], [47.53, -18.91], [47.53, -18.90], [47.52, -18.90], [47.52, -18.91]]]
}`;
