import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDashboardSummary } from "../services/dashboard/dashboard.service.js";

function createMockPrisma(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    worker: {
      count: vi.fn().mockResolvedValue(50),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    pointage: {
      count: vi.fn().mockResolvedValue(5),
      groupBy: vi.fn().mockResolvedValue([{ workerId: "w1" }, { workerId: "w2" }]),
    },
    payment: {
      aggregate: vi.fn().mockResolvedValue({
        _sum: { netAmount: 125000 },
        _count: 3,
      }),
      count: vi.fn().mockResolvedValue(0),
    },
    bordereau: {
      count: vi.fn().mockResolvedValue(0),
    },
    user: {
      count: vi.fn().mockResolvedValue(0),
    },
    team: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    site: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  };
}

describe("getDashboardSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("computes presence rate from active workers and weekly validated pointages", async () => {
    const prisma = createMockPrisma();
    vi.mocked(prisma.worker.count).mockResolvedValue(40);
    vi.mocked(prisma.pointage.groupBy).mockResolvedValue(
      Array.from({ length: 30 }, (_, index) => ({ workerId: `w-${index}` })),
    );

    const summary = await getDashboardSummary(prisma as never);

    expect(summary.kpis.activeWorkers).toBe(40);
    expect(summary.kpis.presenceRate).toBe(75);
    expect(summary.presenceLast7Days).toHaveLength(7);
    expect(summary.workforceTrend).toHaveLength(8);
  });

  it("includes failed payment alert", async () => {
    const prisma = createMockPrisma();
    vi.mocked(prisma.payment.count).mockResolvedValue(2);

    const summary = await getDashboardSummary(prisma as never);

    expect(summary.alerts.some((alert) => alert.id === "failed-payments")).toBe(true);
  });

  it("scopes queries when siteId is provided", async () => {
    const prisma = createMockPrisma();
    const siteId = "00000000-0000-0000-0001-000000000001";

    await getDashboardSummary(prisma as never, siteId);

    expect(prisma.worker.count).toHaveBeenCalledWith({
      where: { status: "ACTIVE", deletedAt: null, siteId },
    });
  });

  it("counts only DG-validated unexported lines as ready to export, in net", async () => {
    const prisma = createMockPrisma();

    const summary = await getDashboardSummary(prisma as never);

    expect(prisma.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "PENDING",
          bordereauRef: { status: "DG_VALIDATED" },
        }),
        _sum: { netAmount: true },
      }),
    );
    expect(summary.kpis.pendingPaymentsAmount).toBe(125000);
  });

  it("counts the bordereaux waiting for the viewer's own validation", async () => {
    const prisma = createMockPrisma();
    vi.mocked(prisma.bordereau.count).mockResolvedValue(2);

    const none = await getDashboardSummary(prisma as never);
    expect(none.kpis.bordereauxToValidate).toBe(0);

    const finance = await getDashboardSummary(prisma as never, undefined, {
      canValidateFinance: true,
      canValidateDg: false,
    });
    expect(finance.kpis.bordereauxToValidate).toBe(2);
    expect(prisma.bordereau.count).toHaveBeenCalledWith({ where: { status: "GENERATED" } });

    await getDashboardSummary(prisma as never, undefined, {
      userId: "u1",
      canValidateFinance: false,
      canValidateDg: true,
    });
    expect(prisma.bordereau.count).toHaveBeenCalledWith({
      where: { status: "FINANCE_VALIDATED", financeValidatedById: { not: "u1" } },
    });
  });

  it("counts pointages waiting for the technical validation", async () => {
    const prisma = createMockPrisma();

    const summary = await getDashboardSummary(prisma as never);

    expect(prisma.pointage.count).toHaveBeenCalledWith({
      where: { status: "VALIDATED", technicalValidatedAt: null },
    });
    expect(summary.kpis.pendingTechnicalPointages).toBe(5);
  });
});
