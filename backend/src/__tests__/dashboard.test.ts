import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDashboardSummary } from "../services/dashboard/dashboard.service.js";

function createMockPrisma(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    worker: {
      count: vi.fn().mockResolvedValue(50),
    },
    pointage: {
      count: vi.fn().mockResolvedValue(5),
      groupBy: vi.fn().mockResolvedValue([{ workerId: "w1" }, { workerId: "w2" }]),
    },
    payment: {
      aggregate: vi.fn().mockResolvedValue({
        _sum: { amount: 125000 },
        _count: 3,
      }),
      count: vi.fn().mockResolvedValue(0),
    },
    user: {
      count: vi.fn().mockResolvedValue(0),
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
});
