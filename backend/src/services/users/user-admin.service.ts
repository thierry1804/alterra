import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { prisma } from "../../lib/prisma.js";
import { basePrisma } from "../../lib/prisma-base.js";
import { blockUser } from "../../lib/redis.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { getRequestContext } from "../../middleware/prisma-rls.js";

export function generateTempPassword(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function revokeUserRefreshTokens(userId: string): Promise<number> {
  const result = await basePrisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
}

/** Brief block (access-token TTL) to invalidate in-flight sessions after password reset. */
const PASSWORD_RESET_BLOCK_TTL_SECONDS = 15 * 60;

export async function resetUserPassword(userId: string, passwordHash: string) {
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });
  await revokeUserRefreshTokens(userId);
  await blockUser(userId, PASSWORD_RESET_BLOCK_TTL_SECONDS);
}

export async function deactivateUser(userId: string, auditMeta?: { ip?: string; userAgent?: string }) {
  const ctx = getRequestContext();

  const user = await prisma.user.update({
    where: { id: userId },
    data: { active: false },
  });

  await revokeUserRefreshTokens(userId);
  await blockUser(userId);

  await writeAuditLog({
    userId: ctx?.userId,
    action: "DEACTIVATE",
    entityType: "User",
    entityId: userId,
    before: { active: true },
    after: { active: false },
    ip: auditMeta?.ip ?? ctx?.ip,
    userAgent: auditMeta?.userAgent ?? ctx?.userAgent,
  });

  return user;
}
