import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { SYSTEM_ROLE_IDS } from "../services/access/system-roles.js";

const PAYMENT_ID = "00000000-0000-4000-8000-0000000000a1";
const BORDEREAU_ID = "00000000-0000-4000-8000-0000000000b1";
const SITE_ID = "00000000-0000-4000-8000-000000000010";
const ADJUSTMENT_ID = "00000000-0000-4000-8000-0000000000d1";

vi.mock("../lib/prisma.js", () => {
  const prisma = {
    payment: { findUnique: vi.fn(), update: vi.fn() },
    paymentAdjustment: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    $transaction: vi.fn(),
  };
  return { prisma };
});

vi.mock("../lib/prisma-base.js", () => ({
  basePrisma: { auditLog: { create: vi.fn() } },
}));

vi.mock("../services/payments/bordereau-invoice.service.js", () => ({
  ensureInvoiceQuietly: vi.fn().mockResolvedValue(undefined),
  openInvoice: vi.fn(),
  regenerateInvoice: vi.fn(),
}));

import { prisma } from "../lib/prisma.js";
import { basePrisma } from "../lib/prisma-base.js";
import { ensureInvoiceQuietly } from "../services/payments/bordereau-invoice.service.js";

function header(roleId: string) {
  return `Bearer ${signAccessToken({
    sub: "00000000-0000-4000-8000-0000000000f1",
    roleId,
    siteId: null,
    teamId: null,
  })}`;
}

function payment(overrides: Record<string, unknown> = {}) {
  return {
    id: PAYMENT_ID,
    status: "PENDING",
    amount: new Prisma.Decimal("1000"),
    isiAmount: new Prisma.Decimal("50"),
    netAmount: new Prisma.Decimal("950"),
    originalAmount: null,
    bordereauRef: {
      id: BORDEREAU_ID,
      siteId: SITE_ID,
      status: "GENERATED",
      isiRate: new Prisma.Decimal("0.05"),
      amountDecimals: 0,
    },
    ...overrides,
  };
}

describe("Payment adjustments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(basePrisma.auditLog.create).mockResolvedValue({ id: BigInt(1) } as never);
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      typeof fn === "function" ? fn(prisma as never) : fn,
    );
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(payment() as never);
    vi.mocked(prisma.paymentAdjustment.create).mockResolvedValue({ id: ADJUSTMENT_ID } as never);
  });

  it("adds a positive adjustment and updates the gross, the ISI and the net", async () => {
    const res = await request(createApp())
      .post(`/api/v1/payments/${PAYMENT_ID}/adjustments`)
      .set("Authorization", header(SYSTEM_ROLE_IDS.ADMIN))
      .send({ amount: 200, reason: "Prime de rendement du mois" });

    expect(res.status).toBe(201);
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: PAYMENT_ID },
      data: expect.objectContaining({
        amount: new Prisma.Decimal("1200"),
        isiAmount: new Prisma.Decimal("60"),
        netAmount: new Prisma.Decimal("1140"),
        originalAmount: new Prisma.Decimal("1000"),
      }),
    });
    expect(ensureInvoiceQuietly).toHaveBeenCalledWith(BORDEREAU_ID, true, "Ajustement de paiement");
    expect(basePrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "ADJUST_PAYMENT", entityType: "Payment" }),
      }),
    );
  });

  it("accepts a negative adjustment (withholding) with the same ISI rule", async () => {
    const res = await request(createApp())
      .post(`/api/v1/payments/${PAYMENT_ID}/adjustments`)
      .set("Authorization", header(SYSTEM_ROLE_IDS.ADMIN))
      .send({ amount: -300, reason: "Retenue pour matériel perdu" });

    expect(res.status).toBe(201);
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: PAYMENT_ID },
      data: expect.objectContaining({
        amount: new Prisma.Decimal("700"),
        isiAmount: new Prisma.Decimal("35"),
        netAmount: new Prisma.Decimal("665"),
      }),
    });
  });

  it("refuses a missing reason, a null amount and an adjustment that empties the payment", async () => {
    const send = (body: unknown) =>
      request(createApp())
        .post(`/api/v1/payments/${PAYMENT_ID}/adjustments`)
        .set("Authorization", header(SYSTEM_ROLE_IDS.ADMIN))
        .send(body as object);

    expect((await send({ amount: 100, reason: "court" })).status).toBe(422);
    expect((await send({ amount: 0, reason: "Montant nul demandé" })).status).toBe(422);
    const tooLow = await send({ amount: -1000, reason: "Retenue égale au montant" });
    expect(tooLow.status).toBe(422);
    expect(tooLow.body.code).toBe("INVALID_AMOUNT");
    expect(prisma.paymentAdjustment.create).not.toHaveBeenCalled();
  });

  it("locks the adjustment once the bordereau is validated, exported or the payment sent", async () => {
    for (const override of [
      { bordereauRef: { ...payment().bordereauRef, status: "FINANCE_VALIDATED" } },
      { bordereauRef: { ...payment().bordereauRef, status: "DG_VALIDATED" } },
      { bordereauRef: { ...payment().bordereauRef, status: "EXPORTED" } },
      { status: "EXPORTED" },
    ]) {
      vi.mocked(prisma.payment.findUnique).mockResolvedValue(payment(override) as never);
      const res = await request(createApp())
        .post(`/api/v1/payments/${PAYMENT_ID}/adjustments`)
        .set("Authorization", header(SYSTEM_ROLE_IDS.ADMIN))
        .send({ amount: 100, reason: "Prime de rendement du mois" });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe("ADJUSTMENT_LOCKED");
    }
    expect(prisma.paymentAdjustment.create).not.toHaveBeenCalled();
  });

  it("keeps adjustments to the roles holding the correction permission", async () => {
    for (const roleId of [
      SYSTEM_ROLE_IDS.FINANCE,
      SYSTEM_ROLE_IDS.DG,
      SYSTEM_ROLE_IDS.TRESORERIE,
      SYSTEM_ROLE_IDS.CHEF_SERVICE,
    ]) {
      const res = await request(createApp())
        .post(`/api/v1/payments/${PAYMENT_ID}/adjustments`)
        .set("Authorization", header(roleId))
        .send({ amount: 100, reason: "Prime de rendement du mois" });
      expect(res.status).toBe(403);
    }
  });

  it("removes an adjustment and restores the totals", async () => {
    vi.mocked(prisma.paymentAdjustment.findUnique).mockResolvedValue({
      id: ADJUSTMENT_ID,
      paymentId: PAYMENT_ID,
      amount: new Prisma.Decimal("200"),
      reason: "Prime de rendement du mois",
    } as never);
    vi.mocked(prisma.payment.findUnique).mockResolvedValue(
      payment({
        amount: new Prisma.Decimal("1200"),
        isiAmount: new Prisma.Decimal("60"),
        netAmount: new Prisma.Decimal("1140"),
      }) as never,
    );

    const res = await request(createApp())
      .delete(`/api/v1/payments/adjustments/${ADJUSTMENT_ID}`)
      .set("Authorization", header(SYSTEM_ROLE_IDS.ADMIN));

    expect(res.status).toBe(204);
    expect(prisma.paymentAdjustment.delete).toHaveBeenCalledWith({ where: { id: ADJUSTMENT_ID } });
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: PAYMENT_ID },
      data: {
        amount: new Prisma.Decimal("1000"),
        isiAmount: new Prisma.Decimal("50"),
        netAmount: new Prisma.Decimal("950"),
      },
    });
    expect(ensureInvoiceQuietly).toHaveBeenCalledWith(
      BORDEREAU_ID,
      true,
      "Suppression d'un ajustement",
    );
  });
});
