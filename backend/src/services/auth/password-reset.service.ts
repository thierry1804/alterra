import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import { basePrisma } from "../../lib/prisma-base.js";
import { invalidateTokensIssuedBefore } from "../../lib/redis.js";
import { ApiError } from "../../middleware/error-handler.js";
import { sendPasswordResetEmail } from "../notifications/email.service.js";
import { writeAuditLog } from "../audit/audit.service.js";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Déroulé non authentifié (login, refresh) : toujours passer par basePrisma, jamais le client RLS —
 * sans contexte de requête authentifié, l'extension RLS refuse toute écriture sur User (scope impossible).
 */
export async function requestPasswordReset(email: string, resetUrlBase: string): Promise<void> {
  const user = await basePrisma.user.findUnique({ where: { email } });
  // Pas d'énumération de compte : toujours un succès silencieux côté appelant, compte existant ou non.
  if (!user || !user.active || !user.email) return;

  const raw = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await basePrisma.passwordReset.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  const resetUrl = `${resetUrlBase}?token=${raw}`;
  await sendPasswordResetEmail(user.email, resetUrl);
}

export async function confirmPasswordReset(rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  const record = await basePrisma.passwordReset.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt <= new Date()) {
    throw new ApiError(400, "INVALID_RESET_TOKEN", "Lien de réinitialisation invalide ou expiré");
  }

  const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });

  await basePrisma.$transaction([
    basePrisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    basePrisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    basePrisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  await invalidateTokensIssuedBefore(record.userId);

  await writeAuditLog({
    userId: record.userId,
    action: "RESET_PASSWORD_SELF_SERVICE",
    entityType: "User",
    entityId: record.userId,
  });
}
