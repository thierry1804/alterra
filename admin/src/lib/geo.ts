export interface GeoPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

export interface Zone {
  id: string;
  siteId: string;
  name: string;
  code: string | null;
  geoPolygon: GeoPolygon | null;
  createdAt: string;
  _count?: { parcelles: number };
}

export interface Parcelle {
  id: string;
  zoneId: string;
  name: string;
  code: string | null;
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
    code: string | null;
    geoPolygon: GeoPolygon | null;
    parcelles: Array<{
      id: string;
      name: string;
      code: string | null;
      surfaceHa: string | null;
      geoPolygon: GeoPolygon | null;
    }>;
  }>;
}

/** GeoJSON stores [longitude, latitude]; Leaflet expects [latitude, longitude]. */
export function geoPolygonToLatLngs(polygon: GeoPolygon | null): [number, number][] {
  if (!polygon?.coordinates?.[0]?.length) return [];
  return polygon.coordinates[0].map(([lng, lat]) => [lat, lng]);
}

/** Centroïde approximatif (moyenne des sommets) du premier anneau, en [lat, lng]. */
export function geoPolygonCenter(polygon: GeoPolygon | null): [number, number] | null {
  const ring = polygon?.coordinates?.[0];
  if (!ring?.length) return null;
  const [sumLat, sumLng] = ring.reduce(
    ([lat, lng], [pointLng, pointLat]) => [lat + pointLat, lng + pointLng],
    [0, 0],
  );
  return [sumLat / ring.length, sumLng / ring.length];
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
