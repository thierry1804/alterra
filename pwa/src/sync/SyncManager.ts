import { isAxiosError } from "axios";
import { db, setSetting, getSetting, type PointagePending } from "../db/db";
import { api } from "../lib/api";
import {
  applyPointageSyncResults,
  recoverStuckSyncingPointages,
  revertChunkToLocal,
} from "./ConflictResolver";
import type { PointageSyncResult, SyncLogEntry, SyncRunResult, SyncState } from "./sync-types";
import { syncPresenceLogs } from "./PresenceSync";
import { syncPendingOfflineBiometricChecks } from "../lib/biometric";
import { attachPointagePhoto, uploadPointagePhoto } from "../lib/pointage-photo";

const BATCH_SIZE = 100;
const BACKOFF_DELAYS_MS = [1000, 2000, 5000, 15000, 60000, 300000];
const AUTO_SYNC_INTERVAL_MS = 60_000;
const SETTING_LAST_SYNC_AT = "lastSyncAt";
const SETTING_SYNC_LOG = "syncLog";
const MAX_LOG_ENTRIES = 30;

let autoSyncTimer: ReturnType<typeof setInterval> | null = null;
let consecutiveFailures = 0;
let autoSyncEnabled = true;
let isSyncing = false;
let online = typeof navigator !== "undefined" ? navigator.onLine : true;

const listeners = new Set<(state: SyncState) => void>();
let cachedLog: SyncLogEntry[] = [];

function toSyncPayload(pointage: PointagePending) {
  const { status: _status, reason: _reason, ...payload } = pointage;
  return payload;
}

/** Envoie vers MinIO les photos encore locales (db.media) des pointages du lot, avant leur sync. */
async function attachPendingPhotos(pointages: PointagePending[]): Promise<void> {
  for (const pointage of pointages) {
    if (pointage.photoKey) continue;
    const media = await db.media.get(pointage.clientUuid);
    if (!media || media.uploaded) continue;

    try {
      const photoKey = await uploadPointagePhoto(media.blob);
      pointage.photoKey = photoKey;
      await db.pointages.update(pointage.clientUuid, { photoKey });
      await db.media.update(pointage.clientUuid, { uploaded: true });
    } catch {
      // Photo non envoyée (hors ligne/erreur réseau) : le pointage part sans photo, réessayé au prochain sync.
    }
  }
}

/**
 * Retente les photos dont le pointage associé est parti sans elles (upload initial échoué après que
 * le texte, lui, soit déjà passé) — indépendant du statut du pointage, qui peut avoir déjà quitté
 * `db.pointages` (synchronisé) : on retrouve son id serveur via `pointings_synced`.
 */
async function retryPendingPhotos(): Promise<{ attached: number; lost: number }> {
  const orphans = await db.media.filter((media) => !media.uploaded).toArray();
  let attached = 0;
  let lost = 0;

  for (const media of orphans) {
    const stillLocal = await db.pointages.get(media.clientUuid);
    if (stillLocal) continue; // repartira via attachPendingPhotos au prochain batch

    const synced = await db.pointings_synced.get(media.clientUuid);
    if (!synced) continue; // pointage rejeté puis supprimé — plus rien à rattacher

    try {
      const photoKey = await uploadPointagePhoto(media.blob);
      await attachPointagePhoto(synced.id, photoKey);
      await db.media.update(media.clientUuid, { uploaded: true });
      attached++;
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      // 401 exclu : ce statut ne peut venir que de l'intercepteur d'auth (lib/api.ts), jamais d'un
      // rejet métier sur l'attachement de photo. Il remonte aussi bien pour un jeton vraiment mort
      // que pour un refresh silencieux qui a échoué à cause du réseau — dans ce second cas, bien
      // réel sur le terrain, marquer la photo perdue serait irréversible pour une panne transitoire.
      if (status !== undefined && status >= 400 && status < 500 && status !== 401) {
        // Pointage déjà validé/payé ou déjà pourvu d'une autre photo : non récupérable, on arrête.
        await db.media.update(media.clientUuid, { uploaded: true });
        lost++;
      }
      // sinon transitoire (réseau, 5xx, 401) : laissé tel quel, retenté au prochain cycle.
    }
  }

  return { attached, lost };
}

function createLogEntry(level: SyncLogEntry["level"], message: string): SyncLogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    level,
    message,
  };
}

async function loadPersistedLog(): Promise<void> {
  const raw = await getSetting(SETTING_SYNC_LOG);
  if (!raw) return;
  try {
    cachedLog = JSON.parse(raw) as SyncLogEntry[];
  } catch {
    cachedLog = [];
  }
}

async function persistLog(): Promise<void> {
  await setSetting(SETTING_SYNC_LOG, JSON.stringify(cachedLog.slice(0, MAX_LOG_ENTRIES)));
}

async function appendLog(level: SyncLogEntry["level"], message: string): Promise<void> {
  cachedLog.unshift(createLogEntry(level, message));
  cachedLog = cachedLog.slice(0, MAX_LOG_ENTRIES);
  await persistLog();
  void refreshAndNotify();
}

export async function enqueuePointageSync(pointage: PointagePending): Promise<void> {
  const payload = JSON.stringify({
    clientUuid: pointage.clientUuid,
    workerId: pointage.workerId,
    date: pointage.date,
  });

  const duplicate = await db.syncQueue
    .where("status")
    .anyOf("pending", "processing")
    .filter((item) => item.type === "pointage" && item.payload.includes(pointage.clientUuid))
    .first();

  if (duplicate) return;

  await db.syncQueue.add({
    type: "pointage",
    payload,
    status: "pending",
    attempts: 0,
    createdAt: new Date().toISOString(),
  });
}

async function markQueueProcessing(clientUuids: string[]): Promise<void> {
  const items = await db.syncQueue.where("status").equals("pending").toArray();
  for (const item of items) {
    if (item.id === undefined) continue;
    if (clientUuids.some((uuid) => item.payload.includes(uuid))) {
      await db.syncQueue.update(item.id, { status: "processing" });
    }
  }
}

async function buildSyncState(): Promise<SyncState> {
  const [
    pendingCount,
    syncingCount,
    rejectedCount,
    mediaPendingCount,
    queuePendingCount,
    lastSyncAt,
  ] = await Promise.all([
    db.pointages.where("status").equals("local").count(),
    db.pointages.where("status").equals("syncing").count(),
    db.pointages.where("status").equals("rejected").count(),
    db.media.filter((media) => !media.uploaded).count(),
    db.syncQueue.where("status").equals("pending").count(),
    getSetting(SETTING_LAST_SYNC_AT),
  ]);

  const lastSummary =
    lastSyncAt && cachedLog.length > 0
      ? (cachedLog.find((entry) => entry.level === "success" || entry.level === "info")?.message ??
        null)
      : null;

  return {
    online,
    isSyncing,
    autoSyncEnabled,
    pendingCount,
    syncingCount,
    rejectedCount,
    mediaPendingCount,
    queuePendingCount,
    lastSyncAt: lastSyncAt ?? null,
    lastSummary,
    recentLog: cachedLog,
  };
}

async function refreshAndNotify(): Promise<SyncState> {
  const state = await buildSyncState();
  listeners.forEach((listener) => listener(state));
  return state;
}

export function subscribeSyncState(listener: (state: SyncState) => void): () => void {
  listeners.add(listener);
  void refreshAndNotify();
  return () => listeners.delete(listener);
}

/** Push pointages locaux par batch ≤100, idempotent via clientUuid. */
export async function syncNow(options?: { force?: boolean }): Promise<SyncRunResult> {
  if (!navigator.onLine) {
    await appendLog("warning", "Sync ignorée — hors ligne");
    return { synced: 0, rejected: 0, skipped: 0, retried: 0 };
  }

  if (isSyncing) {
    return { synced: 0, rejected: 0, skipped: 0, retried: 0 };
  }

  isSyncing = true;
  await refreshAndNotify();

  const totals: SyncRunResult = { synced: 0, rejected: 0, skipped: 0, retried: 0 };

  try {
    const recovered = await recoverStuckSyncingPointages();
    if (recovered > 0) {
      await appendLog("info", `${recovered} pointage(s) récupéré(s) après interruption`);
    }

    const photoRetry = await retryPendingPhotos();
    if (photoRetry.attached > 0) {
      await appendLog("success", `${photoRetry.attached} photo(s) rattachée(s) après coup`);
    }
    if (photoRetry.lost > 0) {
      await appendLog(
        "warning",
        `${photoRetry.lost} photo(s) non rattachable(s) — pointage déjà validé ou déjà pourvu d'une photo`,
      );
    }

    const pending = await db.pointages.where("status").equals("local").toArray();
    if (pending.length > 0) {
      await appendLog("info", `Début sync — ${pending.length} pointage(s) en attente`);

      await attachPendingPhotos(pending);

      for (let index = 0; index < pending.length; index += BATCH_SIZE) {
        const chunk = pending.slice(index, index + BATCH_SIZE);
        const clientUuids = chunk.map((pointage) => pointage.clientUuid);

        await db.pointages.bulkPut(
          chunk.map((pointage) => ({ ...pointage, status: "syncing" as const })),
        );
        await markQueueProcessing(clientUuids);

        try {
          const { data } = await api.post<{ results: PointageSyncResult[] }>("/pointages/sync", {
            batch: chunk.map(toSyncPayload),
          });

          const batchResult = await applyPointageSyncResults(chunk, data.results);
          totals.synced += batchResult.synced;
          totals.rejected += batchResult.rejected;
          totals.skipped += batchResult.skipped;
          totals.retried += batchResult.retried;

          consecutiveFailures = 0;
          autoSyncEnabled = true;
        } catch (error) {
          consecutiveFailures++;
          await revertChunkToLocal(chunk);

          const message = error instanceof Error ? error.message : "Erreur réseau";
          await appendLog("error", `Batch échoué — ${message}`);

          if (!options?.force && consecutiveFailures <= BACKOFF_DELAYS_MS.length) {
            await new Promise((resolve) =>
              setTimeout(resolve, BACKOFF_DELAYS_MS[consecutiveFailures - 1]),
            );
          } else if (consecutiveFailures > BACKOFF_DELAYS_MS.length) {
            autoSyncEnabled = false;
            await appendLog("warning", "Sync auto suspendue après échecs répétés");
            break;
          }
        }
      }

      if (totals.synced > 0 || totals.rejected > 0) {
        await appendLog(
          "success",
          `Sync terminée — ${totals.synced} envoyé(s), ${totals.rejected} rejeté(s)`,
        );
      } else if (totals.skipped > 0) {
        await appendLog("warning", `Sync partielle — ${totals.skipped} sans réponse serveur`);
      }
      if (totals.retried > 0) {
        await appendLog(
          "warning",
          `${totals.retried} pointage(s) en attente de réessai (erreur serveur passagère)`,
        );
      }
    }

    await setSetting(SETTING_LAST_SYNC_AT, new Date().toISOString());

    const presenceTotals = await syncPresenceLogs();
    if (presenceTotals.synced > 0 || presenceTotals.rejected > 0) {
      await appendLog(
        "info",
        `Présences — ${presenceTotals.synced} synchronisée(s), ${presenceTotals.rejected} rejetée(s)`,
      );
    }

    const bioTotals = await syncPendingOfflineBiometricChecks();
    if (bioTotals.synced > 0 || bioTotals.rejected > 0) {
      await appendLog(
        "info",
        `Bio offline — ${bioTotals.synced} envoyé(s), ${bioTotals.rejected} rejeté(s)`,
      );
    }
  } finally {
    isSyncing = false;
    await refreshAndNotify();
  }

  return totals;
}

export async function forceSync(): Promise<SyncRunResult> {
  consecutiveFailures = 0;
  autoSyncEnabled = true;
  if (!autoSyncTimer) startAutoSync();
  await appendLog("info", "Sync forcée par l'utilisateur");
  return syncNow({ force: true });
}

export function startAutoSync(): void {
  if (autoSyncTimer) return;

  void loadPersistedLog().then(() => refreshAndNotify());
  void recoverStuckSyncingPointages();

  autoSyncTimer = setInterval(() => {
    if (autoSyncEnabled) void syncNow();
  }, AUTO_SYNC_INTERVAL_MS);

  const handleOnline = () => {
    online = true;
    void appendLog("info", "Connexion rétablie");
    void syncNow();
  };
  const handleOffline = () => {
    online = false;
    void appendLog("warning", "Passage hors ligne");
    void refreshAndNotify();
  };

  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);

  void syncNow();
}

export function stopAutoSync(): void {
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  autoSyncTimer = null;
}
