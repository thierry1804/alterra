import { z } from "zod";

/** GeoJSON Polygon minimal pour zones et parcelles. */
export const geoPolygonSchema = z
  .object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))).min(1),
  })
  .nullable()
  .optional();

export type GeoPolygon = z.infer<typeof geoPolygonSchema>;

export function parseGeoPolygonInput(raw: string | null | undefined): GeoPolygon {
  if (raw == null || raw.trim() === "") return null;
  const parsed = JSON.parse(raw) as unknown;
  return geoPolygonSchema.parse(parsed);
}
