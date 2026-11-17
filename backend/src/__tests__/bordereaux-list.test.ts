import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    bordereau: { findMany: vi.fn(), groupBy: vi.fn() },
  },
}));

import { prisma } from "../lib/prisma.js";
import { listBordereaux } from "../services/payments/bordereaux.service.js";

const SITE = "00000000-0000-4000-8000-000000000010";

function row(id: string) {
  return {
    id,
    siteId: SITE,
    site: { id: SITE, name: "Site", shortCode: "AAA" },
    periodIso: "S47",
    referenceYear: 2026,
    number: 1,
    version: 1,
    status: "GENERATED",
    createdAt: new Date("2026-11-17T00:00:00Z"),
    financeValidatedAt: null,
    dgValidatedAt: null,
    returnReason: null,
    payments: [],
  };
}

describe("listBordereaux", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.bordereau.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.bordereau.groupBy).mockResolvedValue([] as never);
  });

  it("filters on the chosen week and leaves out replaced versions", async () => {
    await listBordereaux({ periodIso: "2026-W47" });

    expect(prisma.bordereau.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { periodIso: "S47", referenceYear: 2026, status: { not: "SUPERSEDED" } },
      }),
    );
  });

  it("lists every week, most recent first, when no period is given", async () => {
    await listBordereaux({});

    expect(prisma.bordereau.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { not: "SUPERSEDED" } },
        orderBy: [{ referenceYear: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      }),
    );
  });

  it("keeps the site filter with or without a period", async () => {
    await listBordereaux({ siteId: SITE });

    expect(prisma.bordereau.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: { not: "SUPERSEDED" }, siteId: SITE } }),
    );
  });

  it("filters on a status group while counting every group of the selection", async () => {
    vi.mocked(prisma.bordereau.groupBy).mockResolvedValue([
      { status: "GENERATED", _count: { _all: 2 } },
      { status: "FINANCE_VALIDATED", _count: { _all: 1 } },
      { status: "DG_VALIDATED", _count: { _all: 4 } },
      { status: "EXPORTED", _count: { _all: 6 } },
    ] as never);

    const result = await listBordereaux({ group: "TO_VALIDATE" });

    expect(prisma.bordereau.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ["GENERATED", "FINANCE_VALIDATED"] } },
      }),
    );
    expect(result.counts).toEqual({ TO_VALIDATE: 3, TO_EXPORT: 4, EXPORTED: 6, ALL: 13 });
  });

  it("returns a page with a cursor when there are more rows", async () => {
    vi.mocked(prisma.bordereau.findMany).mockResolvedValue([row("a"), row("b"), row("c")] as never);

    const result = await listBordereaux({ take: 2 });

    expect(result.data.map((item) => item.id)).toEqual(["a", "b"]);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBe("b");
    expect(prisma.bordereau.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));
  });

  it("continues after the cursor and ends on the last page", async () => {
    vi.mocked(prisma.bordereau.findMany).mockResolvedValue([row("c")] as never);

    const result = await listBordereaux({ take: 2, cursor: "b" });

    expect(prisma.bordereau.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "b" }, skip: 1 }),
    );
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeNull();
  });
});
