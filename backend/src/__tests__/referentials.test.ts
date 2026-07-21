import { Prisma, Role } from "@prisma/client";
import ExcelJS from "exceljs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { resetRedisForTests, getRedis } from "../lib/redis.js";
import {
  applyActivityRateChange,
  ratesEqual,
  yesterdayUtc,
} from "../services/activities/activity-version.service.js";
import { parseWorkersWorkbook } from "../services/import/workers-import.service.js";

const MOCK_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";
const MOCK_ACTIVITY_ID = "00000000-0000-4000-8000-000000000020";
const MOCK_USER_TARGET_ID = "00000000-0000-4000-8000-000000000030";

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

  it("RG-04: applyActivityRateChange closes previous row and creates new version", async () => {
    const newActivity = {
      ...mockActivity,
      id: "00000000-0000-4000-8000-000000000021",
      unitRate: new Prisma.Decimal("175.00"),
      validFrom: new Date(),
    };

    vi.mocked(prisma.activity.update).mockResolvedValue({
      ...mockActivity,
      validTo: yesterdayUtc(),
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
