import { zipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { importParcelFeatures } from "../services/geo/parcel-geo-import.service.js";
import { parseKmlParcels } from "../services/geo/kml.js";
import { readShapefileZip } from "../services/geo/shp.js";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    site: { findMany: vi.fn() },
    zone: { findFirst: vi.fn(), create: vi.fn() },
    parcelle: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../services/audit/audit.service.js", () => ({
  writeAuditLog: vi.fn(),
}));

import { prisma } from "../lib/prisma.js";
import { writeAuditLog } from "../services/audit/audit.service.js";

const RING = "47.1,-18.1,0 47.2,-18.1,0 47.2,-18.2,0 47.1,-18.1,0";

function kml(codes: string[]): string {
  const marks = codes
    .map(
      (code) => `<Placemark>
        <ExtendedData><SchemaData>
          <SimpleData name="code_site">MNK</SimpleData>
          <SimpleData name="code_parcelle">${code}</SimpleData>
          <SimpleData name="surface">1.25</SimpleData>
        </SchemaData></ExtendedData>
        <Polygon><outerBoundaryIs><LinearRing><coordinates>${RING}</coordinates></LinearRing></outerBoundaryIs></Polygon>
      </Placemark>`,
    )
    .join("");
  return `<kml><Document><Folder>${marks}</Folder></Document></kml>`.replace(
    "Placemark>",
    `Placemark id="${codes[0]}">`,
  );
}

function i32le(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32LE(value);
  return buffer;
}

function i32be(value: number): Buffer {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32BE(value);
  return buffer;
}

function f64le(value: number): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeDoubleLE(value);
  return buffer;
}

function polygonShp(points: Array<[number, number]>): Buffer {
  const xs = points.map((point) => point[0]);
  const ys = points.map((point) => point[1]);
  const xmin = Math.min(...xs);
  const ymin = Math.min(...ys);
  const xmax = Math.max(...xs);
  const ymax = Math.max(...ys);
  const content = Buffer.concat([
    i32le(5),
    f64le(xmin),
    f64le(ymin),
    f64le(xmax),
    f64le(ymax),
    i32le(1),
    i32le(points.length),
    i32le(0),
    ...points.flatMap(([x, y]) => [f64le(x), f64le(y)]),
  ]);
  const header = Buffer.alloc(100);
  header.writeInt32BE(9994, 0);
  header.writeInt32BE((100 + 8 + content.length) / 2, 24);
  header.writeInt32LE(1000, 28);
  header.writeInt32LE(5, 32);
  header.writeDoubleLE(xmin, 36);
  header.writeDoubleLE(ymin, 44);
  header.writeDoubleLE(xmax, 52);
  header.writeDoubleLE(ymax, 60);
  return Buffer.concat([header, i32be(1), i32be(content.length / 2), content]);
}

function fieldDesc(name: string, type: string, length: number, decimals = 0): Buffer {
  const buffer = Buffer.alloc(32);
  buffer.write(name, 0, "ascii");
  buffer.write(type, 11, "ascii");
  buffer.writeUInt8(length, 16);
  buffer.writeUInt8(decimals, 17);
  return buffer;
}

function sampleZip(): Buffer {
  const shp = polygonShp([
    [47.1, -18.1],
    [47.2, -18.1],
    [47.2, -18.2],
    [47.1, -18.1],
  ]);
  const fields = [
    fieldDesc("code_site", "C", 8),
    fieldDesc("code_parce", "C", 10),
    fieldDesc("surface", "N", 12, 2),
  ];
  const header = Buffer.alloc(32);
  header.writeUInt8(0x03, 0);
  header.writeUInt32LE(1, 4);
  header.writeUInt16LE(32 + 32 * fields.length + 1, 8);
  header.writeUInt16LE(1 + 8 + 10 + 12, 10);
  const record = Buffer.concat([
    Buffer.from([0x20]),
    Buffer.from("MNK".padEnd(8, " ")),
    Buffer.from("P1001".padEnd(10, " ")),
    Buffer.from("1.50".padStart(12, " ")),
  ]);
  const dbf = Buffer.concat([header, ...fields, Buffer.from([0x0d]), record]);
  return Buffer.from(
    zipSync({
      "parcelles.shp": new Uint8Array(shp),
      "parcelles.dbf": new Uint8Array(dbf),
    }),
  );
}

describe("importParcelFeatures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.site.findMany).mockResolvedValue([{ id: "site-mnk", shortCode: "MNK" }] as never);
    vi.mocked(prisma.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) =>
      fn(prisma)) as never);
    vi.mocked(prisma.zone.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.zone.create).mockResolvedValue({ id: "zone-1" } as never);
    vi.mocked(prisma.parcelle.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.parcelle.create).mockResolvedValue({ id: "p" } as never);
  });

  it("creates the planted zone and keeps the first geometry of a duplicated code", async () => {
    const features = parseKmlParcels(kml(["P1001", "P1002", "P1002"]));
    const result = await importParcelFeatures(features, { dryRun: false, userId: "user-1" });

    expect(result.parcellesCreated).toBe(2);
    expect(result.zonesCreated).toBe(1);
    expect(result.errors).toEqual([
      expect.objectContaining({
        message: expect.stringContaining("P1002"),
      }),
    ]);
    expect(prisma.zone.create).toHaveBeenCalledWith({
      data: { siteId: "site-mnk", name: "Parcelles plantées" },
    });
    expect(prisma.parcelle.create).toHaveBeenCalledTimes(2);
    expect(writeAuditLog).toHaveBeenCalled();
  });

  it("refuses the file when the site code is unknown", async () => {
    const features = parseKmlParcels(kml(["P1001"]).replace("MNK", "ZZZ"));
    await expect(importParcelFeatures(features, { dryRun: true, userId: "user-1" })).rejects.toMatchObject({
      status: 422,
      code: "UNKNOWN_SITE",
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("updates an existing parcel contour", async () => {
    vi.mocked(prisma.zone.findFirst).mockResolvedValue({ id: "zone-1" } as never);
    vi.mocked(prisma.parcelle.findFirst).mockResolvedValue({ id: "existing" } as never);

    const result = await importParcelFeatures(parseKmlParcels(kml(["P1001"])), {
      dryRun: false,
      userId: "user-1",
    });

    expect(result.parcellesUpdated).toBe(1);
    expect(result.parcellesCreated).toBe(0);
    expect(prisma.parcelle.update).toHaveBeenCalledWith({
      where: { id: "existing" },
      data: expect.objectContaining({ code: "P1001", geoPolygon: expect.any(Object) }),
    });
  });
});

describe("readShapefileZip", () => {
  it("reads code_site, the truncated parcel code and the surface", async () => {
    const features = await readShapefileZip(sampleZip());
    expect(features).toHaveLength(1);
    expect(features[0]).toMatchObject({
      codeSite: "MNK",
      codeParcelle: "P1001",
      surfaceHa: 1.5,
      geometry: { type: "Polygon" },
    });
  });
});
