import { Prisma, Role } from "@prisma/client";
import ExcelJS from "exceljs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { blockUser, resetRedisForTests, getRedis } from "../lib/redis.js";
import {
  applyActivityRateChange,
  computeRateChangeDates,
  ratesEqual,
  startOfUtcDay,
} from "../services/activities/activity-version.service.js";
import { parseWorkersWorkbook } from "../services/import/workers-import.service.js";

const MOCK_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";
const MOCK_ACTIVITY_ID = "00000000-0000-4000-8000-000000000020";
const MOCK_USER_TARGET_ID = "00000000-0000-4000-8000-000000000030";
const MOCK_BLOCKED_USER_ID = "00000000-0000-4000-8000-000000000099";

const mockActivity = {
  id: MOCK_ACTIVITY_ID,
  label: "Plantation",
  unit: "plant",
  unitRate: new Prisma.Decimal("150.00"),
  validFrom: new Date("2026-01-01"),
  validTo: null,
  siteId: MOCK_SITE_ID,
  active: true,
  createdAt: new Date(),
};

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    site: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    team: {
      findMany: vi.fn(),
    },
    activity: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    worker: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../lib/prisma-base.js", () => ({
  basePrisma: {
    refreshToken: {
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../services/storage/presigned-url.service.js", () => ({
  workerPhotoUploadUrl: vi.fn().mockResolvedValue({
    uploadUrl: "https://minio.local/upload",
    photoKey: "workers/x/photo.jpg",
  }),
}));

import { prisma } from "../lib/prisma.js";
import { basePrisma } from "../lib/prisma-base.js";

function adminAuthHeader() {
  return `Bearer ${signAccessToken({
    sub: MOCK_ADMIN_ID,
    role: Role.ADMIN,
    siteId: MOCK_SITE_ID,
    teamId: null,
  })}`;
}

function blockedUserAuthHeader() {
  return `Bearer ${signAccessToken({
    sub: MOCK_BLOCKED_USER_ID,
    role: Role.CDS,
    siteId: MOCK_SITE_ID,
    teamId: null,
  })}`;
}

async function buildImportBuffer(rows: Record<string, string>[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("workers");
  const headers = [
    "matricule",
    "firstName",
    "lastName",
    "mvolaNumber",
    "siteId",
    "hiredAt",
    "status",
  ];
  sheet.addRow(headers);
  for (const row of rows) {
    sheet.addRow(headers.map((h) => row[h] ?? ""));
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

describe("referentials module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      typeof fn === "function" ? fn(prisma as never) : fn,
    );
    vi.mocked(basePrisma.refreshToken.updateMany).mockResolvedValue({ count: 2 });
    vi.mocked(basePrisma.auditLog.create).mockResolvedValue({ id: BigInt(1) } as never);
    vi.mocked(prisma.site.findMany).mockResolvedValue([{ id: MOCK_SITE_ID }] as never);
    vi.mocked(prisma.team.findMany).mockResolvedValue([]);
    vi.mocked(prisma.worker.findMany).mockResolvedValue([]);
  });

  afterEach(async () => {
    await resetRedisForTests();
  });

  it("POST /sites rejects invalid payload with 422", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/sites")
      .set("Authorization", adminAuthHeader())
      .send({ name: "X" });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(prisma.site.create).not.toHaveBeenCalled();
  });

  it("POST /sites rejects invalid shortCode format with 422", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/sites")
      .set("Authorization", adminAuthHeader())
      .send({ name: "Manakara", shortCode: "mnk" });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(prisma.site.create).not.toHaveBeenCalled();
  });

  it("returns 401 when blocked user calls protected route", async () => {
    await blockUser(MOCK_BLOCKED_USER_ID);

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/sites")
      .set("Authorization", blockedUserAuthHeader());

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("USER_BLOCKED");
  });

  it("RG-04: applyActivityRateChange closes previous row and creates new version", async () => {
    const newActivity = {
      ...mockActivity,
      id: "00000000-0000-4000-8000-000000000021",
      unitRate: new Prisma.Decimal("175.00"),
      validFrom: startOfUtcDay(),
    };

    vi.mocked(prisma.activity.update).mockResolvedValue({
      ...mockActivity,
      validTo: new Date("2026-07-20"),
      active: false,
    });
    vi.mocked(prisma.activity.create).mockResolvedValue(newActivity);

    const result = await applyActivityRateChange(mockActivity, 175);

    expect(prisma.activity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MOCK_ACTIVITY_ID },
        data: expect.objectContaining({ active: false, validTo: expect.any(Date) }),
      }),
    );
    expect(prisma.activity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          label: "Plantation",
          unit: "plant",
          siteId: MOCK_SITE_ID,
          unitRate: 175,
          active: true,
        }),
      }),
    );
    expect(result.unitRate.toString()).toBe("175");
  });

  it("RG-04: same-day validFrom closes at validFrom and opens next day", () => {
    const today = startOfUtcDay(new Date("2026-07-21"));
    const { closeDate, openDate } = computeRateChangeDates(today, today);

    expect(closeDate.getTime()).toBe(today.getTime());
    expect(openDate.getUTCDate()).toBe(22);
  });

  it("ratesEqual compares decimal values", () => {
    expect(ratesEqual("150.00", "150")).toBe(true);
    expect(ratesEqual("150.00", "151")).toBe(false);
  });

  it("import dry-run returns errors for invalid row", async () => {
    const buffer = await buildImportBuffer([
      {
        matricule: "",
        firstName: "Jean",
        lastName: "Rakoto",
        mvolaNumber: "123",
        siteId: "not-a-uuid",
        hiredAt: "bad-date",
        status: "ACTIVE",
      },
    ]);

    const preview = await parseWorkersWorkbook(buffer);

    expect(preview.valid).toHaveLength(0);
    expect(preview.errors.length).toBeGreaterThan(0);
    expect(preview.errors.some((e) => e.field === "matricule")).toBe(true);
    expect(preview.errors.some((e) => e.field === "siteId")).toBe(true);
  });

  it("import dry-run detects duplicate matricule in file", async () => {
    const buffer = await buildImportBuffer([
      {
        matricule: "MOC-001",
        firstName: "Jean",
        lastName: "Rakoto",
        mvolaNumber: "0340000001",
        siteId: MOCK_SITE_ID,
        hiredAt: "2026-01-15",
        status: "ACTIVE",
      },
      {
        matricule: "MOC-001",
        firstName: "Paul",
        lastName: "Rabe",
        mvolaNumber: "0340000002",
        siteId: MOCK_SITE_ID,
        hiredAt: "2026-01-16",
        status: "ACTIVE",
      },
    ]);

    const preview = await parseWorkersWorkbook(buffer);

    expect(preview.valid).toHaveLength(0);
    expect(preview.errors.some((e) => e.field === "matricule" && e.message.includes("dupliqué"))).toBe(
      true,
    );
  });

  it("import dry-run detects matricule already in database", async () => {
    vi.mocked(prisma.worker.findMany).mockResolvedValue([
      { matricule: "MOC-EXIST", mvolaNumber: "0349999999" },
    ] as never);

    const buffer = await buildImportBuffer([
      {
        matricule: "MOC-EXIST",
        firstName: "Jean",
        lastName: "Rakoto",
        mvolaNumber: "0340000001",
        siteId: MOCK_SITE_ID,
        hiredAt: "2026-01-15",
        status: "ACTIVE",
      },
    ]);

    const preview = await parseWorkersWorkbook(buffer);

    expect(preview.valid).toHaveLength(0);
    expect(preview.errors.some((e) => e.field === "matricule" && e.message.includes("base"))).toBe(
      true,
    );
  });

  it("POST /workers/import?dryRun=true returns preview errors", async () => {
    const buffer = await buildImportBuffer([
      {
        matricule: "",
        firstName: "Jean",
        lastName: "Rakoto",
        mvolaNumber: "0340000000",
        siteId: MOCK_SITE_ID,
        hiredAt: "2026-01-15",
        status: "ACTIVE",
      },
    ]);

    const app = createApp();
    const res = await request(app)
      .post("/api/v1/workers/import?dryRun=true")
      .set("Authorization", adminAuthHeader())
      .send({ contentBase64: buffer.toString("base64") });

    expect(res.status).toBe(200);
    expect(res.body.errors.length).toBeGreaterThan(0);
  });

  it("POST /users/:id/reset-password revokes refresh tokens and blocks user briefly", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: MOCK_USER_TARGET_ID,
      active: true,
      deletedAt: null,
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: MOCK_USER_TARGET_ID,
    } as never);

    const app = createApp();
    const res = await request(app)
      .post(`/api/v1/users/${MOCK_USER_TARGET_ID}/reset-password`)
      .set("Authorization", adminAuthHeader());

    expect(res.status).toBe(200);
    expect(basePrisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: MOCK_USER_TARGET_ID, revokedAt: null },
      }),
    );

    const redis = await getRedis();
    expect(await redis.get(`user:blocked:${MOCK_USER_TARGET_ID}`)).toBe("1");
  });

  it("POST /users/:id/deactivate revokes refresh tokens and blocks user in Redis", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: MOCK_USER_TARGET_ID,
      active: true,
      deletedAt: null,
    } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({
      id: MOCK_USER_TARGET_ID,
      active: false,
    } as never);

    const app = createApp();
    const res = await request(app)
      .post(`/api/v1/users/${MOCK_USER_TARGET_ID}/deactivate`)
      .set("Authorization", adminAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.active).toBe(false);
    expect(basePrisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: MOCK_USER_TARGET_ID, revokedAt: null },
      }),
    );

    const redis = await getRedis();
    expect(await redis.get(`user:blocked:${MOCK_USER_TARGET_ID}`)).toBe("1");
  });
});
