import { describe, expect, it } from "vitest";
import type { SiteGeo } from "./geo";
import { countParcels, EMPTY_PARCEL_FILTER, filterSiteParcels } from "./parcel-map-filter";

const sites: SiteGeo[] = [
  {
    id: "s1",
    name: "Manankazo",
    shortCode: "MNK",
    geoLat: -18,
    geoLng: 47,
    zones: [
      {
        id: "z1",
        name: "Parcelles plantées",
        code: null,
        geoPolygon: null,
        parcelles: [
          {
            id: "p1",
            name: "P1001",
            code: "P1001",
            kind: "PARCELLE",
            surfaceHa: "1.57",
            geoPolygon: null,
          },
          {
            id: "p2",
            name: "P1002",
            code: "P1002",
            kind: "PARCELLE",
            surfaceHa: "12.00",
            geoPolygon: null,
          },
          {
            id: "p3",
            name: "Pepinière nord",
            code: "PEP",
            kind: "PEPINIERE",
            surfaceHa: "0.40",
            geoPolygon: null,
          },
        ],
      },
    ],
  },
];

describe("filtre des parcelles sur la carte", () => {
  it("laisse tout passer quand aucun critère n'est saisi", () => {
    expect(filterSiteParcels(sites, EMPTY_PARCEL_FILTER)).toBe(sites);
    expect(countParcels(sites)).toBe(3);
  });

  it("filtre par code, nom ou zone", () => {
    const found = filterSiteParcels(sites, { ...EMPTY_PARCEL_FILTER, query: "p1001" });
    expect(countParcels(found)).toBe(1);
    expect(found[0].zones[0].parcelles[0].code).toBe("P1001");

    const byZone = filterSiteParcels(sites, { ...EMPTY_PARCEL_FILTER, query: "plantées" });
    expect(countParcels(byZone)).toBe(3);
  });

  it("filtre par surface, virgule comprise, et ignore une surface inconnue", () => {
    const found = filterSiteParcels(sites, {
      ...EMPTY_PARCEL_FILTER,
      surfaceMin: "1,5",
      surfaceMax: "10",
    });
    expect(found[0].zones[0].parcelles.map((parcel) => parcel.code)).toEqual(["P1001"]);
  });

  it("filtre par type", () => {
    const found = filterSiteParcels(sites, { ...EMPTY_PARCEL_FILTER, kind: "PEPINIERE" });
    expect(found[0].zones[0].parcelles.map((parcel) => parcel.code)).toEqual(["PEP"]);
  });
});
