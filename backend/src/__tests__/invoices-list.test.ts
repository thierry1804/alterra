import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma.js", () => ({
  prisma: { invoice: { findMany: vi.fn() } },
}));

import { prisma } from "../lib/prisma.js";
import { listInvoices } from "../services/payments/activity-invoices.service.js";

function invoice(id: string) {
  return {
    id,
    number: "N",
    periodIso: "S47",
    referenceYear: 2026,
    subActivity: { label: "A", shortLabel: "a" },
    site: { name: "Site", shortCode: "AAA" },
    workerCount: 1,
    unitRateSnapshot: { toString: () => "100" },
    totalAmount: { toString: () => "100" },
    createdAt: new Date("2026-11-17T00:00:00Z"),
  };
}

describe("listInvoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([] as never);
  });

  it("returns the first page of 50 by default with a stable order", async () => {
    await listInvoices({});

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 51,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
    );
  });

  it("pages with a cursor and stops on the last page", async () => {
    vi.mocked(prisma.invoice.findMany).mockResolvedValue([
      invoice("a"),
      invoice("b"),
      invoice("c"),
    ] as never);

    const first = await listInvoices({ take: 2 });
    expect(first.data.map((item) => item.id)).toEqual(["a", "b"]);
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).toBe("b");

    vi.mocked(prisma.invoice.findMany).mockResolvedValue([invoice("c")] as never);
    const last = await listInvoices({ take: 2, cursor: "b" });
    expect(prisma.invoice.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: { id: "b" }, skip: 1 }),
    );
    expect(last.hasMore).toBe(false);
    expect(last.nextCursor).toBeNull();
  });

  it("keeps the period filter", async () => {
    await listInvoices({ periodIso: "2026-W47" });

    expect(prisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { periodIso: "S47", referenceYear: 2026 } }),
    );
  });
});
