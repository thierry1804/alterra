import { api } from "../lib/api";
import { db, type BadgeRecord } from "../db/db";
import { normalizeTagId } from "../lib/nfc";

export interface PresenceSyncResult {
  clientUuid: string;
  status: "created" | "already_exists" | "rejected";
  id?: string;
  reason?: string;
}

export interface PresenceSyncRunResult {
  synced: number;
  rejected: number;
}

export async function syncBadgeCache(options: {
  teamId?: string | null;
}): Promise<number> {
  if (!navigator.onLine) {
    return db.badges.count();
  }

  const params: Record<string, string> = { active: "true" };
  if (options.teamId) params.teamId = options.teamId;

  const response = await api.get<{
    data: Array<{ nfcTagId: string; workerId: string }>;
  }>("/badges", { params });

  const badges: BadgeRecord[] = response.data.data.map((badge) => ({
    nfcTagId: normalizeTagId(badge.nfcTagId),
    workerId: badge.workerId,
  }));

  await db.transaction("rw", db.badges, async () => {
    await db.badges.clear();
    if (badges.length > 0) await db.badges.bulkPut(badges);
  });

  return badges.length;
}

export async function syncPresenceLogs(): Promise<PresenceSyncRunResult> {
  if (!navigator.onLine) {
    return { synced: 0, rejected: 0 };
  }

  const pending = await db.presenceLog
    .filter((log) => !log.synced && log.status === "ok" && log.workerId !== null)
    .toArray();

  if (pending.length === 0) {
    return { synced: 0, rejected: 0 };
  }

  let synced = 0;
  let rejected = 0;

  for (let index = 0; index < pending.length; index += 100) {
    const chunk = pending.slice(index, index + 100);
    const { data } = await api.post<{ results: PresenceSyncResult[] }>("/presence/sync", {
      batch: chunk.map((log) => ({
        clientUuid: log.clientUuid,
        workerId: log.workerId!,
        date: log.date,
        arrivalTime: log.arrivalTime,
        badgeNfcTagId: log.nfcTagId,
        source: log.source,
        createdByClientAt: log.arrivalTime,
      })),
    });

    const resultByUuid = new Map(data.results.map((result) => [result.clientUuid, result]));

    for (const log of chunk) {
      const result = resultByUuid.get(log.clientUuid);
      if (result?.status === "created" || result?.status === "already_exists") {
        await db.presenceLog.update(log.clientUuid, { synced: true });
        synced += 1;
      } else {
        rejected += 1;
      }
    }
  }

  return { synced, rejected };
}
