import { BioProvider, BioResult, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { resetRedisForTests } from "../lib/redis.js";
import { buildMockDescriptor } from "../services/biometric/template.service.js";

const MOCK_CDE_ID = "00000000-0000-4000-8000-000000000003";
const MOCK_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_WORKER_ID = "00000000-0000-4000-8000-000000000100";
const MOCK_TEAM_ID = "00000000-0000-4000-8000-000000000040";
const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";
const MOCK_CLIENT_UUID = "00000000-0000-4000-8000-000000000090";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    biometricTemplate: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    worker: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    biometricCheck: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("../lib/prisma-base.js", () => ({
  basePrisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../services/audit/audit.service.js", () => ({
  writeAuditLog: vi.fn(),
}));

import { prisma } from "../lib/prisma.js";

function cdeToken() {
  return signAccessToken({
    sub: MOCK_CDE_ID,
    role: Role.CHEF_EQUIPE,
    siteId: MOCK_SITE_ID,
    teamId: MOCK_TEAM_ID,
  });
}

function adminToken() {
  return signAccessToken({
    sub: MOCK_ADMIN_ID,
    role: Role.ADMIN,
    siteId: null,
    teamId: null,
  });
}

describe("biometric templates and offline checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRedisForTests();
  });

  it("GET /biometric/templates/sync returns scoped templates", async () => {
    vi.mocked(prisma.biometricTemplate.findMany).mockResolvedValue([
      {
        workerId: MOCK_WORKER_ID,
        templateData: Buffer.from(JSON.stringify(buildMockDescriptor(MOCK_WORKER_ID))),
        source: BioProvider.MOCK,
        capturedAt: new Date("2026-01-01"),
        expiresAt: new Date("2027-01-01"),
      },
    ] as never);

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/biometric/templates/sync")
      .set("Authorization", `Bearer ${cdeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].descriptor).toHaveLength(128);
  });

  it("POST /biometric/templates upserts template for admin", async () => {
    vi.mocked(prisma.worker.findFirst).mockResolvedValue({ id: MOCK_WORKER_ID } as never);
    vi.mocked(prisma.biometricTemplate.upsert).mockResolvedValue({ id: "tpl-1" } as never);

    const app = createApp();
    const res = await request(app)
      .post("/api/v1/biometric/templates")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({
        workerId: MOCK_WORKER_ID,
        descriptor: buildMockDescriptor(MOCK_WORKER_ID),
      });

    expect(res.status).toBe(201);
    expect(prisma.biometricTemplate.upsert).toHaveBeenCalled();
  });

  it("POST /biometric/check-offline records local result", async () => {
    vi.mocked(prisma.worker.findUniqueOrThrow).mockResolvedValue({
      id: MOCK_WORKER_ID,
    } as never);
    vi.mocked(prisma.biometricCheck.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.biometricCheck.create).mockResolvedValue({
      id: "bio-offline-1",
      workerId: MOCK_WORKER_ID,
      result: BioResult.OK,
      score: 0.82,
      weekIso: "2026-W29",
      performedAt: new Date("2026-07-21T08:00:00.000Z"),
    } as never);

    const app = createApp();
    const res = await request(app)
      .post("/api/v1/biometric/check-offline")
      .set("Authorization", `Bearer ${cdeToken()}`)
      .send({
        clientUuid: MOCK_CLIENT_UUID,
        workerId: MOCK_WORKER_ID,
        result: BioResult.OK,
        score: 0.82,
        performedAt: "2026-07-21T08:00:00.000Z",
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("created");
  });
});
