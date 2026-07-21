import { createHash } from "node:crypto";
import { Role } from "@prisma/client";
import argon2 from "argon2";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { decodeTokenHeader, signAccessToken } from "../lib/jwt.js";
import { resetRedisForTests } from "../lib/redis.js";
import { encryptMfaSecret, clearPendingMfaForTests } from "../services/auth/mfa.service.js";
import { generateSecret, generateSync } from "otplib";

const MOCK_USER_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";
const RAW_REFRESH = "known-refresh-token-for-tests";
const REFRESH_HASH = createHash("sha256").update(RAW_REFRESH).digest("hex");

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

let refreshTokenState: { revokedAt: Date | null };

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
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
}));

import { prisma } from "../lib/prisma.js";

function adminAuthHeader() {
  return `Bearer ${signAccessToken({ sub: mockUser.id, role: mockUser.role, siteId: mockUser.siteId })}`;
}

describe("auth endpoints", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetRedisForTests();
    clearPendingMfaForTests();
    refreshTokenState = { revokedAt: null };
    mockUser.passwordHash = await argon2.hash("ChangeMe123!", { type: argon2.argon2id });
    mockUser.mfaSecret = null;

    vi.mocked(prisma.user.findUnique).mockImplementation(async ({ where }) => {
      if ("email" in where && where.email === mockUser.email) return { ...mockUser };
      if ("id" in where && where.id === mockUser.id) return { ...mockUser };
      return null;
    });
    vi.mocked(prisma.user.findUniqueOrThrow).mockImplementation(async ({ where }) => {
      if ("id" in where && where.id === mockUser.id) return { ...mockUser };
      throw new Error("User not found");
    });
    vi.mocked(prisma.user.update).mockResolvedValue(mockUser as never);
    vi.mocked(prisma.refreshToken.create).mockResolvedValue({
      id: "rt-new",
      userId: MOCK_USER_ID,
      tokenHash: "new-hash",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      revokedAt: null,
      deviceInfo: null,
      createdAt: new Date(),
    });
    vi.mocked(prisma.$transaction).mockImplementation(async (fn) =>
      fn(prisma as never),
    );
    vi.mocked(prisma.refreshToken.findUnique).mockImplementation(async ({ where }) => {
      if ("tokenHash" in where && where.tokenHash === REFRESH_HASH) {
        return {
          id: "rt-1",
          userId: MOCK_USER_ID,
          tokenHash: REFRESH_HASH,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          revokedAt: refreshTokenState.revokedAt,
          deviceInfo: "test-agent",
          createdAt: new Date(),
        };
      }
      return null;
    });
    vi.mocked(prisma.refreshToken.updateMany).mockImplementation(async ({ where }) => {
      if (
        "id" in where &&
        where.id === "rt-1" &&
        where.revokedAt === null &&
        !refreshTokenState.revokedAt
      ) {
        refreshTokenState.revokedAt = new Date();
        return { count: 1 };
      }
      return { count: 0 };
    });
    vi.mocked(prisma.refreshToken.update).mockImplementation(async () => {
      refreshTokenState.revokedAt = new Date();
      return {
        id: "rt-1",
        userId: MOCK_USER_ID,
        tokenHash: REFRESH_HASH,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: refreshTokenState.revokedAt,
        deviceInfo: "test-agent",
        createdAt: new Date(),
      };
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

  it("POST /auth/refresh with valid cookie returns new accessToken and cookie", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refreshToken=${RAW_REFRESH}`);

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTypeOf("string");
    expect(res.headers["set-cookie"]).toBeDefined();
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledOnce();
    expect(prisma.refreshToken.create).toHaveBeenCalledOnce();
  });

  it("POST /auth/refresh with reused token after rotation returns 401", async () => {
    const app = createApp();

    const first = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refreshToken=${RAW_REFRESH}`);
    expect(first.status).toBe(200);

    const second = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `refreshToken=${RAW_REFRESH}`);

    expect(second.status).toBe(401);
    expect(["INVALID_REFRESH_TOKEN", "REVOKED_REFRESH_TOKEN"]).toContain(second.body.code);
  });

  it("POST /auth/logout clears cookie and revokes refresh token", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("Authorization", adminAuthHeader())
      .set("Cookie", `refreshToken=${RAW_REFRESH}`);

    expect(res.status).toBe(204);
    expect(prisma.refreshToken.update).toHaveBeenCalledOnce();
    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join("; ") : setCookie;
    expect(cookieHeader).toMatch(/refreshToken=;/);
  });

  it("POST /auth/mfa/setup returns otpauthUrl and qrCodeDataUrl", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/auth/mfa/setup")
      .set("Authorization", adminAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.otpauthUrl).toMatch(/^otpauth:\/\//);
    expect(res.body.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
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
