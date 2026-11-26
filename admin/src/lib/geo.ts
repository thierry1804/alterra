export type GeoPolygon =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

function polygonParts(geometry: GeoPolygon): number[][][][] {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
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

export type ParcelleKind = "PARCELLE" | "PEPINIERE";

export interface Parcelle {
  id: string;
  kind: ParcelleKind;
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
      kind?: ParcelleKind;
      surfaceHa: string | null;
      geoPolygon: GeoPolygon | null;
    }>;
  }>;
}

/** GeoJSON stores [longitude, latitude]; Leaflet expects [latitude, longitude]. */
export function geoPolygonToLatLngs(polygon: GeoPolygon | null): [number, number][] {
  if (!polygon) return [];
  const points: [number, number][] = [];
  for (const rings of polygonParts(polygon)) {
    const outer = rings[0];
    if (!outer) continue;
    for (const [lng, lat] of outer) points.push([lat, lng]);
  }
  return points;
}

/**
 * Un polygone Leaflet par partie : premier anneau = contour, les suivants = trous.
 * Coordonnées [lat, lng].
 */
export function geoGeometryToLeaflet(polygon: GeoPolygon | null): [number, number][][][] | null {
  if (!polygon) return null;
  const parts = polygonParts(polygon)
    .map((rings) =>
      rings
        .filter((ring) => ring.length >= 3)
        .map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])),
    )
    .filter((rings) => rings.length > 0 && rings[0].length >= 3);
  return parts.length > 0 ? parts : null;
}

/** Centroïde approximatif (moyenne des sommets) du premier anneau, en [lat, lng]. */
export function geoPolygonCenter(polygon: GeoPolygon | null): [number, number] | null {
  const ring = polygon ? polygonParts(polygon)[0]?.[0] : undefined;
  if (!ring?.length) return null;
  const [sumLat, sumLng] = ring.reduce(
    ([lat, lng], [pointLng, pointLat]) => [lat + pointLat, lng + pointLng],
    [0, 0],
  );
  return [sumLat / ring.length, sumLng / ring.length];
}

export function collectGeoBounds(
  sites: SiteGeo[],
  options: {
    siteId?: string;
    includeZones: boolean;
    includeParcels: boolean;
    includeSitePoint?: boolean;
  },
): [number, number][] {
  const points: [number, number][] = [];
  const visibleSites = options.siteId ? sites.filter((site) => site.id === options.siteId) : sites;
  const includeSitePoint = options.includeSitePoint !== false;

  visibleSites.forEach((site) => {
    if (includeSitePoint && site.geoLat != null && site.geoLng != null) {
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
