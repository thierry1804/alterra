import { db, type BadgeRecord, type PresenceLogRecord, type WorkerRecord } from "../db/db";
import { todayIsoDate } from "./day-session";
import { normalizeTagId } from "./nfc";
import { uuidv7 } from "./uuid";

export type PresenceSource = "NFC" | "MANUAL";
export type PresenceLogStatus = "ok" | "unknown";

export interface ResolvedWorker {
  workerId: string;
  label: string;
}

export async function lookupWorkerByNfcTag(tagId: string): Promise<ResolvedWorker | null> {
  const normalized = normalizeTagId(tagId);
  const badge = await db.badges.get(normalized);
  if (!badge) return null;

  const worker = await db.workers.get(badge.workerId);
  if (!worker) return null;

  return {
    workerId: worker.id,
    label: `${worker.lastName} ${worker.firstName}`,
  };
}

export async function upsertBadgeMapping(nfcTagId: string, workerId: string): Promise<void> {
  const record: BadgeRecord = {
    nfcTagId: normalizeTagId(nfcTagId),
    workerId,
  };
  await db.badges.put(record);
}

export async function hasPresenceToday(workerId: string, date = todayIsoDate()): Promise<boolean> {
  const existing = await db.presenceLog
    .where("[workerId+date]")
    .equals([workerId, date])
    .first();
  return !!existing;
}

export async function logPresenceEntry(input: {
  nfcTagId: string;
  workerId: string | null;
  workerLabel: string;
  source: PresenceSource;
  status: PresenceLogStatus;
}): Promise<PresenceLogRecord> {
  const now = new Date();
  const record: PresenceLogRecord = {
    clientUuid: uuidv7(),
    nfcTagId: input.nfcTagId,
    workerId: input.workerId,
    workerLabel: input.workerLabel,
    date: todayIsoDate(),
    arrivalTime: now.toISOString(),
    source: input.source,
    status: input.status,
    synced: false,
  };

  await db.presenceLog.put(record);
  return record;
}

export async function listTodayPresenceLogs(): Promise<PresenceLogRecord[]> {
  const date = todayIsoDate();
  const rows = await db.presenceLog.where("date").equals(date).toArray();
  return rows.sort((a, b) => b.arrivalTime.localeCompare(a.arrivalTime));
}

export function workerLabel(worker: WorkerRecord): string {
  return `${worker.lastName} ${worker.firstName}`;
}
