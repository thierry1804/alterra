import { api } from "../../lib/api";
import {
  decryptString,
  encryptString,
  type EncryptedPayload,
} from "../../lib/crypto";
import { db } from "../../db/db";
import { getMemorySessionKey } from "../../lib/session";

export interface DecryptedTemplate {
  workerId: string;
  descriptor: Float32Array;
  expiresAt: string;
}

export async function syncBiometricTemplatesFromServer(): Promise<number> {
  const key = getMemorySessionKey();
  if (!key) {
    throw new Error("NOT_UNLOCKED");
  }

  if (!navigator.onLine) {
    return db.biometricTemplates.count();
  }

  const response = await api.get<{
    data: Array<{
      workerId: string;
      descriptor: number[];
      expiresAt: string;
    }>;
  }>("/biometric/templates/sync");

  const syncedAt = new Date().toISOString();

  await db.transaction("rw", db.biometricTemplates, async () => {
    await db.biometricTemplates.clear();
    for (const item of response.data.data) {
      const encrypted = await encryptString(JSON.stringify(item.descriptor), key);
      await db.biometricTemplates.put({
        workerId: item.workerId,
        encryptedPayload: JSON.stringify(encrypted),
        expiresAt: item.expiresAt,
        syncedAt,
      });
    }
  });

  return response.data.data.length;
}

export async function getCachedBiometricTemplate(
  workerId: string,
): Promise<DecryptedTemplate | null> {
  const key = getMemorySessionKey();
  if (!key) return null;

  const row = await db.biometricTemplates.get(workerId);
  if (!row) return null;
  if (new Date(row.expiresAt).getTime() <= Date.now()) return null;

  const encrypted = JSON.parse(row.encryptedPayload) as EncryptedPayload;
  const plaintext = await decryptString(encrypted, key);
  const descriptor = JSON.parse(plaintext) as number[];

  return {
    workerId,
    descriptor: new Float32Array(descriptor),
    expiresAt: row.expiresAt,
  };
}

export async function countCachedBiometricTemplates(): Promise<number> {
  return db.biometricTemplates.count();
}

export async function clearBiometricTemplates(): Promise<void> {
  await db.biometricTemplates.clear();
}
