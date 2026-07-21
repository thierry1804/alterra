import { Prisma, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { resetRedisForTests } from "../lib/redis.js";

const MOCK_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";
const MOCK_ZONE_ID = "00000000-0000-4000-8000-000000000050";
const MOCK_PARCEL_ID = "00000000-0000-4000-8000-000000000051";

const samplePolygon = {
  type: "Polygon" as const,
  coordinates: [
    [
      [47.52, -18.91],
      [47.53, -18.91],
      [47.53, -18.9],
      [47.52, -18.9],
      [47.52, -18.91],
    ],
  ],
};

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    site: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    zone: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    parcelle: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("../lib/prisma-base.js", () => ({
  basePrisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../services/audit/audit.service.js", () => ({
  writeAuditLog: vi.fn(),
}));

import { prisma } from "../lib/prisma.js";

function adminToken() {
  return signAccessToken({
    sub: MOCK_ADMIN_ID,
    role: Role.ADMIN,
    siteId: null,
    teamId: null,
  });
}

describe("geo routes (zones, parcels, sites/geo)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRedisForTests();
  });

  it("GET /zones requires admin", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/api/v1/zones")
      .set("Authorization", `Bearer ${adminToken()}`);
    expect(res.status).toBe(200);
    expect(prisma.zone.findMany).toHaveBeenCalled();
  });

  it("POST /zones creates zone with geoPolygon", async () => {
    vi.mocked(prisma.site.findUnique).mockResolvedValue({
      id: MOCK_SITE_ID,
      name: "MNK",
      shortCode: "MNK",
      location: null,
      geoLat: null,
      geoLng: null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    vi.mocked(prisma.zone.create).mockResolvedValue({
      id: MOCK_ZONE_ID,
      siteId: MOCK_SITE_ID,
      name: "Zone Nord",
      geoPolygon: samplePolygon,
      createdAt: new Date(),
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/v1/zones")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ siteId: MOCK_SITE_ID, name: "Zone Nord", geoPolygon: samplePolygon });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Zone Nord");
  });

  it("GET /sites/geo returns hierarchical geo data", async () => {
    vi.mocked(prisma.site.findMany).mockResolvedValue([
      {
        id: MOCK_SITE_ID,
        name: "Manankazo",
        shortCode: "MNK",
        geoLat: -18.9,
        geoLng: 47.5,
        zones: [
          {
            id: MOCK_ZONE_ID,
            name: "Zone Nord",
            geoPolygon: samplePolygon,
            parcelles: [
              {
                id: MOCK_PARCEL_ID,
                name: "A-01",
                surfaceHa: new Prisma.Decimal("12.5"),
                geoPolygon: samplePolygon,
              },
            ],
          },
        ],
      },
    ] as never);

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/sites/geo")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].zones[0].parcelles).toHaveLength(1);
  });

  it("POST /parcels creates parcelle", async () => {
    vi.mocked(prisma.zone.findUnique).mockResolvedValue({
      id: MOCK_ZONE_ID,
      siteId: MOCK_SITE_ID,
      name: "Zone Nord",
      geoPolygon: null,
      createdAt: new Date(),
    });
    vi.mocked(prisma.parcelle.create).mockResolvedValue({
      id: MOCK_PARCEL_ID,
      zoneId: MOCK_ZONE_ID,
      name: "A-01",
      surfaceHa: new Prisma.Decimal("12.5"),
      geoPolygon: samplePolygon,
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/v1/parcels")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({
        zoneId: MOCK_ZONE_ID,
        name: "A-01",
        surfaceHa: 12.5,
        geoPolygon: samplePolygon,
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("A-01");
  });
});
