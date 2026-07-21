import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import request from "supertest";
import { createApp } from "../app.js";
import { resetDailyPdfJobsForTests } from "../jobs/pdf.worker.js";
import { signAccessToken } from "../lib/jwt.js";
import { resetRedisForTests } from "../lib/redis.js";
import { renderDailyReportHtml } from "../services/reports/pdf-render.service.js";

const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";
const MOCK_CDS_ID = "00000000-0000-4000-8000-000000000002";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    site: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    pointage: { findMany: vi.fn(), count: vi.fn() },
    biometricCheck: { findMany: vi.fn() },
  },
}));

vi.mock("../services/storage/minio.js", () => ({
  minioClient: { putObject: vi.fn().mockResolvedValue(undefined) },
  BUCKETS: { reports: "rapports-pdf", photos: "photos-pointages" },
  presignedDownloadUrl: vi
    .fn()
    .mockImplementation((_bucket: string, key: string) => Promise.resolve(`https://minio.test/${key}`)),
}));

vi.mock("../services/audit/audit.service.js", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("../services/notifications/email.service.js", () => ({
  notifyAdminsDailyReportReady: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "../lib/prisma.js";
import { minioClient } from "../services/storage/minio.js";
import { notifyAdminsDailyReportReady } from "../services/notifications/email.service.js";
import { processDailyPdfJob } from "../services/reports/daily-pdf.service.js";

const sampleViewModel = {
  generatedAt: "21/07/2026 20:00:00",
  date: "2026-07-21",
  periodIso: "D202",
  site: { name: "Manankazo", shortCode: "MNK" },
  cds: {
    fullName: "Rabe Paul",
    signedAt: "21/07/2026 20:00:00",
    signatureText: "Rabe Paul",
  },
  summary: {
    workerCount: 1,
    pointageCount: 1,
    totalAmount: "12 500",
    bioOkCount: 1,
    bioPendingCount: 0,
    pendingCount: 0,
    needsClarificationCount: 0,
    rejectedCount: 0,
  },
  activities: [
    {
      label: "Plantation",
      rows: [
        {
          workerName: "Rakoto Jean",
          quantity: "50",
          unit: "plant",
          amount: "12 500",
          bioStatus: "OK",
        },
      ],
    },
  ],
};

function cdsAuthHeader() {
  return `Bearer ${signAccessToken({
    sub: MOCK_CDS_ID,
    role: Role.CHEF_SERVICE,
    siteId: MOCK_SITE_ID,
    teamId: null,
  })}`;
}

describe("daily PDF generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRedisForTests();
    resetDailyPdfJobsForTests();
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { email: "admin@alterra.test" },
    ] as never);
  });

  it("renders daily report HTML template", () => {
    const html = renderDailyReportHtml(sampleViewModel);
    expect(html).toContain("Rapport journalier");
    expect(html).toContain("D202");
    expect(html).toContain("Rakoto Jean");
  });

  it("processDailyPdfJob uploads PDF and notifies admin", async () => {
    vi.mocked(prisma.site.findUnique).mockResolvedValue({
      id: MOCK_SITE_ID,
      name: "Manankazo",
      shortCode: "MNK",
    } as never);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      firstName: "Paul",
      lastName: "Rabe",
    } as never);
    vi.mocked(prisma.pointage.findMany).mockResolvedValue([
      {
        workerId: "worker-1",
        amount: { toString: () => "12500" },
        quantity: { toString: () => "50" },
        worker: { firstName: "Jean", lastName: "Rakoto" },
        activity: { label: "Plantation", unit: "plant" },
      },
    ] as never);
    vi.mocked(prisma.pointage.count).mockResolvedValue(0);
    vi.mocked(prisma.biometricCheck.findMany).mockResolvedValue([]);

    const result = await processDailyPdfJob({
      siteId: MOCK_SITE_ID,
      date: "2026-07-21",
      requestedById: MOCK_CDS_ID,
      signatureText: "Rabe Paul",
    });

    expect(minioClient.putObject).toHaveBeenCalled();
    expect(notifyAdminsDailyReportReady).toHaveBeenCalled();
    expect(result.reportKey).toContain("reports/daily/2026-07-21/MNK/");
  });

  it("GET /reports/daily/preview returns counts", async () => {
    vi.mocked(prisma.site.findUnique).mockResolvedValue({ id: MOCK_SITE_ID } as never);
    vi.mocked(prisma.pointage.findMany).mockResolvedValue([
      { workerId: "w1", amount: { toString: () => "1000" } },
    ] as never);
    vi.mocked(prisma.pointage.count).mockResolvedValue(0);

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/reports/daily/preview")
      .query({ date: "2026-07-21" })
      .set("Authorization", cdsAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.validatedCount).toBe(1);
    expect(res.body.periodIso).toMatch(/^D\d{3}$/);
  });

  it("POST /reports/daily enqueues async job", async () => {
    vi.mocked(prisma.site.findUnique).mockResolvedValue({
      id: MOCK_SITE_ID,
      name: "Manankazo",
      shortCode: "MNK",
    } as never);
    vi.mocked(prisma.pointage.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.pointage.count).mockResolvedValue(0);
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      firstName: "Paul",
      lastName: "Rabe",
    } as never);
    vi.mocked(prisma.biometricCheck.findMany).mockResolvedValue([]);

    const app = createApp();
    const res = await request(app)
      .post("/api/v1/reports/daily")
      .set("Authorization", cdsAuthHeader())
      .send({
        date: "2026-07-21",
        signatureText: "Rabe Paul",
      });

    expect(res.status).toBe(202);
    expect(res.body.jobId).toBeTruthy();
  });
});
