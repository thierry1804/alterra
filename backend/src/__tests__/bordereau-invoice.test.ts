import { Readable } from "node:stream";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { SYSTEM_ROLE_IDS } from "../services/access/system-roles.js";

const BORDEREAU_ID = "00000000-0000-4000-8000-0000000000b1";
const SITE_ID = "00000000-0000-4000-8000-000000000010";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    bordereau: { findUnique: vi.fn() },
    bordereauInvoice: { findUnique: vi.fn(), upsert: vi.fn() },
    bordereauInvoiceRevision: {
      aggregate: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
    pointage: { findMany: vi.fn() },
    paymentAdjustment: { findMany: vi.fn() },
  },
}));

vi.mock("../lib/prisma-base.js", () => ({
  basePrisma: { auditLog: { create: vi.fn() }, user: { findMany: vi.fn() } },
}));

vi.mock("../services/storage/minio.js", () => ({
  minioClient: { putObject: vi.fn().mockResolvedValue(undefined) },
  BUCKETS: { reports: "rapports-pdf" },
}));

vi.mock("../services/storage/presigned-url.service.js", () => ({
  getReportStream: vi.fn(async () => Readable.from([Buffer.from("%PDF-test")])),
}));

import { prisma } from "../lib/prisma.js";
import { basePrisma } from "../lib/prisma-base.js";
import { minioClient } from "../services/storage/minio.js";
import { buildInvoiceData, ensureInvoice } from "../services/payments/bordereau-invoice.service.js";

function header(roleId: string) {
  return `Bearer ${signAccessToken({
    sub: "00000000-0000-4000-8000-0000000000f1",
    roleId,
    siteId: null,
    teamId: null,
  })}`;
}

function pointage(
  workerId: string,
  lastName: string,
  amount: string,
  category: { code: string; label: string },
  subLabel: string,
  rate = "30",
) {
  return {
    workerId,
    subActivityId: `${category.code}-${subLabel}`,
    quantity: new Prisma.Decimal("5"),
    unitRateSnapshot: new Prisma.Decimal(rate),
    amount: new Prisma.Decimal(amount),
    worker: { matricule: `MOC-${lastName}`, cinNumber: null, lastName, firstName: "X" },
    subActivity: { label: subLabel, unit: { label: "Pièce" }, category },
  };
}

const PLANTS = { code: "ACT01", label: "Productions de plants" };
const SOIL = { code: "ACT02", label: "Préparation du sol" };

function bordereau(overrides: Record<string, unknown> = {}) {
  return {
    id: BORDEREAU_ID,
    siteId: SITE_ID,
    periodIso: "S47",
    referenceYear: 2026,
    number: 7,
    version: 2,
    status: "GENERATED",
    isiRate: new Prisma.Decimal("0.05"),
    isiRounding: "NONE",
    site: { name: "Manankazo", shortCode: "MNK" },
    ...overrides,
  };
}

describe("Bordereau invoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(basePrisma.auditLog.create).mockResolvedValue({ id: BigInt(1) } as never);
    vi.mocked(prisma.bordereau.findUnique).mockResolvedValue(bordereau() as never);
    vi.mocked(prisma.paymentAdjustment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.bordereauInvoice.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) =>
      fn(prisma)) as never);
    vi.mocked(prisma.bordereauInvoiceRevision.aggregate).mockResolvedValue({
      _max: { revision: null },
    } as never);
    vi.mocked(prisma.bordereauInvoiceRevision.create).mockResolvedValue({} as never);
    vi.mocked(basePrisma.user.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.bordereauInvoice.upsert).mockImplementation((async (args: {
      create: Record<string, unknown>;
    }) => ({
      id: "inv-1",
      fileKey: "k",
      ...args.create,
    })) as never);
    vi.mocked(prisma.pointage.findMany).mockResolvedValue([
      pointage("w1", "Alpha", "150", PLANTS, "Repiquage"),
      pointage("w1", "Alpha", "50", PLANTS, "Repiquage"),
      pointage("w2", "Beta", "75", SOIL, "Trouaison"),
    ] as never);
  });

  it("groups the lines by activity and numbers the invoice like the bordereau", async () => {
    const data = await buildInvoiceData(BORDEREAU_ID);

    expect(data!.viewModel.invoiceNumber).toBe("07/2026/MNK");
    expect(data!.viewModel.motif).toBe("Travaux de la semaine 47/2026");
    expect(data!.viewModel.activities.map((activity) => activity.code)).toEqual(["ACT01", "ACT02"]);
    const plants = data!.viewModel.activities[0];
    expect(plants.lines).toHaveLength(1);
    expect(plants.lines[0]).toEqual(
      expect.objectContaining({ designation: "Repiquage S47", amount: "200", isiAmount: "10" }),
    );
  });

  it("computes the 5 % per line and makes the totals the sum of the lines", async () => {
    const data = await buildInvoiceData(BORDEREAU_ID);

    expect(data!.totals).toEqual({ gross: "275", isi: "13.75", net: "261.25", workerCount: 2 });
    const soil = data!.viewModel.activities[1];
    expect(soil.lines[0].isiAmount).toBe("3,75");
    expect(data!.viewModel.totals).toEqual(
      expect.objectContaining({ gross: "275", isi: "13,75", net: "261,25" }),
    );
  });

  it("adds the manual adjustments as their own lines and counts them in the totals", async () => {
    vi.mocked(prisma.paymentAdjustment.findMany).mockResolvedValue([
      {
        amount: new Prisma.Decimal("-50"),
        reason: "Retenue pour matériel perdu",
        payment: { workerId: "w1", worker: { matricule: "MOC-Alpha", cinNumber: null } },
      },
    ] as never);

    const data = await buildInvoiceData(BORDEREAU_ID);

    const adjustments = data!.viewModel.activities.find((activity) => activity.code === "AJ")!;
    expect(adjustments.lines).toHaveLength(1);
    expect(adjustments.lines[0]).toEqual(
      expect.objectContaining({
        designation: "Ajustement manuel — Retenue pour matériel perdu",
        amount: "-50",
        isiAmount: "-2,5",
        netAmount: "-47,5",
      }),
    );
    expect(data!.totals).toEqual({ gross: "225", isi: "11.25", net: "213.75", workerCount: 2 });
  });

  it("returns nothing when no pointage is linked", async () => {
    vi.mocked(prisma.pointage.findMany).mockResolvedValue([]);
    expect(await buildInvoiceData(BORDEREAU_ID)).toBeNull();
  });

  it("stores the PDF and the totals when the invoice is created", async () => {
    await ensureInvoice(BORDEREAU_ID);

    expect(minioClient.putObject).toHaveBeenCalledTimes(1);
    expect(prisma.bordereauInvoice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ bordereauId: BORDEREAU_ID, gross: "275", net: "261.25" }),
      }),
    );
  });

  it("does not rebuild an existing invoice unless it is forced", async () => {
    vi.mocked(prisma.bordereauInvoice.findUnique).mockResolvedValue({ id: "inv-1" } as never);

    await ensureInvoice(BORDEREAU_ID);
    expect(minioClient.putObject).not.toHaveBeenCalled();

    await ensureInvoice(BORDEREAU_ID, { force: true });
    expect(minioClient.putObject).toHaveBeenCalledTimes(1);
  });

  it("lets the finance read the invoice as a PDF and keeps it from other roles", async () => {
    const ok = await request(createApp())
      .get(`/api/v1/bordereaux/${BORDEREAU_ID}/invoice`)
      .set("Authorization", header(SYSTEM_ROLE_IDS.FINANCE));
    expect(ok.status).toBe(200);
    expect(ok.headers["content-type"]).toContain("application/pdf");
    expect(ok.headers["content-disposition"]).toContain("Facture_MNK_S47_2026_n7_v2.pdf");

    const refused = await request(createApp())
      .get(`/api/v1/bordereaux/${BORDEREAU_ID}/invoice`)
      .set("Authorization", header(SYSTEM_ROLE_IDS.CHEF_EQUIPE));
    expect(refused.status).toBe(403);
  });

  it("regenerates before the DG validation and freezes afterwards", async () => {
    const before = await request(createApp())
      .post(`/api/v1/bordereaux/${BORDEREAU_ID}/invoice/regenerate`)
      .set("Authorization", header(SYSTEM_ROLE_IDS.ADMIN));
    expect(before.status).toBe(200);

    vi.mocked(prisma.bordereau.findUnique).mockResolvedValue(
      bordereau({ status: "DG_VALIDATED" }) as never,
    );
    const frozen = await request(createApp())
      .post(`/api/v1/bordereaux/${BORDEREAU_ID}/invoice/regenerate`)
      .set("Authorization", header(SYSTEM_ROLE_IDS.ADMIN));
    expect(frozen.status).toBe(409);
    expect(frozen.body.code).toBe("INVOICE_FROZEN");
  });

  it("answers 404 for a replaced version that never had an invoice", async () => {
    vi.mocked(prisma.pointage.findMany).mockResolvedValue([]);
    vi.mocked(prisma.bordereau.findUnique).mockResolvedValue(
      bordereau({ status: "SUPERSEDED" }) as never,
    );

    const res = await request(createApp())
      .get(`/api/v1/bordereaux/${BORDEREAU_ID}/invoice`)
      .set("Authorization", header(SYSTEM_ROLE_IDS.FINANCE));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("INVOICE_UNAVAILABLE");
  });

  describe("revisions history", () => {
    const REVISION_ID = "00000000-0000-4000-8000-0000000000c2";
    const AUTHOR_ID = "00000000-0000-4000-8000-0000000000f1";

    function revision(n: number, overrides: Record<string, unknown> = {}) {
      return {
        id: n === 2 ? REVISION_ID : `00000000-0000-4000-8000-00000000000${n}`,
        invoiceId: "inv-1",
        revision: n,
        fileKey: `invoices/r${n}.pdf`,
        workerCount: 2,
        gross: new Prisma.Decimal("275"),
        isi: new Prisma.Decimal("13.75"),
        net: new Prisma.Decimal("261.25"),
        reason: n === 1 ? "Génération initiale" : "Ajustement de paiement",
        createdById: n === 2 ? AUTHOR_ID : null,
        createdAt: new Date(`2026-11-2${n}T08:00:00Z`),
        ...overrides,
      };
    }

    beforeEach(() => {
      vi.mocked(prisma.bordereau.findUnique).mockResolvedValue(
        bordereau({ invoice: { id: "inv-1" }, site: { shortCode: "MNK" } }) as never,
      );
    });

    it("keeps a first revision when the invoice is created", async () => {
      await ensureInvoice(BORDEREAU_ID);
      expect(prisma.bordereauInvoiceRevision.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          invoiceId: "inv-1",
          revision: 1,
          reason: "Génération initiale",
          gross: "275",
        }),
      });
    });

    it("adds a new revision on every forced regeneration and keeps its reason and author", async () => {
      vi.mocked(prisma.bordereauInvoice.findUnique).mockResolvedValue({ id: "inv-1" } as never);
      vi.mocked(prisma.bordereauInvoiceRevision.aggregate).mockResolvedValue({
        _max: { revision: 2 },
      } as never);

      await ensureInvoice(BORDEREAU_ID, {
        force: true,
        reason: "Ajustement de paiement",
        userId: AUTHOR_ID,
      });

      expect(prisma.bordereauInvoiceRevision.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          revision: 3,
          reason: "Ajustement de paiement",
          createdById: AUTHOR_ID,
        }),
      });
    });

    it("lists every version, newest first, with the author and the current one flagged", async () => {
      vi.mocked(prisma.bordereauInvoiceRevision.findMany).mockResolvedValue([
        revision(2),
        revision(1),
      ] as never);
      vi.mocked(basePrisma.user.findMany).mockResolvedValue([
        { id: AUTHOR_ID, firstName: "Fina", lastName: "Nce" },
      ] as never);

      const res = await request(createApp())
        .get(`/api/v1/bordereaux/${BORDEREAU_ID}/invoice/revisions`)
        .set("Authorization", header(SYSTEM_ROLE_IDS.FINANCE));

      expect(res.status).toBe(200);
      expect(res.body.data.map((r: { revision: number }) => r.revision)).toEqual([2, 1]);
      expect(res.body.data[0]).toMatchObject({
        current: true,
        createdBy: "Fina Nce",
        reason: "Ajustement de paiement",
        net: "261.25",
      });
      expect(res.body.data[1]).toMatchObject({ current: false, createdBy: null });
    });

    it("returns an empty history when the bordereau has no invoice yet", async () => {
      vi.mocked(prisma.bordereau.findUnique).mockResolvedValue(
        bordereau({ invoice: null, site: { shortCode: "MNK" } }) as never,
      );
      const res = await request(createApp())
        .get(`/api/v1/bordereaux/${BORDEREAU_ID}/invoice/revisions`)
        .set("Authorization", header(SYSTEM_ROLE_IDS.FINANCE));
      expect(res.body.data).toEqual([]);
    });

    it("downloads one precise version and traces it in the audit log", async () => {
      vi.mocked(prisma.bordereauInvoiceRevision.findFirst).mockResolvedValue(revision(2) as never);

      const res = await request(createApp())
        .get(`/api/v1/bordereaux/${BORDEREAU_ID}/invoice/revisions/${REVISION_ID}`)
        .set("Authorization", header(SYSTEM_ROLE_IDS.FINANCE));

      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toContain("attachment");
      expect(res.headers["content-disposition"]).toContain("Facture_MNK_S47_2026_n7_v2_r2.pdf");
      expect(prisma.bordereauInvoiceRevision.findFirst).toHaveBeenCalledWith({
        where: { id: REVISION_ID, invoiceId: "inv-1" },
      });
      expect(basePrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: "DOWNLOAD", entityType: "BordereauInvoice" }),
        }),
      );
    });

    it("answers 404 for a version of another invoice, and 403 without the invoice right", async () => {
      vi.mocked(prisma.bordereauInvoiceRevision.findFirst).mockResolvedValue(null);
      const missing = await request(createApp())
        .get(`/api/v1/bordereaux/${BORDEREAU_ID}/invoice/revisions/${REVISION_ID}`)
        .set("Authorization", header(SYSTEM_ROLE_IDS.FINANCE));
      expect(missing.status).toBe(404);

      const refused = await request(createApp())
        .get(`/api/v1/bordereaux/${BORDEREAU_ID}/invoice/revisions`)
        .set("Authorization", header(SYSTEM_ROLE_IDS.CHEF_EQUIPE));
      expect(refused.status).toBe(403);
    });
  });
});
