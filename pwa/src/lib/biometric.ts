import { api } from "./api";
import { db } from "../db/db";
import { uuidv7 } from "./uuid";

export type BioResult = "OK" | "KO" | "DOUBT" | "UNAVAILABLE";

export interface BiometricCheckResult {
  id: string;
  workerId: string;
  result: BioResult;
  score: number | null;
  weekIso: string | null;
  performedAt: string;
}

export interface OfflineBiometricCheckRecord {
  clientUuid: string;
  workerId: string;
  result: Exclude<BioResult, "UNAVAILABLE">;
  score: number | null;
  referenceDate?: string;
  performedAt: string;
  synced: boolean;
}

export async function submitBiometricCheck(input: {
  workerId: string;
  photoBase64?: string;
  referenceDate?: string;
}): Promise<BiometricCheckResult> {
  const response = await api.post<BiometricCheckResult>("/biometric/check", input);
  return response.data;
}

export async function submitBiometricCheckOffline(input: {
  clientUuid: string;
  workerId: string;
  result: Exclude<BioResult, "UNAVAILABLE">;
  score: number | null;
  referenceDate?: string;
  performedAt: string;
}): Promise<BiometricCheckResult> {
  const response = await api.post<BiometricCheckResult>("/biometric/check-offline", input);
  return response.data;
}

export async function queueOfflineBiometricCheck(input: {
  clientUuid?: string;
  workerId: string;
  result: Exclude<BioResult, "UNAVAILABLE">;
  score: number | null;
  referenceDate?: string;
  performedAt?: string;
}): Promise<OfflineBiometricCheckRecord> {
  const record: OfflineBiometricCheckRecord = {
    clientUuid: input.clientUuid ?? uuidv7(),
    workerId: input.workerId,
    result: input.result,
    score: input.score,
    referenceDate: input.referenceDate,
    performedAt: input.performedAt ?? new Date().toISOString(),
    synced: false,
  };
  await db.biometricOfflineChecks.put(record);
  return record;
}

export async function syncPendingOfflineBiometricChecks(): Promise<{
  synced: number;
  rejected: number;
}> {
  if (!navigator.onLine) {
    return { synced: 0, rejected: 0 };
  }

  const pending = await db.biometricOfflineChecks.filter((row) => !row.synced).toArray();
  if (pending.length === 0) {
    return { synced: 0, rejected: 0 };
  }

  let synced = 0;
  let rejected = 0;

  for (const row of pending) {
    try {
      await submitBiometricCheckOffline({
        clientUuid: row.clientUuid,
        workerId: row.workerId,
        result: row.result,
        score: row.score,
        referenceDate: row.referenceDate,
        performedAt: row.performedAt,
      });
      await db.biometricOfflineChecks.update(row.clientUuid, { synced: true });
      synced += 1;
    } catch {
      rejected += 1;
    }
  }

  return { synced, rejected };
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("READ_FAILED"));
        return;
      }
      const base64 = result.split(",")[1];
      if (!base64) {
        reject(new Error("READ_FAILED"));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("READ_FAILED"));
    reader.readAsDataURL(blob);
  });
}
