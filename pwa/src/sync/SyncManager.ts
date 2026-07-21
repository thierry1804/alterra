import { db, type PointagePending } from "../db/db";
import { api } from "../lib/api";

const BATCH_SIZE = 100;
const BACKOFF_DELAYS_MS = [1000, 2000, 5000, 15000, 60000, 300000]; // 1s → 5min
const AUTO_SYNC_INTERVAL_MS = 60_000;

type SyncResult = {
  clientUuid: string;
  status: "created" | "already_exists" | "rejected";
  id?: string;
  reason?: string;
};

let autoSyncTimer: ReturnType<typeof setInterval> | null = null;
let consecutiveFailures = 0;

function toSyncPayload(p: PointagePending) {
  const { status: _status, reason: _reason, ...payload } = p;
  return payload;
}

/** Push all locally pending pointages in batches of ≤100, idempotent via clientUuid. */
export async function syncNow(): Promise<{ synced: number; rejected: number }> {
  if (!navigator.onLine) return { synced: 0, rejected: 0 };

  const pending = await db.pointages.where("status").anyOf("local", "rejected").toArray();
  if (pending.length === 0) return { synced: 0, rejected: 0 };

  let synced = 0;
  let rejected = 0;

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const chunk = pending.slice(i, i + BATCH_SIZE);
    await db.pointages.bulkPut(chunk.map((p) => ({ ...p, status: "syncing" as const })));

    try {
      const { data } = await api.post<{ results: SyncResult[] }>("/pointages/sync", {
        batch: chunk.map(toSyncPayload),
      });

      await db.transaction("rw", db.pointages, db.pointings_synced, async () => {
        for (const result of data.results) {
          if (result.status === "created" || result.status === "already_exists") {
            const local = chunk.find((c) => c.clientUuid === result.clientUuid)!;
            await db.pointings_synced.put({
              clientUuid: result.clientUuid,
              id: result.id!,
              workerId: local.workerId,
              date: local.date,
            });
            await db.pointages.delete(result.clientUuid);
            synced++;
          } else {
            await db.pointages.update(result.clientUuid, {
              status: "rejected",
              reason: result.reason,
            });
            rejected++;
          }
        }
      });

      consecutiveFailures = 0;
    } catch {
      consecutiveFailures++;
      await db.pointages.bulkPut(chunk.map((p) => ({ ...p, status: "local" as const })));

      if (consecutiveFailures <= BACKOFF_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, BACKOFF_DELAYS_MS[consecutiveFailures - 1]));
      } else {
        // 6 échecs consécutifs : on arrête les tentatives auto, l'utilisateur devra relancer manuellement.
        stopAutoSync();
        break;
      }
    }
  }

  return { synced, rejected };
}

export function startAutoSync() {
  if (autoSyncTimer) return;
  autoSyncTimer = setInterval(() => void syncNow(), AUTO_SYNC_INTERVAL_MS);
  window.addEventListener("online", () => void syncNow());
}

export function stopAutoSync() {
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  autoSyncTimer = null;
}
