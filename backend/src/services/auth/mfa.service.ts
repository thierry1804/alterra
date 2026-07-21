import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { generateSecret, generateURI, verifySync } from "otplib";
import { prisma } from "../../lib/prisma.js";
import {
  deletePendingMfaSecret,
  getPendingMfaSecret,
  storePendingMfaSecret,
} from "../../lib/redis.js";
import { ApiError } from "../../middleware/error-handler.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const PENDING_TTL_MS = 10 * 60 * 1000;

interface PendingMfa {
  secret: string;
  expiresAt: number;
}

const pendingSecrets = new Map<string, PendingMfa>();
const USE_IN_MEMORY_PENDING = process.env.NODE_ENV === "test";

function getEncryptionKey(): Buffer {
  const raw = process.env.MFA_ENCRYPTION_KEY;
  if (!raw || raw.length !== 64) {
    throw new Error("MFA_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  return Buffer.from(raw, "hex");
}

export function encryptMfaSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptMfaSecret(stored: string): string {
  const key = getEncryptionKey();
  const [ivHex, authTagHex, dataHex] = stored.split(":");
  if (!ivHex || !authTagHex || !dataHex) {
    throw new Error("Invalid encrypted MFA secret format");
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString(
    "utf8",
  );
}

async function storePendingSecret(userId: string, secret: string): Promise<void> {
  if (USE_IN_MEMORY_PENDING) {
    pendingSecrets.set(userId, { secret, expiresAt: Date.now() + PENDING_TTL_MS });
    return;
  }
  await storePendingMfaSecret(userId, encryptMfaSecret(secret));
}

async function loadPendingSecret(userId: string): Promise<string | null> {
  if (USE_IN_MEMORY_PENDING) {
    const pending = pendingSecrets.get(userId);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingSecrets.delete(userId);
      return null;
    }
    return pending.secret;
  }

  const encrypted = await getPendingMfaSecret(userId);
  if (!encrypted) return null;
  return decryptMfaSecret(encrypted);
}

async function clearPendingSecret(userId: string): Promise<void> {
  if (USE_IN_MEMORY_PENDING) {
    pendingSecrets.delete(userId);
    return;
  }
  await deletePendingMfaSecret(userId);
}

/** Generate TOTP secret and otpauth URL; pending until verified. */
export async function setupMfa(userId: string, email: string) {
  const secret = generateSecret();
  await storePendingSecret(userId, secret);
  const otpauthUrl = generateURI({ issuer: "ALTERRA", label: email, secret });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
  return { otpauthUrl, qrCodeDataUrl, secret };
}

/** Confirm TOTP code and persist encrypted secret. */
export async function activateMfa(userId: string, code: string): Promise<void> {
  const secret = await loadPendingSecret(userId);
  if (!secret) {
    throw new ApiError(400, "MFA_SETUP_EXPIRED", "MFA setup session expired — restart setup");
  }

  if (!verifySync({ secret, token: code }).valid) {
    throw new ApiError(401, "INVALID_MFA_CODE", "Invalid MFA code");
  }

  const encrypted = encryptMfaSecret(secret);
  await prisma.user.update({ where: { id: userId }, data: { mfaSecret: encrypted } });
  await clearPendingSecret(userId);
}

/** Verify TOTP at login for Admin users with MFA enabled. */
export function verifyLoginMfa(encryptedSecret: string, code: string): boolean {
  const secret = decryptMfaSecret(encryptedSecret);
  return verifySync({ secret, token: code }).valid;
}

/** Clear pending MFA state (tests). */
export function clearPendingMfaForTests(): void {
  pendingSecrets.clear();
}
