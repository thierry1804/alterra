import ExcelJS from "exceljs";
import { PaymentCycle, PaymentStatus, Prisma, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { buildMvolaDescription } from "../services/payments/mvola-description.js";
import { resolvePeriod } from "../lib/period-iso.js";

const MOCK_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_WORKER_ID = "00000000-0000-4000-8000-000000000040";
const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";
const MOCK_PAYMENT_ID = "00000000-0000-4000-8000-000000000080";

const mockWorker = {
  id: MOCK_WORKER_ID,
  matricule: "MOC-001",
  firstName: "Rakoto",
  lastName: "Jean",
  birthDate: null,
  maritalStatus: null,
  childrenCount: null,
  mvolaNumber: "0341234567",
  cinNumber: null,
  photoKey: null,
  siteId: MOCK_SITE_ID,
  site: {
    id: MOCK_SITE_ID,
    name: "Manakara",
    shortCode: "MNK",
    location: null,
    geoLat: null,
    geoLng: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  teamId: null,
  status: "ACTIVE",
  hiredAt: new Date("2026-01-01"),
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const mockPayment = {
  id: MOCK_PAYMENT_ID,
  workerId: MOCK_WORKER_ID,
  periodIso: "S29",
  cycle: PaymentCycle.WEEKLY,
  amount: new Prisma.Decimal("125000"),
  description: "Rakoto Paiement MNK",
  bioValid: true,
  status: PaymentStatus.PENDING,
  exportedAt: null,
  paidAt: null,
  failureReason: null,
  correctionReason: null,
  originalAmount: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  worker: mockWorker,
};

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    payment: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    pointage: {
      findMany: vi.fn(),
    },
    biometricCheck: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("../lib/prisma-base.js", () => ({
  basePrisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../services/storage/minio.js", () => ({
  minioClient: {
    putObject: vi.fn().mockResolvedValue(undefined),
  },
  BUCKETS: { reports: "rapports-pdf" },
}));

import { prisma } from "../lib/prisma.js";
import { basePrisma } from "../lib/prisma-base.js";
import { minioClient } from "../services/storage/minio.js";

function adminAuthHeader() {
  return `Bearer ${signAccessToken({
    sub: MOCK_ADMIN_ID,
    role: Role.ADMIN,
    siteId: null,
    teamId: null,
  })}`;
}

async function buildReturnWorkbook(
  rows: Array<{ phone: string; amount: number; status: string; reason?: string }>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Retour");
  sheet.addRow(["Numéro téléphone", "Montant", "Statut transaction", "Motif échec"]);
  for (const row of rows) {
    sheet.addRow([row.phone, row.amount, row.status, row.reason ?? ""]);
  }
  const raw = await workbook.xlsx.writeBuffer();
  return Buffer.from(raw);
}

describe("Payments helpers", () => {
  it("resolvePeriod accepts 2026-W29 and S29", () => {
    const full = resolvePeriod("2026-W29");
    expect(full.shortPeriod).toBe("S29");
    expect(full.weekIso).toBe("2026-W29");

    const short = resolvePeriod("S29", PaymentCycle.WEEKLY, 2026);
    expect(short.shortPeriod).toBe("S29");
    expect(short.weekIso).toBe("2026-W29");
  });

  it("buildMvolaDescription truncates long first names (RG-09)", () => {
    const description = buildMvolaDescription("VeryLongFirstNameHere", "MNK");
    expect(description.length).toBeLessThanOrEqual(30);
    expect(description.endsWith(" Paiement MNK")).toBe(true);
  });
});

describe("Payments API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(basePrisma.auditLog.create).mockResolvedValue({ id: BigInt(1) } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      typeof fn === "function" ? fn(prisma as never) : fn,
    );
  });

  it("POST /payments/generate aggregates validated pointages", async () => {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.pointage.findMany).mockResolvedValue([
      {
        workerId: MOCK_WORKER_ID,
        amount: new Prisma.Decimal("75000"),
        worker: mockWorker,
      },
      {
        workerId: MOCK_WORKER_ID,
        amount: new Prisma.Decimal("50000"),
        worker: mockWorker,
      },
    ] as never);
    vi.mocked(prisma.biometricCheck.findFirst).mockResolvedValue({
      result: "OK",
    } as never);
    vi.mocked(prisma.payment.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.payment.createMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.payment.findMany).mockResolvedValue([mockPayment] as never);

    const app = createApp();
    const res = await request(app)
      .post("/api/v1/payments/generate")
      .set("Authorization", adminAuthHeader())
      .send({ periodIso: "2026-W29" });

    expect(res.status).toBe(201);
    expect(res.body.created).toBe(1);
    expect(res.body.periodIso).toBe("S29");
    expect(prisma.payment.createMany).toHaveBeenCalled();
  });

  it("POST /payments/generate returns PAY_CONFLICT when exported exists", async () => {
    vi.mocked(prisma.payment.findFirst).mockResolvedValue({
      id: MOCK_PAYMENT_ID,
      status: PaymentStatus.EXPORTED,
    } as never);

    const app = createApp();
    const res = await request(app)
      .post("/api/v1/payments/generate")
      .set("Authorization", adminAuthHeader())
      .send({ periodIso: "2026-W29" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("PAY_CONFLICT");
  });

  it("GET /payments/:period/export returns xlsx and marks EXPORTED", async () => {
    vi.mocked(prisma.payment.findMany).mockResolvedValue([mockPayment] as never);
    vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 1 });

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/payments/S29/export")
      .set("Authorization", adminAuthHeader());

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("spreadsheetml");
    expect(res.headers["x-alterra-exported-count"]).toBe("1");
    expect(minioClient.putObject).toHaveBeenCalled();
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PaymentStatus.EXPORTED }),
      }),
    );
    expect(basePrisma.auditLog.create).toHaveBeenCalled();
  });

  it("GET /payments/:period/export rejects when no exportable lines", async () => {
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { ...mockPayment, bioValid: false },
    ] as never);

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/payments/S29/export")
      .set("Authorization", adminAuthHeader());

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("NO_EXPORTABLE_PAYMENTS");
  });

  it("POST /payments/import-status matches phone+amount and updates PAID/FAILED", async () => {
    const exportedPayment = {
      ...mockPayment,
      status: PaymentStatus.EXPORTED,
    };

    vi.mocked(prisma.payment.findMany).mockResolvedValue([exportedPayment] as never);
    vi.mocked(prisma.payment.update).mockResolvedValue({
      ...exportedPayment,
      status: PaymentStatus.PAID,
    } as never);

    const buffer = await buildReturnWorkbook([
      { phone: "0341234567", amount: 125000, status: "SUCCESS" },
      { phone: "0349999999", amount: 1000, status: "FAILED", reason: "Solde insuffisant" },
    ]);

    const app = createApp();
    const res = await request(app)
      .post("/api/v1/payments/import-status")
      .set("Authorization", adminAuthHeader())
      .send({
        periodIso: "S29",
        contentBase64: buffer.toString("base64"),
      });

    expect(res.status).toBe(200);
    expect(res.body.paid).toBe(1);
    expect(res.body.unmatched).toHaveLength(1);
    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PaymentStatus.PAID }),
      }),
    );
  });

  it("POST /payments/import-status is idempotent on re-import", async () => {
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      { ...mockPayment, status: PaymentStatus.PAID },
    ] as never);

    const buffer = await buildReturnWorkbook([
      { phone: "0341234567", amount: 125000, status: "SUCCESS" },
    ]);

    const app = createApp();
    const res = await request(app)
      .post("/api/v1/payments/import-status")
      .set("Authorization", adminAuthHeader())
      .send({
        periodIso: "S29",
        contentBase64: buffer.toString("base64"),
      });

    expect(res.status).toBe(200);
    expect(res.body.skippedAlreadyFinal).toBe(1);
    expect(prisma.payment.update).not.toHaveBeenCalled();
  });
});
