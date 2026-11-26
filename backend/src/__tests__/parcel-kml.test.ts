import { describe, expect, it } from "vitest";
import { geoPolygonSchema } from "../lib/geo-json.js";
import { parseKmlParcels } from "../services/geo/kml.js";

const RING = "47.1,-18.1,0 47.2,-18.1,0 47.2,-18.2,0 47.1,-18.1,0";
const HOLE = "47.12,-18.12,0 47.13,-18.12,0 47.13,-18.13,0 47.12,-18.12,0";
const RING_B = "47.3,-18.1 47.4,-18.1 47.4,-18.2 47.3,-18.1";

const KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<Folder><name>parcelle_plantee</name>
<Placemark id="parcelle_plantee.1">
  <ExtendedData><SchemaData schemaUrl="#parcelle_plantee">
    <SimpleData name="code_site">MNK</SimpleData>
    <SimpleData name="code_parcelle">P1001</SimpleData>
    <SimpleData name="surface">1.569</SimpleData>
  </SchemaData></ExtendedData>
  <MultiGeometry>
    <Polygon>
      <outerBoundaryIs><LinearRing><coordinates>${RING}</coordinates></LinearRing></outerBoundaryIs>
      <innerBoundaryIs><LinearRing><coordinates>${HOLE}</coordinates></LinearRing></innerBoundaryIs>
    </Polygon>
  </MultiGeometry>
</Placemark>
<Placemark id="parcelle_plantee.2">
  <ExtendedData><SchemaData schemaUrl="#parcelle_plantee">
    <SimpleData name="code_site">MNK</SimpleData>
    <SimpleData name="code_parcelle">P1002</SimpleData>
    <SimpleData name="surface">2</SimpleData>
  </SchemaData></ExtendedData>
  <MultiGeometry>
    <Polygon><outerBoundaryIs><LinearRing><coordinates>${RING}</coordinates></LinearRing></outerBoundaryIs></Polygon>
    <Polygon><outerBoundaryIs><LinearRing><coordinates>${RING_B}</coordinates></LinearRing></outerBoundaryIs></Polygon>
  </MultiGeometry>
</Placemark>
<Placemark id="parcelle_plantee.3">
  <ExtendedData><SchemaData schemaUrl="#parcelle_plantee">
    <SimpleData name="code_site">MNK</SimpleData>
    <SimpleData name="code_parcelle">P1002</SimpleData>
    <SimpleData name="surface">3</SimpleData>
  </SchemaData></ExtendedData>
  <Polygon><outerBoundaryIs><LinearRing><coordinates>${RING}</coordinates></LinearRing></outerBoundaryIs></Polygon>
</Placemark>
</Folder>
</Document>
</kml>`;

describe("geoPolygonSchema", () => {
  it("accepts a polygon with a hole and a multipolygon", () => {
    const withHole = geoPolygonSchema.parse({
      type: "Polygon",
      coordinates: [
        [
          [47.1, -18.1],
          [47.2, -18.1],
          [47.2, -18.2],
          [47.1, -18.1],
        ],
        [
          [47.12, -18.12],
          [47.13, -18.12],
          [47.13, -18.13],
          [47.12, -18.12],
        ],
      ],
    });
    expect(withHole?.type).toBe("Polygon");
    expect(withHole && withHole.type === "Polygon" ? withHole.coordinates : []).toHaveLength(2);

    const multi = geoPolygonSchema.parse({
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [47.1, -18.1],
            [47.2, -18.1],
            [47.2, -18.2],
            [47.1, -18.1],
          ],
        ],
        [
          [
            [47.3, -18.1],
            [47.4, -18.1],
            [47.4, -18.2],
            [47.3, -18.1],
          ],
        ],
      ],
    });
    expect(multi?.type).toBe("MultiPolygon");
  });
});

describe("parseKmlParcels", () => {
  it("reads client codes, surface and rings, and drops altitude", () => {
    const features = parseKmlParcels(KML);

    expect(features).toHaveLength(3);
    expect(features[0]).toMatchObject({
      codeSite: "MNK",
      codeParcelle: "P1001",
      surfaceHa: 1.57,
    });
    expect(features[0].geometry).toEqual({
      type: "Polygon",
      coordinates: [
        [
          [47.1, -18.1],
          [47.2, -18.1],
          [47.2, -18.2],
          [47.1, -18.1],
        ],
        [
          [47.12, -18.12],
          [47.13, -18.12],
          [47.13, -18.13],
          [47.12, -18.12],
        ],
      ],
    });
    expect(features[1].geometry.type).toBe("MultiPolygon");
    expect(features[1].codeParcelle).toBe("P1002");
    expect(features[2].codeParcelle).toBe("P1002");
    expect(features[2].geometry.type).toBe("Polygon");
  });
});
