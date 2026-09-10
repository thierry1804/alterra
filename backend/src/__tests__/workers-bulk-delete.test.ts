import { Role, WorkerStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { resetRedisForTests } from "../lib/redis.js";

const MOCK_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_CDE_ID = "00000000-0000-4000-8000-000000000003";
const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";
const MOCK_TEAM_ID = "00000000-0000-4000-8000-000000000040";
const MOCK_WORKER_ID_1 = "00000000-0000-4000-8000-000000000061";
const MOCK_WORKER_ID_2 = "00000000-0000-4000-8000-000000000062";
const MOCK_WORKER_ID_MISSING = "00000000-0000-4000-8000-000000000063";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    worker: {
      findFirst: vi.fn(),
      update: vi.fn(),
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

function mockWorker(id: string) {
  return {
    id,
    matricule: `MOC-MNK-${id.slice(-2)}`,
    firstName: "MOC",
    lastName: "Test",
    siteId: MOCK_SITE_ID,
    status: WorkerStatus.ACTIVE,
    deletedAt: null as Date | null,
  };
}

describe("POST /workers/bulk-delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetRedisForTests();
  });

  it("soft-deletes multiple workers", async () => {
    vi.mocked(prisma.worker.findFirst).mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(mockWorker(where.id) as never),
    );
    vi.mocked(prisma.worker.update).mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ ...mockWorker(where.id), deletedAt: new Date() } as never),
    );

    const app = createApp();
    const res = await request(app)
      .post("/api/v1/workers/bulk-delete")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ ids: [MOCK_WORKER_ID_1, MOCK_WORKER_ID_2] });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([
      { id: MOCK_WORKER_ID_1, status: "ok" },
      { id: MOCK_WORKER_ID_2, status: "ok" },
    ]);
    expect(prisma.worker.update).toHaveBeenCalledTimes(2);
    expect(prisma.worker.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { deletedAt: expect.any(Date) } }),
    );
  });

  it("reports a partial failure for an already-deleted/unknown id", async () => {
    vi.mocked(prisma.worker.findFirst).mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve(where.id === MOCK_WORKER_ID_MISSING ? null : (mockWorker(where.id) as never)),
    );
    vi.mocked(prisma.worker.update).mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ ...mockWorker(where.id), deletedAt: new Date() } as never),
    );

    const app = createApp();
    const res = await request(app)
      .post("/api/v1/workers/bulk-delete")
      .set("Authorization", `Bearer ${adminToken()}`)
      .send({ ids: [MOCK_WORKER_ID_1, MOCK_WORKER_ID_MISSING] });

    expect(res.status).toBe(200);
    expect(res.body.results).toEqual([
      { id: MOCK_WORKER_ID_1, status: "ok" },
      { id: MOCK_WORKER_ID_MISSING, status: "error", error: "Travailleur introuvable" },
    ]);
    expect(prisma.worker.update).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-admin role", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/workers/bulk-delete")
      .set("Authorization", `Bearer ${cdeToken()}`)
      .send({ ids: [MOCK_WORKER_ID_1] });

    expect(res.status).toBe(403);
    expect(prisma.worker.update).not.toHaveBeenCalled();
  });
});
