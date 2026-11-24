import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma.js", () => ({ prisma: {} }));

import { getCostsSummary } from "../services/dashboard/costs.service.js";

const SITE_A = "00000000-0000-4000-8000-00000000000a";
const SITE_B = "00000000-0000-4000-8000-00000000000b";
const CAT_REB = { id: "cat-reb", code: "ACT02", label: "Rebouchage" };
const CAT_TRO = { id: "cat-tro", code: "ACT01", label: "Trouaison" };

function payment(
  siteId: string,
  workerId: string,
  bordereauId: string,
  net: string,
  status: "PENDING" | "EXPORTED" | "PAID" | "FAILED",
  bordereauStatus = "EXPORTED",
  periodIso = "S47",
) {
  return {
    workerId,
    bordereauId,
    netAmount: new Prisma.Decimal(net),
    status,
    worker: { siteId },
    bordereauRef: { status: bordereauStatus, periodIso, referenceYear: 2026 },
  };
}

function pointage(
  workerId: string,
  bordereauId: string,
  siteId: string,
  amount: string,
  category: typeof CAT_REB,
  subActivityId = "sub-1",
) {
  return {
    workerId,
    subActivityId,
    unitRateSnapshot: new Prisma.Decimal("100"),
    amount: new Prisma.Decimal(amount),
    bordereauId,
    worker: { siteId },
    bordereau: { isiRate: new Prisma.Decimal("0.05"), amountDecimals: 0 },
    subActivity: { category },
  };
}

function fakeDb(overrides: { payments?: unknown[]; pointages?: unknown[] }) {
  return {
    pointage: {
      aggregate: vi.fn().mockResolvedValue({ _min: { date: new Date("2026-11-10T00:00:00Z") } }),
      findMany: vi.fn().mockImplementation(async (args: { distinct?: string[] }) =>
        args.distinct
          ? [
              { workerId: "w1", worker: { siteId: SITE_A } },
              { workerId: "w2", worker: { siteId: SITE_A } },
              { workerId: "w3", worker: { siteId: SITE_B } },
            ]
          : (overrides.pointages ?? []),
      ),
    },
    payment: { findMany: vi.fn().mockResolvedValue(overrides.payments ?? []) },
    worker: {
      groupBy: vi.fn().mockResolvedValue([
        { siteId: SITE_A, _count: { _all: 10 } },
        { siteId: SITE_B, _count: { _all: 5 } },
      ]),
    },
    activityCategory: {
      findMany: vi.fn().mockResolvedValue([CAT_TRO, CAT_REB]),
    },
    site: {
      findMany: vi.fn().mockResolvedValue([
        { id: SITE_A, name: "Site A", shortCode: "AAA" },
        { id: SITE_B, name: "Site B", shortCode: "BBB" },
      ]),
    },
  };
}

describe("dashboard costs", () => {
  it("counts only paid nets as cost and shows the other stages apart", async () => {
    const db = fakeDb({
      payments: [
        payment(SITE_A, "w1", "b1", "950", "PAID"),
        payment(SITE_A, "w2", "b1", "400", "EXPORTED"),
        payment(SITE_B, "w3", "b2", "300", "PENDING", "DG_VALIDATED"),
        payment(SITE_B, "w4", "b2", "200", "PENDING", "FINANCE_VALIDATED"),
        payment(SITE_B, "w5", "b2", "999", "FAILED"),
      ],
      pointages: [pointage("w1", "b1", SITE_A, "1000", CAT_REB)],
    });

    const summary = await getCostsSummary(db as never, {
      fromWeek: "2026-W46",
      toWeek: "2026-W48",
    });

    const a = summary.bySite.find((row) => row.siteId === SITE_A)!;
    const b = summary.bySite.find((row) => row.siteId === SITE_B)!;
    expect(a.netPaid).toBe(950);
    expect(a.netAwaitingReturn).toBe(400);
    expect(b.netPaid).toBe(0);
    expect(b.netToExport).toBe(300);
    expect(summary.totals.netPaid).toBe(950);
  });

  it("ignores bordereaux outside the chosen weeks", async () => {
    const db = fakeDb({
      payments: [
        payment(SITE_A, "w1", "b1", "950", "PAID", "EXPORTED", "S40"),
        payment(SITE_A, "w2", "b3", "500", "PAID", "EXPORTED", "S47"),
      ],
      pointages: [],
    });

    const summary = await getCostsSummary(db as never, {
      fromWeek: "2026-W46",
      toWeek: "2026-W48",
    });

    expect(summary.totals.netPaid).toBe(500);
  });

  it("breaks the paid net down by activity with the invoice line rule", async () => {
    const db = fakeDb({
      payments: [payment(SITE_A, "w1", "b1", "1235", "PAID")],
      pointages: [
        pointage("w1", "b1", SITE_A, "1000", CAT_REB, "sub-1"),
        pointage("w1", "b1", SITE_A, "300", CAT_TRO, "sub-2"),
      ],
    });

    const summary = await getCostsSummary(db as never, {
      fromWeek: "2026-W46",
      toWeek: "2026-W48",
    });

    expect(summary.byActivity).toEqual([
      expect.objectContaining({ code: "ACT02", netPaid: 950, workerCount: 1 }),
      expect.objectContaining({ code: "ACT01", netPaid: 285, workerCount: 1 }),
    ]);
  });

  it("reports registered and active workers apart, from the first pointage", async () => {
    const db = fakeDb({});

    const summary = await getCostsSummary(db as never, {});

    expect(summary.period.campaignStart).toBe("2026-11-10");
    expect(summary.totals.registeredWorkers).toBe(15);
    expect(summary.totals.activeWorkers).toBe(3);
    expect(summary.bySite.map((row) => row.activeWorkers)).toEqual([2, 1]);
  });
});
