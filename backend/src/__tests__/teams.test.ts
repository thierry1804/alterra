import { Role, WorkerStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { resetRedisForTests } from "../lib/redis.js";

const MOCK_CDS_ID = "00000000-0000-4000-8000-000000000002";
const MOCK_CDE_ID = "00000000-0000-4000-8000-000000000003";
const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";
const MOCK_TEAM_ID = "00000000-0000-4000-8000-000000000040";
const MOCK_WORKER_ID = "00000000-0000-4000-8000-000000000060";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    team: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
  basePrisma: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    worker: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../lib/prisma-base.js", () => ({
  basePrisma: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    worker: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../services/audit/audit.service.js", () => ({
  writeAuditLog: vi.fn(),
}));

import { prisma, basePrisma } from "../lib/prisma.js";

function cdsToken() {
  return signAccessToken({
    sub: MOCK_CDS_ID,
    role: Role.CHEF_SERVICE,
    siteId: MOCK_SITE_ID,
    teamId: null,
  });
}

function cdeToken(teamId = MOCK_TEAM_ID) {
  return signAccessToken({
    sub: MOCK_CDE_ID,
    role: Role.CHEF_EQUIPE,
    siteId: MOCK_SITE_ID,
    teamId,
  });
}

const mockTeam = {
  id: MOCK_TEAM_ID,
  siteId: MOCK_SITE_ID,
  name: "MNK-1",
  chefId: MOCK_CDE_ID,
  active: true,
  createdAt: new Date(),
  workers: [
    {
      id: MOCK_WORKER_ID,
      matricule: "MOC-MNK-01",
      firstName: "MOC",
      lastName: "Test",
      teamId: MOCK_TEAM_ID,
    },
  ],
};

describe("teams routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRedisForTests();
  });

  it("GET /teams lists teams for CDS", async () => {
    vi.mocked(prisma.team.findMany).mockResolvedValue([
      {
        ...mockTeam,
        _count: { workers: 1 },
      },
    ] as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: MOCK_CDE_ID,
      firstName: "Chef",
      lastName: "Equipe",
      email: "cde@alterra.test",
    } as never);

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/teams")
      .set("Authorization", `Bearer ${cdsToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].memberCount).toBe(1);
  });

  it("POST /teams creates team for CDS", async () => {
    vi.mocked(prisma.team.create).mockResolvedValue(mockTeam as never);
    vi.mocked(prisma.team.findFirst).mockResolvedValue(mockTeam as never);
    vi.mocked(prisma.user.findFirst).mockResolvedValue({
      id: MOCK_CDE_ID,
      firstName: "Chef",
      lastName: "Equipe",
      email: "cde@alterra.test",
      teamId: MOCK_TEAM_ID,
    } as never);

    const app = createApp();
    const res = await request(app)
      .post("/api/v1/teams")
      .set("Authorization", `Bearer ${cdsToken()}`)
      .send({ name: "MNK-4" });

    expect(res.status).toBe(201);
    expect(prisma.team.create).toHaveBeenCalled();
    expect(res.body.name).toBe("MNK-1");
  });

  it("POST /teams rejects CDE", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/teams")
      .set("Authorization", `Bearer ${cdeToken()}`)
      .send({ name: "MNK-9" });

    expect(res.status).toBe(403);
  });

  it("POST /teams/:id/members adds worker for CDE on own team", async () => {
    vi.mocked(prisma.team.findFirst).mockResolvedValue(mockTeam as never);
    vi.mocked(basePrisma.worker.findFirst).mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000061",
      siteId: MOCK_SITE_ID,
      teamId: null,
      status: WorkerStatus.ACTIVE,
      deletedAt: null,
    } as never);
    vi.mocked(basePrisma.worker.update).mockResolvedValue({
      id: "00000000-0000-4000-8000-000000000061",
      teamId: MOCK_TEAM_ID,
    } as never);

    const app = createApp();
    const res = await request(app)
      .post(`/api/v1/teams/${MOCK_TEAM_ID}/members`)
      .set("Authorization", `Bearer ${cdeToken()}`)
      .send({ workerId: "00000000-0000-4000-8000-000000000061" });

    expect(res.status).toBe(201);
    expect(basePrisma.worker.update).toHaveBeenCalled();
  });

  it("DELETE /teams/:id/members/:workerId removes worker", async () => {
    vi.mocked(prisma.team.findFirst).mockResolvedValue(mockTeam as never);
    vi.mocked(basePrisma.worker.findFirst).mockResolvedValue({
      id: MOCK_WORKER_ID,
      teamId: MOCK_TEAM_ID,
      deletedAt: null,
    } as never);
    vi.mocked(basePrisma.worker.update).mockResolvedValue({
      id: MOCK_WORKER_ID,
      teamId: null,
    } as never);

    const app = createApp();
    const res = await request(app)
      .delete(`/api/v1/teams/${MOCK_TEAM_ID}/members/${MOCK_WORKER_ID}`)
      .set("Authorization", `Bearer ${cdeToken()}`);

    expect(res.status).toBe(200);
    expect(basePrisma.worker.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { teamId: null } }),
    );
  });

  it("GET /teams/chef-candidates returns CDE users for CDS", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      {
        id: MOCK_CDE_ID,
        firstName: "Chef",
        lastName: "Equipe",
        email: "cde@alterra.test",
        teamId: MOCK_TEAM_ID,
      },
    ] as never);

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/teams/chef-candidates")
      .set("Authorization", `Bearer ${cdsToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });
});
