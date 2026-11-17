import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    parcelle: { findUnique: vi.fn(), count: vi.fn() },
    worker: { findUnique: vi.fn() },
    pointage: { findFirst: vi.fn(), create: vi.fn() },
    activitySubActivity: { findUniqueOrThrow: vi.fn() },
  },
}));

import { prisma } from "../lib/prisma.js";
import {
  PARCELLE_REQUIRED_MESSAGE,
  createParcelleChecker,
} from "../services/pointages/parcelle-rule.js";
import { syncPointageBatch } from "../services/pointages/sync.service.js";

const SITE = "00000000-0000-4000-8000-000000000010";
const OTHER_SITE = "00000000-0000-4000-8000-000000000011";
const PARCELLE = "00000000-0000-4000-8000-0000000000a1";

describe("parcelle rule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.parcelle.count).mockResolvedValue(3);
    vi.mocked(prisma.parcelle.findUnique).mockResolvedValue({ zone: { siteId: SITE } } as never);
  });

  it("requires a parcelle once the site has some", async () => {
    expect(await createParcelleChecker().check(undefined, SITE)).toBe(PARCELLE_REQUIRED_MESSAGE);
    expect(await createParcelleChecker().check(null, SITE)).toBe(PARCELLE_REQUIRED_MESSAGE);
  });

  it("does not block a site that has no parcelle yet", async () => {
    vi.mocked(prisma.parcelle.count).mockResolvedValue(0);
    expect(await createParcelleChecker().check(undefined, SITE)).toBeNull();
  });

  it("accepts a parcelle of the worker's site", async () => {
    expect(await createParcelleChecker().check(PARCELLE, SITE)).toBeNull();
  });

  it("refuses an unknown parcelle and one from another site", async () => {
    vi.mocked(prisma.parcelle.findUnique).mockResolvedValue(null);
    expect(await createParcelleChecker().check(PARCELLE, SITE)).toBe("Parcelle introuvable");

    vi.mocked(prisma.parcelle.findUnique).mockResolvedValue({
      zone: { siteId: OTHER_SITE },
    } as never);
    expect(await createParcelleChecker().check(PARCELLE, SITE)).toBe(
      "Cette parcelle n'appartient pas au site du travailleur",
    );
  });

  it("looks each parcelle and site up only once per batch", async () => {
    const checker = createParcelleChecker();
    await checker.check(PARCELLE, SITE);
    await checker.check(PARCELLE, SITE);
    await checker.check(undefined, SITE);
    await checker.check(undefined, SITE);
    expect(prisma.parcelle.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.parcelle.count).toHaveBeenCalledTimes(1);
  });
});

describe("pointage sync with the parcelle rule", () => {
  const actor = { id: "u1", scope: "TOUS" as const, teamId: null, siteId: null };

  function item(parcelleId?: string) {
    return {
      clientUuid: crypto.randomUUID(),
      workerId: "00000000-0000-4000-8000-000000000040",
      subActivityId: "00000000-0000-4000-8000-000000000090",
      quantity: 5,
      date: new Date(),
      createdByClientAt: new Date(),
      parcelleId,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.parcelle.count).mockResolvedValue(2);
    vi.mocked(prisma.parcelle.findUnique).mockResolvedValue({ zone: { siteId: SITE } } as never);
    vi.mocked(prisma.worker.findUnique).mockResolvedValue({ teamId: null, siteId: SITE } as never);
    vi.mocked(prisma.pointage.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.activitySubActivity.findUniqueOrThrow).mockResolvedValue({
      unitRate: new Prisma.Decimal("30"),
    } as never);
    vi.mocked(prisma.pointage.create).mockResolvedValue({ id: "p1" } as never);
  });

  it("rejects a pointage without parcelle when the site has parcelles", async () => {
    const [result] = await syncPointageBatch([item()], actor);
    expect(result).toEqual(
      expect.objectContaining({ status: "rejected", reason: PARCELLE_REQUIRED_MESSAGE }),
    );
    expect(prisma.pointage.create).not.toHaveBeenCalled();
  });

  it("rejects a parcelle of another site", async () => {
    vi.mocked(prisma.parcelle.findUnique).mockResolvedValue({
      zone: { siteId: OTHER_SITE },
    } as never);
    const [result] = await syncPointageBatch([item(PARCELLE)], actor);
    expect(result.status).toBe("rejected");
    expect(prisma.pointage.create).not.toHaveBeenCalled();
  });

  it("saves the parcelle on the pointage", async () => {
    const [result] = await syncPointageBatch([item(PARCELLE)], actor);
    expect(result.status).toBe("created");
    expect(prisma.pointage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ parcelleId: PARCELLE }),
    });
  });

  it("still accepts a pointage without parcelle on a site that has none", async () => {
    vi.mocked(prisma.parcelle.count).mockResolvedValue(0);
    const [result] = await syncPointageBatch([item()], actor);
    expect(result.status).toBe("created");
  });
});
