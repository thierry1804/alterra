import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { SYSTEM_ROLE_IDS } from "../services/access/system-roles.js";

const BORDEREAU_ID = "00000000-0000-4000-8000-0000000000b1";
const SITE_ID = "00000000-0000-4000-8000-000000000010";
const FINANCE_USER = "00000000-0000-4000-8000-0000000000f1";
const DG_USER = "00000000-0000-4000-8000-0000000000f2";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    bordereau: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
    payment: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    pointage: {
      findMany: vi.fn(),
    },
    bordereauInvoice: {
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("../lib/prisma-base.js", () => ({
  basePrisma: { auditLog: { create: vi.fn() } },
}));

import { prisma } from "../lib/prisma.js";
import { basePrisma } from "../lib/prisma-base.js";

function header(roleId: string, sub: string) {
  return `Bearer ${signAccessToken({ sub, roleId, siteId: null, teamId: null })}`;
}

const financeHeader = () => header(SYSTEM_ROLE_IDS.FINANCE, FINANCE_USER);
const dgHeader = () => header(SYSTEM_ROLE_IDS.DG, DG_USER);

function bordereau(overrides: Record<string, unknown> = {}) {
  return {
    id: BORDEREAU_ID,
    siteId: SITE_ID,
    periodIso: "S47",
    referenceYear: 2026,
    number: 18,
    version: 1,
    status: "GENERATED",
    createdById: null,
    createdAt: new Date("2026-11-16"),
    supersededAt: null,
    financeValidatedById: null,
    financeValidatedAt: null,
    dgValidatedById: null,
    dgValidatedAt: null,
    returnReason: null,
    returnedById: null,
    returnedAt: null,
    lines: null,
    isiRate: new Prisma.Decimal("0.05"),
    amountDecimals: 0,
    site: { id: SITE_ID, name: "Manankazo", shortCode: "MNK" },
    ...overrides,
  };
}

function payment(amount: string, isi: string) {
  return {
    id: "00000000-0000-4000-8000-0000000000a1",
    adjustments: [],
    amount: new Prisma.Decimal(amount),
    isiAmount: new Prisma.Decimal(isi),
    netAmount: new Prisma.Decimal(amount).sub(isi),
    description: "Mnk-01 Moc REBOUCHAGE S47 18 MNK ACT01",
    bioValid: true,
    worker: {
      matricule: "MOC-MNK-01",
      firstName: "Mnk-01",
      lastName: "Moc",
      mvolaNumber: "0340000001",
    },
  };
}

describe("Bordereau validation workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(basePrisma.auditLog.create).mockResolvedValue({ id: BigInt(1) } as never);
    vi.mocked(prisma.bordereau.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.payment.count).mockResolvedValue(3);
    vi.mocked(prisma.payment.findMany).mockResolvedValue([
      payment("300", "15"),
      payment("300", "15"),
    ] as never);
    vi.mocked(prisma.bordereau.findMany).mockResolvedValue([bordereau()] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([]);
    vi.mocked(prisma.bordereauInvoice.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.pointage.findMany).mockResolvedValue([]);
  });

  it("lets the finance validate a generated bordereau and logs it", async () => {
    vi.mocked(prisma.bordereau.findUnique).mockResolvedValue(bordereau() as never);

    const res = await request(createApp())
      .post(`/api/v1/bordereaux/${BORDEREAU_ID}/validate-finance`)
      .set("Authorization", financeHeader());

    expect(res.status).toBe(200);
    expect(prisma.bordereau.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BORDEREAU_ID, status: "GENERATED" },
        data: expect.objectContaining({
          status: "FINANCE_VALIDATED",
          financeValidatedById: FINANCE_USER,
        }),
      }),
    );
    expect(basePrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "VALIDATE_BORDEREAU_FINANCE" }),
      }),
    );
  });

  it("refuses the finance validation of an empty bordereau", async () => {
    vi.mocked(prisma.bordereau.findUnique).mockResolvedValue(bordereau() as never);
    vi.mocked(prisma.payment.count).mockResolvedValue(0);

    const res = await request(createApp())
      .post(`/api/v1/bordereaux/${BORDEREAU_ID}/validate-finance`)
      .set("Authorization", financeHeader());

    expect(res.status).toBe(422);
    expect(prisma.bordereau.updateMany).not.toHaveBeenCalled();
  });

  it("refuses the DG validation before the finance one", async () => {
    vi.mocked(prisma.bordereau.findUnique).mockResolvedValue(bordereau() as never);

    const res = await request(createApp())
      .post(`/api/v1/bordereaux/${BORDEREAU_ID}/validate-dg`)
      .set("Authorization", dgHeader());

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("INVALID_STATE");
  });

  it("lets the DG validate after the finance", async () => {
    vi.mocked(prisma.bordereau.findUnique).mockResolvedValue(
      bordereau({ status: "FINANCE_VALIDATED", financeValidatedById: FINANCE_USER }) as never,
    );

    const res = await request(createApp())
      .post(`/api/v1/bordereaux/${BORDEREAU_ID}/validate-dg`)
      .set("Authorization", dgHeader());

    expect(res.status).toBe(200);
    expect(prisma.bordereau.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BORDEREAU_ID, status: "FINANCE_VALIDATED" },
        data: expect.objectContaining({ status: "DG_VALIDATED", dgValidatedById: DG_USER }),
      }),
    );
  });

  it("refuses the second validation by the same person", async () => {
    vi.mocked(prisma.bordereau.findUnique).mockResolvedValue(
      bordereau({ status: "FINANCE_VALIDATED", financeValidatedById: DG_USER }) as never,
    );

    const res = await request(createApp())
      .post(`/api/v1/bordereaux/${BORDEREAU_ID}/validate-dg`)
      .set("Authorization", dgHeader());

    expect(res.status).toBe(403);
    expect(res.body.code).toBe("SAME_VALIDATOR");
    expect(prisma.bordereau.updateMany).not.toHaveBeenCalled();
  });

  it("keeps validation to the finance, the DG and the administrator", async () => {
    vi.mocked(prisma.bordereau.findUnique).mockResolvedValue(bordereau() as never);
    for (const roleId of [SYSTEM_ROLE_IDS.CONSULTATION, SYSTEM_ROLE_IDS.TRESORERIE]) {
      const res = await request(createApp())
        .post(`/api/v1/bordereaux/${BORDEREAU_ID}/validate-finance`)
        .set("Authorization", header(roleId, FINANCE_USER));
      expect(res.status).toBe(403);
    }
    const dgOnFinanceStep = await request(createApp())
      .post(`/api/v1/bordereaux/${BORDEREAU_ID}/validate-finance`)
      .set("Authorization", dgHeader());
    expect(dgOnFinanceStep.status).toBe(403);
  });

  it("returns a bordereau to generated with a mandatory reason", async () => {
    vi.mocked(prisma.bordereau.findUnique).mockResolvedValue(
      bordereau({ status: "FINANCE_VALIDATED", financeValidatedById: FINANCE_USER }) as never,
    );

    const tooShort = await request(createApp())
      .post(`/api/v1/bordereaux/${BORDEREAU_ID}/return`)
      .set("Authorization", dgHeader())
      .send({ reason: "non" });
    expect(tooShort.status).toBe(422);

    const res = await request(createApp())
      .post(`/api/v1/bordereaux/${BORDEREAU_ID}/return`)
      .set("Authorization", dgHeader())
      .send({ reason: "Montant à revoir pour la ligne MNK-01" });

    expect(res.status).toBe(200);
    expect(prisma.bordereau.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BORDEREAU_ID, status: "FINANCE_VALIDATED" },
        data: expect.objectContaining({
          status: "GENERATED",
          financeValidatedById: null,
          returnReason: "Montant à revoir pour la ligne MNK-01",
          returnedById: DG_USER,
        }),
      }),
    );
  });

  it("only lets the DG send back what the finance validated", async () => {
    vi.mocked(prisma.bordereau.findUnique).mockResolvedValue(
      bordereau({ status: "FINANCE_VALIDATED", financeValidatedById: DG_USER }) as never,
    );

    const res = await request(createApp())
      .post(`/api/v1/bordereaux/${BORDEREAU_ID}/return`)
      .set("Authorization", financeHeader())
      .send({ reason: "Montant à revoir pour la ligne MNK-01" });

    expect(res.status).toBe(403);
  });

  it("freezes a bordereau once the DG validated it", async () => {
    vi.mocked(prisma.bordereau.findUnique).mockResolvedValue(
      bordereau({ status: "DG_VALIDATED", financeValidatedById: FINANCE_USER }) as never,
    );

    const returned = await request(createApp())
      .post(`/api/v1/bordereaux/${BORDEREAU_ID}/return`)
      .set("Authorization", dgHeader())
      .send({ reason: "Montant à revoir pour la ligne MNK-01" });
    const again = await request(createApp())
      .post(`/api/v1/bordereaux/${BORDEREAU_ID}/validate-finance`)
      .set("Authorization", financeHeader());

    expect(returned.status).toBe(409);
    expect(again.status).toBe(409);
  });

  it("shows the lines, the 5 % and the net in the detail", async () => {
    vi.mocked(prisma.bordereau.findUnique).mockResolvedValue(bordereau() as never);
    const res = await request(createApp())
      .get(`/api/v1/bordereaux/${BORDEREAU_ID}`)
      .set("Authorization", financeHeader());

    expect(res.status).toBe(200);
    expect(res.body.lines).toHaveLength(2);
    expect(res.body.totals).toEqual({ gross: "600", isi: "30", net: "570", isiRate: "5" });
    expect(res.body.versions[0]).toEqual(
      expect.objectContaining({ version: 1, status: "GENERATED" }),
    );
  });

  it("serves a superseded version from its snapshot", async () => {
    vi.mocked(prisma.payment.findMany).mockResolvedValue([]);
    vi.mocked(prisma.bordereau.findUnique).mockResolvedValue(
      bordereau({
        status: "SUPERSEDED",
        lines: [
          {
            matricule: "MOC-MNK-01",
            workerName: "Moc Mnk-01",
            mvolaNumber: "0340000001",
            amount: "300",
            description: "x",
            bioValid: true,
          },
        ],
      }) as never,
    );

    const detail = await request(createApp())
      .get(`/api/v1/bordereaux/${BORDEREAU_ID}`)
      .set("Authorization", financeHeader());
    expect(detail.body.lines).toHaveLength(1);

    const file = await request(createApp())
      .get(`/api/v1/bordereaux/${BORDEREAU_ID}/download`)
      .set("Authorization", financeHeader());
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toContain("spreadsheetml");
    expect(file.headers["content-disposition"]).toContain("Bordereau_MNK_S47_2026_n18_v1.xlsx");
  });
});
