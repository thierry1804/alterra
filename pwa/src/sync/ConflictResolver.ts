import { db, type PointagePending } from "../db/db";
import type { PointageSyncResult, SyncRunResult } from "./sync-types";

/**
 * Applique les résultats serveur — autorité serveur (RG-15).
 * - created / already_exists → local supprimé, entrée synced
 * - rejected → conservé localement avec motif
 */
export async function applyPointageSyncResults(
  chunk: PointagePending[],
  results: PointageSyncResult[],
): Promise<SyncRunResult> {
  let synced = 0;
  let rejected = 0;
  let skipped = 0;

  const resultByUuid = new Map(results.map((result) => [result.clientUuid, result]));

  await db.transaction("rw", db.pointages, db.pointings_synced, db.syncQueue, async () => {
    for (const pointage of chunk) {
      const result = resultByUuid.get(pointage.clientUuid);
      if (!result) {
        await db.pointages.update(pointage.clientUuid, { status: "local" });
        skipped++;
        continue;
      }

      if (result.status === "created" || result.status === "already_exists") {
        await db.pointings_synced.put({
          clientUuid: result.clientUuid,
          id: result.id ?? result.clientUuid,
          workerId: pointage.workerId,
          date: pointage.date,
        });
        await db.pointages.delete(result.clientUuid);
        await markQueueItemDone(result.clientUuid);
        synced++;
        continue;
      }

      await db.pointages.update(result.clientUuid, {
        status: "rejected",
        reason: result.reason ?? "Rejeté par le serveur",
      });
      await markQueueItemFailed(result.clientUuid, result.reason);
      rejected++;
    }
  });

  return { synced, rejected, skipped };
}

export async function revertChunkToLocal(chunk: PointagePending[]): Promise<void> {
  await db.pointages.bulkPut(chunk.map((pointage) => ({ ...pointage, status: "local" as const })));
}

export async function recoverStuckSyncingPointages(): Promise<number> {
  const stuck = await db.pointages.where("status").equals("syncing").toArray();
  if (stuck.length === 0) return 0;
  await db.pointages.bulkPut(stuck.map((pointage) => ({ ...pointage, status: "local" as const })));
  return stuck.length;
}

export async function discardRejectedPointage(clientUuid: string): Promise<void> {
  await db.transaction("rw", db.pointages, db.syncQueue, async () => {
    await db.pointages.delete(clientUuid);
    await db.syncQueue
      .where("status")
      .equals("failed")
      .filter((item) => item.payload.includes(clientUuid))
      .delete();
  });
}

async function markQueueItemDone(clientUuid: string): Promise<void> {
  const items = await db.syncQueue
    .where("status")
    .anyOf("pending", "processing")
    .filter((item) => item.payload.includes(clientUuid))
    .toArray();

  for (const item of items) {
    if (item.id !== undefined) await db.syncQueue.delete(item.id);
  }
}

async function markQueueItemFailed(clientUuid: string, reason?: string): Promise<void> {
  const items = await db.syncQueue
    .where("status")
    .anyOf("pending", "processing")
    .filter((item) => item.payload.includes(clientUuid))
    .toArray();

  for (const item of items) {
    if (item.id === undefined) continue;
    await db.syncQueue.update(item.id, {
      status: "failed",
      lastError: reason ?? "rejected",
      attempts: item.attempts + 1,
    });
  }
}
