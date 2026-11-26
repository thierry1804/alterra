import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportParcelsGeoJson } from "../services/geo/parcel-geo-export.service.js";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    site: { findUnique: vi.fn() },
    parcelle: { findMany: vi.fn() },
  },
}));

import { prisma } from "../lib/prisma.js";

describe("exportParcelsGeoJson", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes the client code, activity, worker count and dates", async () => {
    vi.mocked(prisma.site.findUnique).mockResolvedValue({ shortCode: "MNK" } as never);
    vi.mocked(prisma.parcelle.findMany).mockResolvedValue([
      {
        code: "P1001",
        name: "P1001",
        surfaceHa: new Prisma.Decimal("1.50"),
        geoPolygon: {
          type: "Polygon",
          coordinates: [
            [
              [47.1, -18.1],
              [47.2, -18.1],
              [47.2, -18.2],
              [47.1, -18.1],
            ],
          ],
        },
        pointages: [
          {
            workerId: "w1",
            date: new Date("2026-03-02T00:00:00.000Z"),
            subActivity: { label: "Trouaison" },
          },
          {
            workerId: "w1",
            date: new Date("2026-03-10T00:00:00.000Z"),
            subActivity: { label: "Trouaison" },
          },
          {
            workerId: "w2",
            date: new Date("2026-03-04T00:00:00.000Z"),
            subActivity: { label: "Sarclage" },
          },
        ],
      },
    ] as never);

    const exported = await exportParcelsGeoJson("site-mnk");
    const body = JSON.parse(exported.body) as {
      features: Array<{ properties: Record<string, unknown> }>;
    };

    expect(exported.filename).toBe("parcelles_MNK.geojson");
    expect(body.features[0].properties).toEqual({
      code_parcelle: "P1001",
      code_site: "MNK",
      surface: 1.5,
      activites: "Sarclage, Trouaison",
      nb_travailleurs: 2,
      date_min: "2026-03-02",
      date_max: "2026-03-10",
    });
    expect(prisma.parcelle.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          pointages: expect.objectContaining({
            where: { status: { not: "REJECTED" } },
          }),
        }),
      }),
    );
  });
});
