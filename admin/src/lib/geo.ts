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

/** GeoJSON stores [longitude, latitude]; Leaflet expects [latitude, longitude]. */
export function geoPolygonToLatLngs(polygon: GeoPolygon | null): [number, number][] {
  if (!polygon?.coordinates?.[0]?.length) return [];
  return polygon.coordinates[0].map(([lng, lat]) => [lat, lng]);
}

export function collectGeoBounds(
  sites: SiteGeo[],
  options: { siteId?: string; includeZones: boolean; includeParcels: boolean },
): [number, number][] {
  const points: [number, number][] = [];
  const visibleSites = options.siteId
    ? sites.filter((site) => site.id === options.siteId)
    : sites;

  visibleSites.forEach((site) => {
    if (site.geoLat != null && site.geoLng != null) {
      points.push([site.geoLat, site.geoLng]);
    }

    if (!options.includeZones && !options.includeParcels) return;

    site.zones.forEach((zone) => {
      if (options.includeZones) {
        points.push(...geoPolygonToLatLngs(zone.geoPolygon));
      }
      if (options.includeParcels) {
        zone.parcelles.forEach((parcel) => {
          points.push(...geoPolygonToLatLngs(parcel.geoPolygon));
        });
      }
    });
  });

  return points;
}
