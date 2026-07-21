import { beforeEach, describe, expect, it, vi } from "vitest";
import { BioResult, Role } from "@prisma/client";
import request from "supertest";
import { createApp } from "../app.js";
import { resetWeeklyPdfJobsForTests } from "../jobs/pdf.worker.js";
import { signAccessToken } from "../lib/jwt.js";
import {
  renderWeeklyInvoiceHtml,
  renderWeeklyReportHtml,
} from "../services/reports/pdf-render.service.js";
import { buildWeeklyReportViewModel } from "../services/reports/weekly-data.service.js";

const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";
const MOCK_CDS_ID = "00000000-0000-4000-8000-000000000002";
const MOCK_WORKER_ID = "00000000-0000-4000-8000-000000000100";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    site: { findUnique: vi.fn() },
    user: { findUnique: vi.fn(), findMany: vi.fn() },
    pointage: { findMany: vi.fn() },
    biometricCheck: { findMany: vi.fn() },
    payment: { findMany: vi.fn() },
  },
}));

vi.mock("../services/storage/minio.js", () => ({
  minioClient: { putObject: vi.fn().mockResolvedValue(undefined) },
  BUCKETS: { reports: "rapports-pdf", photos: "photos-pointages" },
  presignedDownloadUrl: vi
    .fn()
    .mockImplementation((_bucket: string, key: string) => Promise.resolve(`https://minio.test/${key}`)),
}));

vi.mock("../services/notifications/email.service.js", () => ({
  notifyAdminsWeeklyReportsReady: vi.fn().mockResolvedValue(undefined),
}));

import { prisma } from "../lib/prisma.js";
import { minioClient } from "../services/storage/minio.js";
import { notifyAdminsWeeklyReportsReady } from "../services/notifications/email.service.js";
import { processWeeklyPdfJob } from "../services/reports/weekly-pdf.service.js";

const sampleViewModel = {
  generatedAt: "21/07/2026 20:00:00",
  weekIso: "2026-W29",
  periodLabel: "S29",
  dateFrom: "2026-07-14",
  dateTo: "2026-07-20",
  site: { name: "Manankazo", shortCode: "MNK" },
  cds: { fullName: "Rabe Paul", signedAt: "21/07/2026 20:00:00" },
  summary: {
    workerCount: 1,
    pointageCount: 1,
    totalAmount: "12 500",
    bioOkCount: 1,
    bioPendingCount: 0,
    paymentCount: 1,
  },
  byDay: [
    {
      date: "2026-07-15",
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
    },
  ],
  payments: [
    {
      workerName: "Rakoto Jean",
      mvolaNumber: "0340000001",
      amount: "12 500",
      bioValid: "OUI",
      description: "Jean Paiement MNK",
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

describe("weekly PDF generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWeeklyPdfJobsForTests();

    vi.mocked(prisma.site.findUnique).mockResolvedValue({
      id: MOCK_SITE_ID,
      name: "Manankazo",
      shortCode: "MNK",
    } as never);

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      firstName: "Paul",
      lastName: "Rabe",
    } as never);

    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { email: "admin@alterra.mg" },
    ] as never);

    vi.mocked(prisma.pointage.findMany).mockResolvedValue([
      {
        workerId: MOCK_WORKER_ID,
        quantity: { toString: () => "50" },
        amount: { toString: () => "12500" },
        date: new Date("2026-07-15"),
        worker: { firstName: "Jean", lastName: "Rakoto", siteId: MOCK_SITE_ID },
        activity: { label: "Plantation", unit: "plant" },
      },
    ] as never);

    vi.mocked(prisma.biometricCheck.findMany).mockResolvedValue([
      { workerId: MOCK_WORKER_ID, result: BioResult.OK },
    ] as never);

    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      {
        amount: { toString: () => "12500" },
        bioValid: true,
        description: "Jean Paiement MNK",
        worker: {
          firstName: "Jean",
          lastName: "Rakoto",
          mvolaNumber: "0340000001",
        },
      },
    ] as never);
  });

  it("buildWeeklyReportViewModel aggregates site data", async () => {
    const viewModel = await buildWeeklyReportViewModel({
      siteId: MOCK_SITE_ID,
      weekIso: "2026-W29",
      requestedById: MOCK_CDS_ID,
    });

    expect(viewModel.site.shortCode).toBe("MNK");
    expect(viewModel.summary.pointageCount).toBe(1);
    expect(viewModel.byDay[0]?.activities[0]?.rows[0]?.bioStatus).toBe("OK");
  });

  it("renders handlebars templates with report data", () => {
    const reportHtml = renderWeeklyReportHtml(sampleViewModel);
    const invoiceHtml = renderWeeklyInvoiceHtml(sampleViewModel);

    expect(reportHtml).toContain("Manankazo");
    expect(reportHtml).toContain("Rakoto Jean");
    expect(invoiceHtml).toContain("Facture hebdomadaire");
    expect(invoiceHtml).toContain("12 500");
  });

  it("processWeeklyPdfJob uploads PDFs and notifies admin", async () => {
    const result = await processWeeklyPdfJob({
      siteId: MOCK_SITE_ID,
      weekIso: "2026-W29",
      requestedById: MOCK_CDS_ID,
    });

    expect(result.reportKey).toContain("reports/2026-W29/MNK/rapport");
    expect(result.invoiceKey).toContain("facture");
    expect(minioClient.putObject).toHaveBeenCalledTimes(2);
    expect(notifyAdminsWeeklyReportsReady).toHaveBeenCalledWith(
      expect.objectContaining({ weekIso: "2026-W29", siteName: "Manankazo" }),
    );
  });

  it("POST /reports/weekly/generate enqueues async job", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/reports/weekly/generate")
      .set("Authorization", cdsAuthHeader())
      .send({ weekIso: "2026-W29" });

    expect(res.status).toBe(202);
    expect(res.body.jobId).toMatch(/^sync-/);
  });
});
