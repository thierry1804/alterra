import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    pointage: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

vi.mock("../services/notifications/notification.service.js", async () => {
  const actual = await vi.importActual<
    typeof import("../services/notifications/notification.service.js")
  >("../services/notifications/notification.service.js");
  return {
    ...actual,
    createAndDispatchMany: vi.fn(),
  };
});

vi.mock("../realtime/socket.js", () => ({ emitToUser: vi.fn() }));
vi.mock("../services/notifications/web-push.service.js", () => ({
  sendWebPushToUser: vi.fn(),
}));
vi.mock("../services/audit/audit.service.js", () => ({ writeAuditLog: vi.fn() }));

import { prisma } from "../lib/prisma.js";
import { createAndDispatchMany } from "../services/notifications/notification.service.js";
import {
  notifyPointagesRejected,
  notifyPointagesValidated,
} from "../services/notifications/notify-helpers.js";

const TEAM_A = "00000000-0000-4000-8000-00000000000a";
const TEAM_B = "00000000-0000-4000-8000-00000000000b";
const CDE_A = "00000000-0000-4000-8000-0000000000a1";
const CDE_B = "00000000-0000-4000-8000-0000000000b1";
const POINTAGE_A = "00000000-0000-4000-8000-0000000000p1";
const POINTAGE_B = "00000000-0000-4000-8000-0000000000p2";

function ctx() {
  return { actorUserId: "00000000-0000-4000-8000-000000000001" };
}

describe("notify-helpers — cross-team isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.pointage.findMany).mockResolvedValue([
      { id: POINTAGE_A, worker: { teamId: TEAM_A } },
      { id: POINTAGE_B, worker: { teamId: TEAM_B } },
    ] as never);
    vi.mocked(prisma.user.findMany).mockImplementation(({ where }: never) => {
      if (where.teamId === TEAM_A) return Promise.resolve([{ id: CDE_A }]) as never;
      if (where.teamId === TEAM_B) return Promise.resolve([{ id: CDE_B }]) as never;
      return Promise.resolve([]) as never;
    });
  });

  it("notifyPointagesRejected only tells each team about its own pointages", async () => {
    await notifyPointagesRejected([POINTAGE_A, POINTAGE_B], "motif", ctx());

    const calls = vi.mocked(createAndDispatchMany).mock.calls.flatMap(([inputs]) => inputs);
    expect(calls).toHaveLength(2);

    const forA = calls.find((c) => c.userId === CDE_A)!;
    expect(forA.title).toBe("Pointage rejeté");
    expect(forA.payload).toMatchObject({ pointageIds: [POINTAGE_A] });

    const forB = calls.find((c) => c.userId === CDE_B)!;
    expect(forB.title).toBe("Pointage rejeté");
    expect(forB.payload).toMatchObject({ pointageIds: [POINTAGE_B] });
  });

  it("notifyPointagesValidated only tells each team about its own pointages", async () => {
    await notifyPointagesValidated([POINTAGE_A, POINTAGE_B], ctx());

    const calls = vi.mocked(createAndDispatchMany).mock.calls.flatMap(([inputs]) => inputs);
    expect(calls).toHaveLength(2);

    const forA = calls.find((c) => c.userId === CDE_A)!;
    expect(forA.payload).toMatchObject({ pointageIds: [POINTAGE_A] });
    expect((forA.payload as { pointageIds: string[] }).pointageIds).not.toContain(POINTAGE_B);

    const forB = calls.find((c) => c.userId === CDE_B)!;
    expect(forB.payload).toMatchObject({ pointageIds: [POINTAGE_B] });
    expect((forB.payload as { pointageIds: string[] }).pointageIds).not.toContain(POINTAGE_A);
  });

  it("uses the plural title with the per-team count, not the global count", async () => {
    vi.mocked(prisma.pointage.findMany).mockResolvedValue([
      { id: POINTAGE_A, worker: { teamId: TEAM_A } },
      { id: "p3", worker: { teamId: TEAM_A } },
      { id: POINTAGE_B, worker: { teamId: TEAM_B } },
    ] as never);

    await notifyPointagesRejected([POINTAGE_A, "p3", POINTAGE_B], "motif", ctx());

    const calls = vi.mocked(createAndDispatchMany).mock.calls.flatMap(([inputs]) => inputs);
    const forA = calls.find((c) => c.userId === CDE_A)!;
    expect(forA.title).toBe("2 pointages rejetés");
    expect((forA.payload as { pointageIds: string[] }).pointageIds).toEqual([POINTAGE_A, "p3"]);

    const forB = calls.find((c) => c.userId === CDE_B)!;
    expect(forB.title).toBe("Pointage rejeté");
    expect((forB.payload as { pointageIds: string[] }).pointageIds).toEqual([POINTAGE_B]);
  });
});
