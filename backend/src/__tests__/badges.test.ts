import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { resetRedisForTests } from "../lib/redis.js";

const MOCK_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_CDE_ID = "00000000-0000-4000-8000-000000000003";
const MOCK_WORKER_ID = "00000000-0000-4000-8000-000000000060";
const MOCK_BADGE_ID = "00000000-0000-4000-8000-000000000080";
const MOCK_TEAM_ID = "00000000-0000-4000-8000-000000000040";
const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    badge: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    worker: {
      findFirst: vi.fn(),
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

function adminToken() {
  return signAccessToken({
    sub: MOCK_ADMIN_ID,
    role: Role.ADMIN,
    siteId: null,
    teamId: null,
  });
}

function cdeToken() {
  return signAccessToken({
    sub: MOCK_CDE_ID,
    role: Role.CHEF_EQUIPE,
    siteId: MOCK_SITE_ID,
    teamId: MOCK_TEAM_ID,
  });
}

describe("badges routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRedisForTests();
  });

  it("GET /badges lists badges for CDE", async () => {
    vi.mocked(prisma.badge.findMany).mockResolvedValue([
      {
        id: MOCK_BADGE_ID,
        workerId: MOCK_WORKER_ID,
        nfcTagId: "a1b2c3d4",
        assignedAt: new Date(),
        revokedAt: null,
        worker: {
          id: MOCK_WORKER_ID,
          firstName: "MOC",
          lastName: "Test",
          matricule: "MOC-1",
          siteId: MOCK_SITE_ID,
          teamId: MOCK_TEAM_ID,
        },
      },
    ] as never);

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/badges?active=true")
      .set("Authorization", `Bearer ${cdeToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it("POST /badges creates badge for admin", async () => {
    vi.mocked(prisma.worker.findFirst).mockResolvedValue({ id: MOCK_WORKER_ID } as never);
    vi.mocked(prisma.badge.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.badge.create).mockResolvedValue({
      id: MOCK_BADGE_ID,
      workerId: MOCK_WORKER_ID,
      nfcTagId: "a1b2c3d4",
      assignedAt: new Date(),
      revokedAt: null,
      worker: { id: MOCK_WORKER_ID, firstName: "MOC", lastName: "Test", matricule: "MOC-1" },
    } as never);

    const app = createApp();
    const res = await request(app)
      .post("/api/v1/badges")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ workerId: MOCK_WORKER_ID, nfcTagId: "A1:B2:C3:D4" });

    expect(res.status).toBe(201);
    expect(res.body.nfcTagId).toBe("a1b2c3d4");
  });

  it("DELETE /badges/:id revokes badge", async () => {
    vi.mocked(prisma.badge.findUnique).mockResolvedValue({
      id: MOCK_BADGE_ID,
      workerId: MOCK_WORKER_ID,
      nfcTagId: "a1b2c3d4",
    } as never);
    vi.mocked(prisma.badge.update).mockResolvedValue({
      id: MOCK_BADGE_ID,
      revokedAt: new Date(),
    } as never);

    const app = createApp();
    const res = await request(app)
      .delete(`/api/v1/badges/${MOCK_BADGE_ID}`)
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(prisma.badge.update).toHaveBeenCalled();
  });
});
