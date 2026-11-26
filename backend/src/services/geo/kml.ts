import type { GeoPolygon } from "../../lib/geo-json.js";

export interface KmlParcelFeature {
  /** Index du placemark dans le fichier, à partir de 1. */
  index: number;
  codeSite: string;
  codeParcelle: string;
  surfaceHa: number | null;
  geometry: NonNullable<GeoPolygon>;
}

function localTags(kml: string): string {
  return kml.replace(/<(\/?)[\w.-]+:/g, "<$1");
}

function parseCoordinateText(text: string): Array<[number, number]> {
  const ring: Array<[number, number]> = [];
  for (const token of text.trim().split(/\s+/)) {
    if (!token) continue;
    const [lngRaw, latRaw] = token.split(",");
    const lng = Number(lngRaw);
    const lat = Number(latRaw);
    if (Number.isFinite(lng) && Number.isFinite(lat)) ring.push([lng, lat]);
  }
  return ring;
}

function ringFromBoundary(block: string): Array<[number, number]> | null {
  const match = block.match(/<coordinates>([\s\S]*?)<\/coordinates>/i);
  if (!match) return null;
  const ring = parseCoordinateText(match[1]);
  return ring.length >= 3 ? ring : null;
}

function parsePolygon(block: string): Array<Array<[number, number]>> | null {
  const outerMatch = block.match(/<outerBoundaryIs>([\s\S]*?)<\/outerBoundaryIs>/i);
  const outer = outerMatch ? ringFromBoundary(outerMatch[1]) : ringFromBoundary(block);
  if (!outer) return null;
  const holes: Array<[number, number][]> = [];
  for (const inner of block.matchAll(/<innerBoundaryIs>([\s\S]*?)<\/innerBoundaryIs>/gi)) {
    const hole = ringFromBoundary(inner[1]);
    if (hole) holes.push(hole);
  }
  return [outer, ...holes];
}

function parseGeometry(block: string): NonNullable<GeoPolygon> | null {
  const polygons: Array<Array<[number, number][]>> = [];
  for (const match of block.matchAll(/<Polygon\b[^>]*>([\s\S]*?)<\/Polygon>/gi)) {
    const rings = parsePolygon(match[1]);
    if (rings) polygons.push(rings);
  }
  if (polygons.length === 0) return null;
  if (polygons.length === 1) return { type: "Polygon", coordinates: polygons[0] };
  return { type: "MultiPolygon", coordinates: polygons };
}

function simpleData(block: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const match of block.matchAll(
    /<SimpleData\s+name=["']([^"']+)["']\s*>([^<]*)<\/SimpleData>/gi,
  )) {
    fields[match[1].trim().toLowerCase()] = match[2].trim();
  }
  return fields;
}

function roundHectares(raw: string | undefined): number | null {
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

/** Lit les placemarks d'un KML (SchemaData QGIS / ArcGIS). L'altitude est ignorée. */
export function parseKmlParcels(kml: string): KmlParcelFeature[] {
  const xml = localTags(kml);
  const features: KmlParcelFeature[] = [];
  let index = 0;
  for (const match of xml.matchAll(/<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/gi)) {
    index += 1;
    const block = match[1];
    const geometry = parseGeometry(block);
    if (!geometry) continue;
    const fields = simpleData(block);
    features.push({
      index,
      codeSite: (fields.code_site ?? "").toUpperCase(),
      codeParcelle: (fields.code_parcelle ?? "").toUpperCase(),
      surfaceHa: roundHectares(fields.surface),
      geometry,
    });
  }
  return features;
}
