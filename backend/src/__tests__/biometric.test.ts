import { beforeEach, describe, expect, it, vi } from "vitest";
import { BioContext, BioProvider, BioResult, Role } from "@prisma/client";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

const MOCK_CDS_ID = "00000000-0000-4000-8000-000000000002";
const MOCK_CDE_ID = "00000000-0000-4000-8000-000000000003";
const MOCK_WORKER_ID = "00000000-0000-4000-8000-000000000100";
const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";
const MOCK_TEAM_ID = "00000000-0000-4000-8000-000000000020";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    worker: {
      findUniqueOrThrow: vi.fn(),
    },
    biometricCheck: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "../lib/prisma.js";

function cdsAuthHeader() {
  return `Bearer ${signAccessToken({
    sub: MOCK_CDS_ID,
    role: Role.CHEF_SERVICE,
    siteId: MOCK_SITE_ID,
    teamId: null,
  })}`;
}

function cdeAuthHeader() {
  return `Bearer ${signAccessToken({
    sub: MOCK_CDE_ID,
    role: Role.CHEF_EQUIPE,
    siteId: MOCK_SITE_ID,
    teamId: MOCK_TEAM_ID,
  })}`;
}

describe("biometric endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.worker.findUniqueOrThrow).mockResolvedValue({
      id: MOCK_WORKER_ID,
      mvolaNumber: "0340000001",
    } as never);
    vi.mocked(prisma.biometricCheck.create).mockResolvedValue({
      id: "bio-1",
      workerId: MOCK_WORKER_ID,
      context: BioContext.WEEKLY_VALIDATION,
      result: BioResult.OK,
      score: 0.97,
      provider: BioProvider.MOCK,
      performedById: MOCK_CDS_ID,
      performedAt: new Date("2026-07-21T10:00:00.000Z"),
      weekIso: "2026-W29",
      rawResponse: { provider: "MOCK" },
    } as never);
  });

  it("POST /biometric/check creates check with mock OK when photo provided", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/biometric/check")
      .set("Authorization", cdsAuthHeader())
      .send({
        workerId: MOCK_WORKER_ID,
        photoBase64: "a".repeat(64),
      });

    expect(res.status).toBe(201);
    expect(res.body.result).toBe("OK");
    expect(prisma.biometricCheck.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workerId: MOCK_WORKER_ID,
          result: BioResult.OK,
        }),
      }),
    );
  });

  describe("POST /biometric/check-offline", () => {
    beforeEach(() => {
      vi.mocked(prisma.biometricCheck.findFirst).mockResolvedValue(null);
    });

    it("rejects a performedAt in the future (RG-03 bypass guard)", async () => {
      const app = createApp();
      const futurePerformedAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .post("/api/v1/biometric/check-offline")
        .set("Authorization", cdeAuthHeader())
        .send({
          clientUuid: "00000000-0000-4000-8000-000000000200",
          workerId: MOCK_WORKER_ID,
          result: "OK",
          score: 1,
          referenceDate: new Date().toISOString(),
          performedAt: futurePerformedAt,
        });

      expect(res.status).toBe(422);
      expect(prisma.biometricCheck.create).not.toHaveBeenCalled();
    });

    it("accepts a performedAt in the past", async () => {
      const app = createApp();

      const res = await request(app)
        .post("/api/v1/biometric/check-offline")
        .set("Authorization", cdeAuthHeader())
        .send({
          clientUuid: "00000000-0000-4000-8000-000000000201",
          workerId: MOCK_WORKER_ID,
          result: "OK",
          score: 1,
          performedAt: new Date("2026-07-21T10:00:00.000Z").toISOString(),
        });

      expect(res.status).toBe(201);
      expect(prisma.biometricCheck.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            workerId: MOCK_WORKER_ID,
            result: BioResult.OK,
            provider: BioProvider.LOCAL_OFFLINE,
          }),
        }),
      );
    });
  });
});
