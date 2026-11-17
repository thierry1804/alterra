import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma.js", () => ({
  prisma: { bordereau: { findMany: vi.fn(), groupBy: vi.fn() } },
}));

import { prisma } from "../lib/prisma.js";
import { listExportQueue } from "../services/payments/bordereaux.service.js";

const SITE = "00000000-0000-4000-8000-000000000010";
const tresorerie = { scope: "TOUS", siteId: null } as never;
const siteUser = { scope: "SITE", siteId: SITE } as never;

function row(id: string) {
  return {
    id,
    siteId: SITE,
    site: { name: "Site", shortCode: "AAA" },
    periodIso: "S47",
    referenceYear: 2026,
    number: 1,
    version: 1,
    status: "DG_VALIDATED",
    exportedAt: null,
    invoice: { net: new Prisma.Decimal(100) },
    exportBatches: [],
    payments: [],
  };
}

describe("listExportQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.bordereau.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.bordereau.groupBy).mockResolvedValue([] as never);
  });

  it("filters on a group and counts both groups of the selection", async () => {
    vi.mocked(prisma.bordereau.groupBy).mockResolvedValue([
      { status: "DG_VALIDATED", _count: { _all: 3 } },
      { status: "EXPORTED", _count: { _all: 9 } },
    ] as never);

    const result = await listExportQueue(tresorerie, { group: "TO_EXPORT" });

    expect(prisma.bordereau.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { in: ["DG_VALIDATED"] } } }),
    );
    expect(result.counts).toEqual({ TO_EXPORT: 3, EXPORTED: 9, ALL: 12 });
  });

  it("no longer cuts the list silently at 200 rows", async () => {
    await listExportQueue(tresorerie, {});

    const args = vi.mocked(prisma.bordereau.findMany).mock.calls[0][0] as { take: number };
    expect(args.take).toBe(51);
  });

  it("pages with a cursor", async () => {
    vi.mocked(prisma.bordereau.findMany).mockResolvedValue([row("a"), row("b"), row("c")] as never);

    const first = await listExportQueue(tresorerie, { take: 2 });
    expect(first.data.map((item) => item.id)).toEqual(["a", "b"]);
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).toBe("b");

    vi.mocked(prisma.bordereau.findMany).mockResolvedValue([row("c")] as never);
    const last = await listExportQueue(tresorerie, { take: 2, cursor: "b" });
    expect(prisma.bordereau.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: { id: "b" }, skip: 1 }),
    );
    expect(last.hasMore).toBe(false);
  });

  it("keeps a site-scoped user on their own site", async () => {
    await listExportQueue(siteUser, {});

    expect(prisma.bordereau.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { siteId: SITE, status: { in: ["DG_VALIDATED", "EXPORTED"] } },
      }),
    );
  });
});
