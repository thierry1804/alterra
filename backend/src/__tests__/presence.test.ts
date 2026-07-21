import { PresenceSource, Prisma, Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { resetRedisForTests } from "../lib/redis.js";

const MOCK_CDE_ID = "00000000-0000-4000-8000-000000000003";
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
});
