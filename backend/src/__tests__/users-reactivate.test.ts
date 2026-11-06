import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

const MOCK_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_USER_ID = "00000000-0000-4000-8000-000000000050";

const mockUser = {
  id: MOCK_USER_ID,
  email: "worker@alterra.test",
  phone: null,
  role: Role.CHEF_EQUIPE,
  firstName: "Jean",
  lastName: "Rakoto",
  siteId: null,
  teamId: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("../lib/redis.js", () => ({
  isUserBlocked: vi.fn().mockResolvedValue(false),
  areTokensRevoked: vi.fn().mockResolvedValue(false),
  unblockUser: vi.fn(),
}));

vi.mock("../services/audit/audit.service.js", () => ({
  writeAuditLog: vi.fn(),
}));

import { prisma } from "../lib/prisma.js";
import { unblockUser } from "../lib/redis.js";

function adminAuthHeader() {
  return `Bearer ${signAccessToken({
    sub: MOCK_ADMIN_ID,
    role: Role.ADMIN,
    siteId: null,
    teamId: null,
  })}`;
}

describe("PATCH /users/:id reactivation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lifts the Redis block when a deactivated user is reactivated", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ ...mockUser, active: false } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, active: true } as never);

    const app = createApp();
    const res = await request(app)
      .patch(`/api/v1/users/${MOCK_USER_ID}`)
      .set("Authorization", adminAuthHeader())
      .send({ active: true });

    expect(res.status).toBe(200);
    expect(unblockUser).toHaveBeenCalledWith(MOCK_USER_ID);
  });

  it("does not touch the Redis block for an unrelated field update on an active user", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ ...mockUser, active: true } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, active: true } as never);

    const app = createApp();
    const res = await request(app)
      .patch(`/api/v1/users/${MOCK_USER_ID}`)
      .set("Authorization", adminAuthHeader())
      .send({ firstName: "Jeanne" });

    expect(res.status).toBe(200);
    expect(unblockUser).not.toHaveBeenCalled();
  });

  it("does not call unblockUser when deactivating (active stays false->false is a no-op, false->... not reactivation)", async () => {
    vi.mocked(prisma.user.findFirst).mockResolvedValue({ ...mockUser, active: true } as never);
    vi.mocked(prisma.user.update).mockResolvedValue({ ...mockUser, active: false } as never);

    const app = createApp();
    const res = await request(app)
      .patch(`/api/v1/users/${MOCK_USER_ID}`)
      .set("Authorization", adminAuthHeader())
      .send({ active: false });

    expect(res.status).toBe(200);
    expect(unblockUser).not.toHaveBeenCalled();
  });
});
