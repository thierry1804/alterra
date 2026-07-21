import { Role } from "@prisma/client";
import argon2 from "argon2";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { decodeTokenHeader } from "../lib/jwt.js";
import { resetRedisForTests } from "../lib/redis.js";
import { encryptMfaSecret, clearPendingMfaForTests } from "../services/auth/mfa.service.js";
import { generateSecret, generateSync } from "otplib";

const MOCK_USER_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";

const mockUser = {
  id: MOCK_USER_ID,
  email: "admin@alterra.mg",
  passwordHash: "",
  role: Role.ADMIN,
  firstName: "Admin",
  lastName: "ALTERRA",
  active: true,
  mfaSecret: null as string | null,
  siteId: MOCK_SITE_ID,
  lastLoginAt: null,
};

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "../lib/prisma.js";

describe("auth endpoints", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetRedisForTests();
    clearPendingMfaForTests();
    mockUser.passwordHash = await argon2.hash("ChangeMe123!", { type: argon2.argon2id });
    mockUser.mfaSecret = null;

    vi.mocked(prisma.user.findUnique).mockImplementation(async ({ where }) => {
      if ("email" in where && where.email === mockUser.email) return { ...mockUser };
      if ("id" in where && where.id === mockUser.id) return { ...mockUser };
      return null;
    });
    vi.mocked(prisma.user.update).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.refreshToken.create).mockResolvedValue({
      id: "rt-1",
      userId: MOCK_USER_ID,
      tokenHash: "hash",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
      deviceInfo: null,
      createdAt: new Date(),
    });
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("DB unavailable"));
  });

  afterEach(async () => {
    await resetRedisForTests();
    clearPendingMfaForTests();
  });

  it("POST /auth/login with invalid credentials returns 401", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@alterra.mg", password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("POST /auth/login with valid credentials returns 200 and accessToken", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@alterra.mg", password: "ChangeMe123!" });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf("string");
    expect(res.body.user.email).toBe("admin@alterra.mg");
    expect(prisma.refreshToken.create).toHaveBeenCalledOnce();
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("access token is signed with HS256", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@alterra.mg", password: "ChangeMe123!" });

    const header = decodeTokenHeader(res.body.accessToken);
    expect(header.alg).toBe("HS256");
  });

  it("POST /auth/refresh without cookie returns 401", async () => {
    const app = createApp();
    const res = await request(app).post("/api/v1/auth/refresh");

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("MISSING_REFRESH_TOKEN");
  });

  it("POST /auth/login requires MFA when admin has mfaSecret set", async () => {
    const secret = generateSecret();
    mockUser.mfaSecret = encryptMfaSecret(secret);

    const app = createApp();

    const withoutMfa = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@alterra.mg", password: "ChangeMe123!" });

    expect(withoutMfa.status).toBe(401);
    expect(withoutMfa.body.code).toBe("MFA_REQUIRED");

    const code = generateSync({ secret });
    const withMfa = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@alterra.mg", password: "ChangeMe123!", mfaCode: code });

    expect(withMfa.status).toBe(200);
    expect(withMfa.body.accessToken).toBeTypeOf("string");
  });
});
