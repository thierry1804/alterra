import { createHash, randomBytes } from "node:crypto";
import type { Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { blacklistRefreshToken, isRefreshTokenBlacklisted } from "../../lib/redis.js";
import { signAccessToken } from "../../lib/jwt.js";
import { ApiError } from "../../middleware/error-handler.js";

export const REFRESH_COOKIE = "refreshToken";
export const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: REFRESH_MAX_AGE_MS,
  };
}

function remainingTtlSeconds(expiresAt: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 1000));
}

export function generateRawRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Issue a new refresh token, persist hash in DB, set HttpOnly cookie. */
export async function issueRefreshToken(
  userId: string,
  res: Response,
  deviceInfo?: string,
): Promise<void> {
  const raw = generateRawRefreshToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_MAX_AGE_MS);

  await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt, deviceInfo },
  });

  res.cookie(REFRESH_COOKIE, raw, cookieOptions());
}

/** Rotate refresh token: verify, revoke old, create new — atomically in one transaction. */
export async function rotateRefreshToken(rawToken: string, res: Response) {
  const tokenHash = hashToken(rawToken);

  if (await isRefreshTokenBlacklisted(tokenHash)) {
    throw new ApiError(401, "REVOKED_REFRESH_TOKEN", "Refresh token has been revoked");
  }

  const newRaw = generateRawRefreshToken();
  const newHash = hashToken(newRaw);
  const newExpiresAt = new Date(Date.now() + REFRESH_MAX_AGE_MS);

  const { stored, user } = await prisma.$transaction(async (tx) => {
    const row = await tx.refreshToken.findUnique({ where: { tokenHash } });
    if (!row || row.revokedAt || row.expiresAt <= new Date()) {
      throw new ApiError(401, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");
    }

    const { count } = await tx.refreshToken.updateMany({
      where: { id: row.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (count === 0) {
      throw new ApiError(401, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");
    }

    const activeUser = await tx.user.findUnique({ where: { id: row.userId } });
    if (!activeUser || !activeUser.active) {
      throw new ApiError(401, "INVALID_REFRESH_TOKEN", "User not found or inactive");
    }

    await tx.refreshToken.create({
      data: {
        userId: row.userId,
        tokenHash: newHash,
        expiresAt: newExpiresAt,
        deviceInfo: row.deviceInfo,
      },
    });

    return { stored: row, user: activeUser };
  });

  const ttl = remainingTtlSeconds(stored.expiresAt);
  await blacklistRefreshToken(tokenHash, ttl);
  res.cookie(REFRESH_COOKIE, newRaw, cookieOptions());

  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    siteId: user.siteId,
    teamId: user.teamId,
  });
  return { accessToken, user };
}

/** Revoke a refresh token from cookie value, blacklist in Redis, clear cookie. */
export async function revokeRefreshToken(rawToken: string | undefined, res: Response): Promise<void> {
  res.clearCookie(REFRESH_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  if (!rawToken) return;

  const tokenHash = hashToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });

  if (stored && !stored.revokedAt) {
    const ttl = remainingTtlSeconds(stored.expiresAt);
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    await blacklistRefreshToken(tokenHash, ttl);
  }
}
