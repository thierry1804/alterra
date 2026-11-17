import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { SYSTEM_ROLE_IDS } from "../services/access/system-roles.js";

const SITE = "00000000-0000-4000-8000-000000000010";
const OTHER_SITE = "00000000-0000-4000-8000-000000000011";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    zone: { findMany: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    parcelle: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    site: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../lib/prisma-base.js", () => ({
  basePrisma: { auditLog: { create: vi.fn() } },
}));

import { prisma } from "../lib/prisma.js";
import { basePrisma } from "../lib/prisma-base.js";

function header(roleId: string, siteId: string | null) {
  return `Bearer ${signAccessToken({
    sub: "00000000-0000-4000-8000-0000000000f1",
    roleId,
    siteId,
    teamId: null,
  })}`;
}

describe("zones and parcels are limited to the caller's site", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.zone.findMany).mockResolvedValue([]);
    vi.mocked(prisma.parcelle.findMany).mockResolvedValue([]);
  });

  it("lets a team chief read the zones of its own site only", async () => {
    const own = await request(createApp())
      .get("/api/v1/zones")
      .set("Authorization", header(SYSTEM_ROLE_IDS.CHEF_EQUIPE, SITE));
    expect(own.status).toBe(200);
    expect(prisma.zone.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { siteId: SITE } }),
    );

    vi.mocked(prisma.zone.findMany).mockClear();
    const other = await request(createApp())
      .get("/api/v1/zones")
      .query({ siteId: OTHER_SITE })
      .set("Authorization", header(SYSTEM_ROLE_IDS.CHEF_EQUIPE, SITE));
    expect(other.body.data).toEqual([]);
    expect(prisma.zone.findMany).not.toHaveBeenCalled();
  });

  it("limits the parcels the same way and keeps all sites for the administrator", async () => {
    await request(createApp())
      .get("/api/v1/parcels")
      .set("Authorization", header(SYSTEM_ROLE_IDS.CHEF_SERVICE, SITE));
    expect(prisma.parcelle.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { zone: { siteId: SITE } } }),
    );

    await request(createApp())
      .get("/api/v1/parcels")
      .set("Authorization", header(SYSTEM_ROLE_IDS.ADMIN, null));
    expect(prisma.parcelle.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it("answers 404 for a zone or a parcel of another site", async () => {
    vi.mocked(prisma.zone.findUnique).mockResolvedValue({
      id: "z",
      siteId: OTHER_SITE,
      parcelles: [],
    } as never);
    const zone = await request(createApp())
      .get("/api/v1/zones/00000000-0000-4000-8000-0000000000e1")
      .set("Authorization", header(SYSTEM_ROLE_IDS.CHEF_EQUIPE, SITE));
    expect(zone.status).toBe(404);

    vi.mocked(prisma.parcelle.findUnique).mockResolvedValue({
      id: "p",
      zone: { siteId: OTHER_SITE },
    } as never);
    const parcel = await request(createApp())
      .get("/api/v1/parcels/00000000-0000-4000-8000-0000000000e2")
      .set("Authorization", header(SYSTEM_ROLE_IDS.CHEF_EQUIPE, SITE));
    expect(parcel.status).toBe(404);
  });
});

describe("parcel CSV import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(basePrisma.auditLog.create).mockResolvedValue({ id: BigInt(1) } as never);
    vi.mocked(prisma.site.findMany).mockResolvedValue([{ id: SITE, shortCode: "MNK" }] as never);
    vi.mocked(prisma.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) =>
      fn(prisma)) as never);
    vi.mocked(prisma.zone.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.zone.create).mockResolvedValue({ id: "zone-1" } as never);
    vi.mocked(prisma.parcelle.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.parcelle.create).mockResolvedValue({ id: "p" } as never);
  });

  const csv =
    "site;zone;code;nom;type\nMNK;Zone A;A1;Parcelle A1;parcelle\nMNK;Zone A;PEP;Pépinière;pépinière";

  async function send(body: object, roleId: string = SYSTEM_ROLE_IDS.ADMIN) {
    return request(createApp())
      .post("/api/v1/parcels/import")
      .set("Authorization", header(roleId, null))
      .send(body);
  }

  it("previews without saving and reports the counts", async () => {
    const res = await send({ csv, dryRun: true });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        dryRun: true,
        rows: 2,
        zonesCreated: 1,
        parcellesCreated: 2,
        errors: [],
      }),
    );
    expect(basePrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("creates the zone once and the nursery as a parcelle of kind PEPINIERE", async () => {
    const res = await send({ csv });

    expect(res.status).toBe(200);
    expect(prisma.zone.create).toHaveBeenCalledTimes(1);
    expect(prisma.parcelle.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ code: "PEP", kind: "PEPINIERE", name: "Pépinière" }),
    });
    expect(basePrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: "IMPORT" }) }),
    );
  });

  it("reports unknown sites and bad kinds by line and writes nothing", async () => {
    const res = await send({
      csv: "site;zone;code;nom;type\nXXX;Zone A;A1;P1;parcelle\nMNK;Zone A;A2;P2;marais",
    });

    expect(res.status).toBe(200);
    expect(res.body.errors).toEqual([
      { line: 2, message: "Site inconnu : « XXX »" },
      { line: 3, message: "Type inconnu : « marais » (parcelle ou pépinière)" },
    ]);
    expect(basePrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("keeps the import to the roles that can write zones and parcels", async () => {
    const res = await send({ csv }, SYSTEM_ROLE_IDS.CHEF_SERVICE);
    expect(res.status).toBe(403);
  });
});
