import { z } from "zod";

const position = z.tuple([z.number(), z.number()]);
const linearRing = z.array(position).min(1);
const polygonCoordinates = z.array(linearRing).min(1);

/** GeoJSON Polygon ou MultiPolygon (trous = anneaux après le premier). */
export const geoPolygonSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("Polygon"),
      coordinates: polygonCoordinates,
    }),
    z.object({
      type: z.literal("MultiPolygon"),
      coordinates: z.array(polygonCoordinates).min(1),
    }),
  ])
  .nullable()
  .optional();

export type GeoPolygon = z.infer<typeof geoPolygonSchema>;

export function parseGeoPolygonInput(raw: string | null | undefined): GeoPolygon {
  if (raw == null || raw.trim() === "") return null;
  const parsed = JSON.parse(raw) as unknown;
  return geoPolygonSchema.parse(parsed);
}
