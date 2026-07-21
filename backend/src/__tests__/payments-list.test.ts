import { PaymentStatus, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/period-iso.js", () => ({
  resolvePeriod: vi.fn(() => ({
    shortPeriod: "S29",
    weekIso: "2026-W29",
    cycle: "WEEKLY",
    dateFrom: new Date(),
    dateTo: new Date(),
  })),
}));

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    payment: {
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from "../lib/prisma.js";
import { correctPaymentAmount, listPayments } from "../services/payments/list.service.js";

const mockPayment = {
  id: "pay-1",
  workerId: "worker-1",
  periodIso: "S29",
  cycle: "WEEKLY" as const,
  amount: new Prisma.Decimal("125000"),
  originalAmount: null,
  description: "Rakoto Paiement MNK",
  bioValid: true,
  status: PaymentStatus.PENDING,
  exportedAt: null,
  paidAt: null,
  failureReason: null,
  correctionReason: null,
  createdAt: new Date(),
  worker: {
    id: "worker-1",
    firstName: "Rakoto",
    lastName: "Jean",
    mvolaNumber: "0341234567",
    matricule: "MOC-001",
  },
};

describe("payments list service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listPayments returns mapped rows", async () => {
    vi.mocked(prisma.payment.findMany).mockResolvedValue([mockPayment] as never);

    const result = await listPayments({ periodIso: "2026-W29" });

    expect(result.periodIso).toBe("S29");
    expect(result.data).toHaveLength(1);
    expect(result.data[0].amount).toBe("125000");
  });

  it("correctPaymentAmount updates PENDING payment", async () => {
    vi.mocked(prisma.payment.findUniqueOrThrow).mockResolvedValue(mockPayment as never);
    vi.mocked(prisma.payment.update).mockResolvedValue(mockPayment as never);

    await correctPaymentAmount("pay-1", {
      amount: 130000,
      correctionReason: "Correction manuelle admin",
    });

    expect(prisma.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 130000,
          correctionReason: "Correction manuelle admin",
        }),
      }),
    );
  });
});
