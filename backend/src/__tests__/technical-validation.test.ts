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
import {
  aggregateSynthesis,
  type SynthesisActivityInfo,
  type SynthesisSiteInfo,
  type SynthesisSourceRow,
} from "../services/pointages/synthesis.service.js";

vi.mock("../lib/prisma.js", () => {
  const db = {
    pointage: { findMany: vi.fn(), updateMany: vi.fn() },
    site: { findMany: vi.fn() },
    biometricCheck: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  };
  return { prisma: db, basePrisma: db };
});
vi.mock("../lib/prisma-base.js", () => ({ basePrisma: { auditLog: { create: vi.fn() } } }));

import { prisma } from "../lib/prisma.js";
import { basePrisma as auditClient } from "../lib/prisma-base.js";

const TECHNICAL_ROLE_ID = "00000000-0000-4000-8000-0000000000c1";
const MASKED_ROLE_ID = "00000000-0000-4000-8000-0000000000c2";
const SITE_ID = "00000000-0000-4000-8000-000000000010";
const OTHER_SITE_ID = "00000000-0000-4000-8000-000000000011";
const ACTIVITY_ID = "00000000-0000-4000-8000-000000000020";
const WORKER_A = "00000000-0000-4000-8000-0000000000a1";
const WORKER_B = "00000000-0000-4000-8000-0000000000a2";

function customRole(roleId: string, permissions: string[]): RoleAccess {
  return {
    roleId,
    roleName: "Test",
    scope: "TOUS",
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

function header(roleId: string, sub = "00000000-0000-4000-8000-000000000001") {
  return `Bearer ${signAccessToken({ sub, roleId, siteId: null, teamId: null })}`;
}

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

function row(overrides: Partial<SynthesisSourceRow> = {}): SynthesisSourceRow {
  return {
    date: day("2026-11-17"),
    workerId: WORKER_A,
    siteId: SITE_ID,
    subActivityId: ACTIVITY_ID,
    quantity: "10",
    amount: "4000",
    status: "VALIDATED",
    technicalValidatedAt: null,
    ...overrides,
  };
}

const activities = new Map<string, SynthesisActivityInfo>([
  [
    ACTIVITY_ID,
    { label: "Trouaison 40cm x 40cm", categoryLabel: "Préparation du sol", unit: "trou" },
  ],
]);
const sites = new Map<string, SynthesisSiteInfo>([
  [SITE_ID, { code: "MNK", name: "Manankazo" }],
  [OTHER_SITE_ID, { code: "ANT", name: "Antsampanana" }],
]);

describe("aggregateSynthesis", () => {
  it("counts distinct people, sums quantity and cost per week, site and activity", () => {
    const result = aggregateSynthesis(
      [
        row(),
        row({ date: day("2026-11-18"), quantity: "5.5", amount: "2200.50" }),
        row({ workerId: WORKER_B, quantity: "4", amount: "1600" }),
      ],
      activities,
      sites,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      weekIso: "2026-W47",
      siteCode: "MNK",
      activityLabel: "Trouaison 40cm x 40cm",
      unit: "trou",
      people: 2,
      pointages: 3,
      quantity: 19.5,
      cost: 7800.5,
    });
  });

  it("splits the status buckets and keeps rejected pointages out of the totals", () => {
    const [summary] = aggregateSynthesis(
      [
        row({ status: "PENDING" }),
        row({ status: "NEEDS_CLARIFICATION", workerId: WORKER_B }),
        row({ status: "VALIDATED" }),
        row({ status: "VALIDATED", technicalValidatedAt: day("2026-11-19") }),
        row({ status: "REJECTED", amount: "99999", quantity: "99" }),
      ],
      activities,
      sites,
    );

    expect(summary).toMatchObject({
      pendingSite: 2,
      toValidate: 1,
      validatedTechnical: 1,
      rejected: 1,
      pointages: 4,
      cost: 16000,
      quantity: 40,
    });
  });

  it("puts Sunday in the ISO week that started on the previous Monday", () => {
    const result = aggregateSynthesis(
      [row({ date: day("2026-11-22") }), row({ date: day("2026-11-23") })],
      activities,
      sites,
    );

    expect(result.map((entry) => entry.weekIso)).toEqual(["2026-W48", "2026-W47"]);
  });

  it("separates sites and sorts recent weeks first, then site, then activity", () => {
    const result = aggregateSynthesis(
      [row({ date: day("2026-11-10") }), row({ siteId: OTHER_SITE_ID }), row()],
      activities,
      sites,
    );

    expect(result.map((entry) => `${entry.weekIso} ${entry.siteCode}`)).toEqual([
      "2026-W47 ANT",
      "2026-W47 MNK",
      "2026-W46 MNK",
    ]);
  });
});

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

  it("returns the synthesis for the requested weeks", async () => {
    vi.mocked(prisma.pointage.findMany).mockResolvedValue([
      {
        date: day("2026-11-17"),
        workerId: WORKER_A,
        subActivityId: ACTIVITY_ID,
        quantity: "10",
        amount: "4000",
        status: "VALIDATED",
        technicalValidatedAt: null,
        worker: { siteId: SITE_ID },
        subActivity: {
          label: "Trouaison 40cm x 40cm",
          unit: { label: "trou" },
          category: { label: "Préparation du sol" },
        },
      },
    ] as never);

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
        people: 1,
        cost: 4000,
        toValidate: 1,
      }),
    ]);
    expect(prisma.pointage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { date: { gte: day("2026-11-09"), lte: day("2026-11-22") } },
      }),
    );
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
