import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { setRoleAccessLoader, type RoleAccess } from "../services/access/access.service.js";
import {
  SYSTEM_ROLES,
  SYSTEM_ROLE_IDS,
  systemRolePermissions,
} from "../services/access/system-roles.js";

vi.mock("../lib/prisma.js", () => {
  const db = {
    pointage: { findMany: vi.fn(), updateMany: vi.fn() },
    site: { findMany: vi.fn() },
    activityCategory: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
    biometricCheck: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  };
  return { prisma: db, basePrisma: db };
});
vi.mock("../lib/prisma-base.js", () => ({ basePrisma: { auditLog: { create: vi.fn() } } }));

import { prisma } from "../lib/prisma.js";
import { basePrisma as auditClient } from "../lib/prisma-base.js";

const TECHNICAL_ROLE_ID = "00000000-0000-4000-8000-0000000000c1";
const SITE_ROLE_ID = "00000000-0000-4000-8000-0000000000c3";
const MASKED_ROLE_ID = "00000000-0000-4000-8000-0000000000c2";
const SITE_ID = "00000000-0000-4000-8000-000000000010";
const OTHER_SITE_ID = "00000000-0000-4000-8000-000000000011";
const ACTIVITY_ID = "00000000-0000-4000-8000-000000000020";
const WORKER_A = "00000000-0000-4000-8000-0000000000a1";

function customRole(
  roleId: string,
  permissions: string[],
  scope: RoleAccess["scope"] = "TOUS",
): RoleAccess {
  return {
    roleId,
    roleName: "Test",
    scope,
    mfaRequired: false,
    permissions: new Set(permissions),
  };
}

function useRoles(...extra: RoleAccess[]) {
  setRoleAccessLoader(async (roleId) => {
    const custom = extra.find((entry) => entry.roleId === roleId);
    if (custom) return custom;
    const role = SYSTEM_ROLES.find((entry) => entry.id === roleId);
    if (!role) return null;
    return {
      roleId,
      roleName: role.name,
      scope: role.scope,
      mfaRequired: role.mfaRequired,
      permissions: systemRolePermissions(roleId),
    };
  });
}

function header(
  roleId: string,
  sub = "00000000-0000-4000-8000-000000000001",
  siteId: string | null = null,
  teamId: string | null = null,
) {
  return `Bearer ${signAccessToken({ sub, roleId, siteId, teamId })}`;
}

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("technical validation routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRoles(
      customRole(TECHNICAL_ROLE_ID, [
        "pointage:lecture",
        "pointage:valider_technique",
        "pointage:synthese",
      ]),
      customRole(MASKED_ROLE_ID, ["pointage:lecture"]),
    );
    vi.mocked(prisma.site.findMany).mockResolvedValue([
      { id: SITE_ID, shortCode: "MNK", name: "Manankazo" },
    ] as never);
  });

  it("validates every site-validated pointage of a week, site and activity", async () => {
    vi.mocked(prisma.pointage.updateMany).mockResolvedValue({ count: 7 });

    const res = await request(createApp())
      .post("/api/v1/pointages/validate-technical")
      .set("Authorization", header(TECHNICAL_ROLE_ID))
      .send({ weekIso: "2026-W47", siteId: SITE_ID, subActivityId: ACTIVITY_ID });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ validated: 7 });
    expect(prisma.pointage.updateMany).toHaveBeenCalledWith({
      where: {
        status: "VALIDATED",
        technicalValidatedAt: null,
        date: { gte: day("2026-11-16"), lte: day("2026-11-22") },
        worker: { siteId: SITE_ID },
        subActivityId: ACTIVITY_ID,
      },
      data: {
        technicalValidatedAt: expect.any(Date),
        technicalValidatedById: "00000000-0000-4000-8000-000000000001",
      },
    });
    expect(auditClient.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "TECHNICAL_VALIDATION",
        after: { weekIso: "2026-W47", siteId: SITE_ID, subActivityId: ACTIVITY_ID, validated: 7 },
      }),
    });
  });

  it("refuses a role without the technical validation permission", async () => {
    const res = await request(createApp())
      .post("/api/v1/pointages/validate-technical")
      .set("Authorization", header(SYSTEM_ROLE_IDS.CHEF_SERVICE))
      .send({ weekIso: "2026-W47" });

    expect(res.status).toBe(403);
    expect(res.body.details).toEqual({ missingPermissions: ["pointage:valider_technique"] });
    expect(prisma.pointage.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a malformed week", async () => {
    const res = await request(createApp())
      .post("/api/v1/pointages/validate-technical")
      .set("Authorization", header(TECHNICAL_ROLE_ID))
      .send({ weekIso: "S47" });

    expect(res.status).toBe(422);
    expect(prisma.pointage.updateMany).not.toHaveBeenCalled();
  });

  const lotRecord = {
    week_iso: "2026-W47",
    site_id: SITE_ID,
    sub_id: ACTIVITY_ID,
    site_code: "MNK",
    site_name: "Manankazo",
    activity_label: "Trouaison 40cm x 40cm",
    category_label: "Préparation du sol",
    unit_label: "trou",
    people: 2,
    quantity: "19.5",
    cost: "7800.5",
    pointages: 3,
    pending_site: 1,
    to_validate: 2,
    validated_technical: 0,
    rejected: 0,
  };
  const summaryRecord = {
    lots_to_validate: 1,
    lots_pending_site: 1,
    lots_validated: 0,
    lots_all: 1,
    cost: "7800.5",
    pending_site: BigInt(1),
    to_validate: BigInt(2),
    validated_technical: BigInt(0),
  };

  function sqlValues(call: unknown[]): unknown[] {
    const flatten = (value: unknown): unknown[] =>
      value && typeof value === "object" && "values" in value
        ? (value as { values: unknown[] }).values.flatMap(flatten)
        : [value];
    return call.slice(1).flatMap(flatten);
  }

  function mockSynthesisQueries(rows: unknown[] = [lotRecord]) {
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce(rows as never)
      .mockResolvedValueOnce([summaryRecord] as never);
    vi.mocked(prisma.activityCategory.findMany).mockResolvedValue([
      { id: "cat-1", label: "Préparation du sol" },
    ] as never);
  }

  it("returns the synthesis with counts, totals and categories", async () => {
    mockSynthesisQueries();

    const res = await request(createApp())
      .get("/api/v1/pointages/synthese")
      .query({ weekFrom: "2026-W46", weekTo: "2026-W47" })
      .set("Authorization", header(TECHNICAL_ROLE_ID));

    expect(res.status).toBe(200);
    expect(res.body.weekFrom).toBe("2026-W46");
    expect(res.body.rows).toEqual([
      expect.objectContaining({
        weekIso: "2026-W47",
        siteCode: "MNK",
        unit: "trou",
        people: 2,
        quantity: 19.5,
        cost: 7800.5,
        toValidate: 2,
      }),
    ]);
    expect(res.body.counts).toEqual({ TO_VALIDATE: 1, PENDING_SITE: 1, VALIDATED: 0, ALL: 1 });
    expect(res.body.totals).toEqual({
      cost: 7800.5,
      pendingSite: 1,
      toValidate: 2,
      validatedTechnical: 0,
    });
    expect(res.body.categories).toEqual([{ id: "cat-1", label: "Préparation du sol" }]);
    expect(res.body.hasMore).toBe(false);
    expect(res.body.nextOffset).toBeNull();
    expect(prisma.pointage.findMany).not.toHaveBeenCalled();
  });

  it("pages the lots with an offset", async () => {
    mockSynthesisQueries([lotRecord, lotRecord, lotRecord]);

    const res = await request(createApp())
      .get("/api/v1/pointages/synthese")
      .query({ take: 2, offset: 4 })
      .set("Authorization", header(TECHNICAL_ROLE_ID));

    expect(res.body.rows).toHaveLength(2);
    expect(res.body.hasMore).toBe(true);
    expect(res.body.nextOffset).toBe(6);
    const values = sqlValues(vi.mocked(prisma.$queryRaw).mock.calls[0]);
    expect(values).toContain(3);
    expect(values).toContain(4);
  });

  it("always applies the site scope of the user, on top of the site asked for", async () => {
    useRoles(customRole(SITE_ROLE_ID, ["pointage:lecture", "pointage:synthese"], "SITE"));
    mockSynthesisQueries();

    const res = await request(createApp())
      .get("/api/v1/pointages/synthese")
      .query({ siteId: OTHER_SITE_ID })
      .set("Authorization", header(SITE_ROLE_ID, undefined, SITE_ID));

    expect(res.status).toBe(200);
    const values = sqlValues(vi.mocked(prisma.$queryRaw).mock.calls[0]);
    expect(values.filter((value) => value === SITE_ID)).toHaveLength(1);
    expect(values.filter((value) => value === OTHER_SITE_ID)).toHaveLength(1);
  });

  it("answers an empty synthesis, without querying, to a scoped user who has no site", async () => {
    useRoles(customRole(SITE_ROLE_ID, ["pointage:lecture", "pointage:synthese"], "SITE"));

    const res = await request(createApp())
      .get("/api/v1/pointages/synthese")
      .set("Authorization", header(SITE_ROLE_ID));

    expect(res.status).toBe(200);
    expect(res.body.rows).toEqual([]);
    expect(res.body.counts.ALL).toBe(0);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("refuses the synthesis to a role without the permission", async () => {
    const res = await request(createApp())
      .get("/api/v1/pointages/synthese")
      .set("Authorization", header(SYSTEM_ROLE_IDS.CHEF_EQUIPE));

    expect(res.status).toBe(403);
  });

  it("refuses a period longer than 26 weeks and a reversed period", async () => {
    const tooLong = await request(createApp())
      .get("/api/v1/pointages/synthese")
      .query({ weekFrom: "2026-W01", weekTo: "2026-W47" })
      .set("Authorization", header(TECHNICAL_ROLE_ID));
    const reversed = await request(createApp())
      .get("/api/v1/pointages/synthese")
      .query({ weekFrom: "2026-W47", weekTo: "2026-W40" })
      .set("Authorization", header(TECHNICAL_ROLE_ID));

    expect(tooLong.body.code).toBe("PERIOD_TOO_LONG");
    expect(reversed.body.code).toBe("INVALID_PERIOD");
  });
});

describe("pointage amounts", () => {
  const listed = {
    id: "00000000-0000-4000-8000-0000000000e1",
    workerId: WORKER_A,
    subActivityId: ACTIVITY_ID,
    quantity: "10",
    unitRateSnapshot: "400",
    amount: "4000",
    date: day("2026-11-17"),
    status: "VALIDATED",
    enteredById: "00000000-0000-4000-8000-0000000000b1",
    worker: { id: WORKER_A },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useRoles(customRole(MASKED_ROLE_ID, ["pointage:lecture"]));
    vi.mocked(prisma.pointage.findMany).mockResolvedValue([listed] as never);
    vi.mocked(prisma.biometricCheck.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
  });

  it("hides amounts and rates from a role without pointage:voir_montants", async () => {
    const res = await request(createApp())
      .get("/api/v1/pointages")
      .set("Authorization", header(MASKED_ROLE_ID));

    expect(res.status).toBe(200);
    expect(res.body.data[0]).toMatchObject({ id: listed.id, quantity: "10" });
    expect(res.body.data[0]).not.toHaveProperty("amount");
    expect(res.body.data[0]).not.toHaveProperty("unitRateSnapshot");
  });

  it("does not let a masked role sort by the hidden amount", async () => {
    await request(createApp())
      .get("/api/v1/pointages")
      .query({ orderBy: "amount", dir: "desc" })
      .set("Authorization", header(MASKED_ROLE_ID));

    expect(prisma.pointage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
  });

  it("keeps amounts for the roles that see them today", async () => {
    const res = await request(createApp())
      .get("/api/v1/pointages")
      .set("Authorization", header(SYSTEM_ROLE_IDS.CHEF_SERVICE));

    expect(res.body.data[0]).toMatchObject({ amount: "4000", unitRateSnapshot: "400" });
  });
});
