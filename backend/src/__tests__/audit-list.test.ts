import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma-base.js", () => ({
  basePrisma: {
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

import { basePrisma } from "../lib/prisma-base.js";
import { listAuditLogs } from "../services/audit/list.service.js";

describe("audit list service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns paginated audit rows with user email", async () => {
    vi.mocked(basePrisma.auditLog.findMany).mockResolvedValue([
      {
        id: BigInt(42),
        userId: "user-1",
        action: "UPDATE",
        entityType: "Pointage",
        entityId: "ptg-1",
        before: { amount: 1000 },
        after: { amount: 1200 },
        ip: "127.0.0.1",
        userAgent: "test",
        createdAt: new Date("2026-07-01T10:00:00.000Z"),
      },
    ] as never);
    vi.mocked(basePrisma.auditLog.count).mockResolvedValue(1 as never);
    vi.mocked(basePrisma.user.findMany).mockResolvedValue([
      { id: "user-1", email: "admin@alterra.mg" },
    ] as never);

    const result = await listAuditLogs({ page: 1, limit: 50 });

    expect(result.total).toBe(1);
    expect(result.data[0].id).toBe("42");
    expect(result.data[0].userEmail).toBe("admin@alterra.mg");
    expect(result.data[0].before).toEqual({ amount: 1000 });
  });
});
