import { createRequire } from "node:module";
import { unzipSync } from "fflate";
import { ApiError } from "../../middleware/error-handler.js";
import { geoPolygonSchema, type GeoPolygon } from "../../lib/geo-json.js";
import type { KmlParcelFeature } from "./kml.js";

const require = createRequire(import.meta.url);
const shapefile = require("shapefile") as {
  read: (shp: Uint8Array, dbf?: Uint8Array) => Promise<{
    features: Array<{
      geometry: { type: string; coordinates: unknown } | null;
      properties: Record<string, unknown> | null;
    }>;
  }>;
};

function pair(point: unknown): [number, number] | null {
  if (!Array.isArray(point) || point.length < 2) return null;
  const lng = Number(point[0]);
  const lat = Number(point[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  return [lng, lat];
}

function asRing(raw: unknown): [number, number][] | null {
  if (!Array.isArray(raw)) return null;
  const points = raw.map(pair).filter((point): point is [number, number] => point !== null);
  return points.length >= 3 ? points : null;
}

function asGeometry(
  geometry: { type: string; coordinates: unknown } | null,
): NonNullable<GeoPolygon> | null {
  if (!geometry || !Array.isArray(geometry.coordinates)) return null;
  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates
      .map(asRing)
      .filter((ring): ring is [number, number][] => ring !== null);
    const parsed = geoPolygonSchema.safeParse({ type: "Polygon", coordinates: rings });
    return parsed.success && parsed.data ? parsed.data : null;
  }
  if (geometry.type === "MultiPolygon") {
    const polygons = geometry.coordinates
      .map((polygon) =>
        Array.isArray(polygon)
          ? polygon.map(asRing).filter((ring): ring is [number, number][] => ring !== null)
          : [],
      )
      .filter((rings) => rings.length > 0);
    if (polygons.length === 1) {
      const parsed = geoPolygonSchema.safeParse({ type: "Polygon", coordinates: polygons[0] });
      return parsed.success && parsed.data ? parsed.data : null;
    }
    const parsed = geoPolygonSchema.safeParse({ type: "MultiPolygon", coordinates: polygons });
    return parsed.success && parsed.data ? parsed.data : null;
  }
  return null;
}

function textProp(props: Record<string, unknown>, names: string[]): string {
  for (const [key, value] of Object.entries(props)) {
    const normalized = key.trim().toLowerCase();
    if (!names.includes(normalized)) continue;
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function surfaceProp(props: Record<string, unknown>): number | null {
  const raw = textProp(props, ["surface"]);
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

function parcelCode(props: Record<string, unknown>): string {
  const exact = textProp(props, ["code_parcelle"]);
  if (exact) return exact.toUpperCase();
  for (const [key, value] of Object.entries(props)) {
    const normalized = key.trim().toLowerCase();
    if (!normalized.startsWith("code_parce")) continue;
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text.toUpperCase();
  }
  return "";
}

/** Lit un zip contenant un shapefile (.shp + .dbf) aux champs code_site, code_parcelle, surface. */
export async function readShapefileZip(zip: Buffer): Promise<KmlParcelFeature[]> {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(new Uint8Array(zip));
  } catch {
    throw new ApiError(422, "INVALID_ZIP", "Le fichier n'est pas une archive zip");
  }
  const shpName = Object.keys(files).find((name) => name.toLowerCase().endsWith(".shp"));
  const dbfName = Object.keys(files).find((name) => name.toLowerCase().endsWith(".dbf"));
  if (!shpName || !dbfName) {
    throw new ApiError(422, "MISSING_SHP", "L'archive doit contenir un .shp et un .dbf");
  }

  const collection = await shapefile.read(files[shpName], files[dbfName]);
  const features: KmlParcelFeature[] = [];
  collection.features.forEach((feature, offset) => {
    const geometry = asGeometry(feature.geometry);
    if (!geometry) return;
    const props = feature.properties ?? {};
    features.push({
      index: offset + 1,
      codeSite: textProp(props, ["code_site"]).toUpperCase(),
      codeParcelle: parcelCode(props),
      surfaceHa: surfaceProp(props),
      geometry,
    });
  });
  return features;
}
