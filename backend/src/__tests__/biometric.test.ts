import { beforeEach, describe, expect, it, vi } from "vitest";
import { BioContext, BioProvider, BioResult, Role } from "@prisma/client";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

const MOCK_CDS_ID = "00000000-0000-4000-8000-000000000002";
const MOCK_WORKER_ID = "00000000-0000-4000-8000-000000000100";
const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    worker: {
      findUniqueOrThrow: vi.fn(),
    },
    biometricCheck: {
      create: vi.fn(),
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
});
