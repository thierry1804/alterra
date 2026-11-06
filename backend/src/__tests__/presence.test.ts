import { PresenceSource, Prisma, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { resetRedisForTests } from "../lib/redis.js";

const MOCK_CDE_ID = "00000000-0000-4000-8000-000000000003";
const MOCK_CDS_ID = "00000000-0000-4000-8000-000000000002";
const MOCK_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";
const MOCK_TEAM_ID = "00000000-0000-4000-8000-000000000040";
const MOCK_WORKER_ID = "00000000-0000-4000-8000-000000000060";
const MOCK_CLIENT_UUID = "00000000-0000-4000-8000-000000000070";
const MOCK_PRESENCE_ID = "00000000-0000-4000-8000-000000000071";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    worker: {
      findFirst: vi.fn(),
    },
    presenceRecord: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
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

function cdsToken(siteId: string | null = MOCK_SITE_ID) {
  return signAccessToken({
    sub: MOCK_CDS_ID,
    role: Role.CHEF_SERVICE,
    siteId,
    teamId: null,
  });
}

describe("presence routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRedisForTests();
  });

  it("POST /presence/sync creates presence idempotently", async () => {
    vi.mocked(prisma.worker.findFirst).mockResolvedValue({ id: MOCK_WORKER_ID } as never);
    vi.mocked(prisma.presenceRecord.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.presenceRecord.create).mockResolvedValue({
      id: MOCK_PRESENCE_ID,
      clientUuid: MOCK_CLIENT_UUID,
    } as never);

    const app = createApp();
    const payload = {
      batch: [
        {
          clientUuid: MOCK_CLIENT_UUID,
          workerId: MOCK_WORKER_ID,
          date: "2026-07-21",
          arrivalTime: "2026-07-21T04:12:00.000Z",
          badgeNfcTagId: "a1b2c3d4",
          source: PresenceSource.NFC,
          createdByClientAt: "2026-07-21T04:12:00.000Z",
        },
      ],
    };

    const res = await request(app)
      .post("/api/v1/presence/sync")
      .set("Authorization", `Bearer ${cdeToken()}`)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.results[0].status).toBe("created");
    expect(prisma.presenceRecord.create).toHaveBeenCalled();
  });

  it("POST /presence/sync returns already_exists on duplicate clientUuid", async () => {
    vi.mocked(prisma.worker.findFirst).mockResolvedValue({ id: MOCK_WORKER_ID } as never);
    vi.mocked(prisma.presenceRecord.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.presenceRecord.create).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    vi.mocked(prisma.presenceRecord.findUnique).mockResolvedValue({
      id: MOCK_PRESENCE_ID,
      clientUuid: MOCK_CLIENT_UUID,
    } as never);

    const app = createApp();
    const res = await request(app)
      .post("/api/v1/presence/sync")
      .set("Authorization", `Bearer ${cdeToken()}`)
      .send({
        batch: [
          {
            clientUuid: MOCK_CLIENT_UUID,
            workerId: MOCK_WORKER_ID,
            date: "2026-07-21",
            arrivalTime: "2026-07-21T04:12:00.000Z",
            badgeNfcTagId: "a1b2c3d4",
            source: PresenceSource.MANUAL,
            createdByClientAt: "2026-07-21T04:12:00.000Z",
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.results[0].status).toBe("already_exists");
  });

  it("GET /presence lists records", async () => {
    vi.mocked(prisma.presenceRecord.findMany).mockResolvedValue([
      {
        id: MOCK_PRESENCE_ID,
        clientUuid: MOCK_CLIENT_UUID,
        worker: { id: MOCK_WORKER_ID, firstName: "MOC", lastName: "Test", matricule: "MOC-1" },
      },
    ] as never);

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/presence")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it("GET /presence scopes a CHEF_EQUIPE to their own team", async () => {
    vi.mocked(prisma.presenceRecord.findMany).mockResolvedValue([]);

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/presence")
      .set("Authorization", `Bearer ${cdeToken()}`);

    expect(res.status).toBe(200);
    expect(prisma.presenceRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ worker: { teamId: MOCK_TEAM_ID } }),
      }),
    );
  });

  it("GET /presence scopes a CHEF_SERVICE to their own site", async () => {
    vi.mocked(prisma.presenceRecord.findMany).mockResolvedValue([]);

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/presence")
      .set("Authorization", `Bearer ${cdsToken()}`);

    expect(res.status).toBe(200);
    expect(prisma.presenceRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ worker: { siteId: MOCK_SITE_ID } }),
      }),
    );
  });

  it("GET /presence returns nothing for a CDS without a site (fails closed)", async () => {
    vi.mocked(prisma.presenceRecord.findMany).mockResolvedValue([]);

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/presence")
      .set("Authorization", `Bearer ${cdsToken(null)}`);

    expect(res.status).toBe(200);
    expect(prisma.presenceRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "00000000-0000-0000-0000-000000000000" }),
      }),
    );
  });

  it("GET /presence does not scope an ADMIN", async () => {
    vi.mocked(prisma.presenceRecord.findMany).mockResolvedValue([]);

    const app = createApp();
    const res = await request(app)
      .get("/api/v1/presence")
      .set("Authorization", `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    const calledWhere = vi.mocked(prisma.presenceRecord.findMany).mock.calls[0][0].where;
    expect(calledWhere).not.toHaveProperty("worker");
  });
});
