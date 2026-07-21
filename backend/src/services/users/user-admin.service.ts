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

export async function deactivateUser(userId: string, auditMeta?: { ip?: string; userAgent?: string }) {
  const ctx = getRequestContext();

  const user = await prisma.user.update({
    where: { id: userId },
    data: { active: false },
  });

  await basePrisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

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
