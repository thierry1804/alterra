import Dexie, { type Table } from "dexie";

export type PointageLocalStatus = "local" | "syncing" | "synced" | "rejected";

export interface WorkerRecord {
  id: string;
  firstName: string;
  lastName: string;
  teamId: string | null;
  matricule: string;
  siteId?: string;
  sexe?: "MASCULIN" | "FEMININ" | null;
}

/** Sous-activité (unité réellement facturée) — la catégorie officielle (ACT01..ACT07) est portée par categoryCode. */
export interface ActivityRecord {
  id: string;
  label: string;
  categoryCode: string;
  unit: string;
  unitRate: number;
  siteId: string | null;
  active: boolean;
}

export interface PointagePending {
  clientUuid: string;
  workerId: string;
  subActivityId: string;
  quantity: number;
  date: string;
  parcelleId?: string;
  geoLat?: number;
  geoLng?: number;
  notes?: string;
  createdByClientAt: string;
  status: PointageLocalStatus;
  reason?: string;
  photoKey?: string;
}

export interface PointageSynced {
  clientUuid: string;
  id: string;
  workerId: string;
  date: string;
}

export interface MediaRecord {
  clientUuid: string;
  refType: "pointage";
  blob: Blob;
  uploaded: boolean;
}

export type SyncQueueStatus = "pending" | "processing" | "failed";

export interface SyncQueueItem {
  id?: number;
  type: "pointage" | "media" | "referential";
  payload: string;
  status: SyncQueueStatus;
  attempts: number;
  lastError?: string;
  createdAt: string;
}

export type RequestOutboxKind = "activity" | "worker" | "clarification" | "clarification-answer";
export type RequestOutboxStatus = "pending" | "syncing" | "rejected";

/** Demande (activité, travailleur, précision) saisie hors ligne, en attente d'envoi au serveur. */
export interface RequestOutboxRecord {
  clientUuid: string;
  kind: RequestOutboxKind;
  /** Auteur de la saisie : sur un téléphone partagé, seul lui peut l'envoyer (jeton de son compte). */
  userId: string;
  status: RequestOutboxStatus;
  /** Corps JSON de la requête, sans `clientUuid` ni clé de photo. */
  payload: Record<string, unknown>;
  /** Id serveur ciblé (réponse à une demande de précisions). */
  targetId?: string;
  /** Photo à téléverser avant l'envoi (photo du travailleur, photo de réponse). */
  photo?: Blob;
  /** Clé de la photo une fois téléversée (évite un second téléversement en cas de reprise). */
  photoKey?: string;
  error?: string;
  createdAt: string;
}

export interface SettingRecord {
  key: string;
  value: string;
}

export interface BadgeRecord {
  nfcTagId: string;
  workerId: string;
}

export type PresenceLogStatus = "ok" | "unknown";
export type PresenceSource = "NFC" | "MANUAL";

export interface PresenceLogRecord {
  clientUuid: string;
  nfcTagId: string;
  workerId: string | null;
  workerLabel: string;
  date: string;
  arrivalTime: string;
  source: PresenceSource;
  status: PresenceLogStatus;
  synced: boolean;
}

export interface BiometricTemplateRecord {
  workerId: string;
  encryptedPayload: string;
  expiresAt: string;
  syncedAt: string;
}

export interface BiometricOfflineCheckRecord {
  clientUuid: string;
  workerId: string;
  result: "OK" | "KO" | "DOUBT";
  score: number | null;
  referenceDate?: string;
  performedAt: string;
  synced: boolean;
}

/** @deprecated v1 — migrated to settings */
export interface MetaRecord {
  key: string;
  value: string;
}

class AlterraDB extends Dexie {
  workers!: Table<WorkerRecord, string>;
  activities!: Table<ActivityRecord, string>;
  pointages!: Table<PointagePending, string>;
  pointings_synced!: Table<PointageSynced, string>;
  media!: Table<MediaRecord, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  settings!: Table<SettingRecord, string>;
  meta!: Table<MetaRecord, string>;
  badges!: Table<BadgeRecord, string>;
  presenceLog!: Table<PresenceLogRecord, string>;
  biometricTemplates!: Table<BiometricTemplateRecord, string>;
  biometricOfflineChecks!: Table<BiometricOfflineCheckRecord, string>;
  requestsOutbox!: Table<RequestOutboxRecord, string>;

  constructor() {
    super("alterra");

    this.version(1).stores({
      workers: "id, teamId, [firstName+lastName]",
      activities: "id, siteId, active",
      pointings_pending: "clientUuid, workerId, date, status",
      pointings_synced: "clientUuid, id, workerId, date",
      media: "clientUuid, refType, uploaded",
      meta: "key",
    });

    this.version(2)
      .stores({
        workers: "id, teamId, matricule, [firstName+lastName]",
        activities: "id, siteId, active",
        pointages: "clientUuid, workerId, date, status",
        pointings_synced: "clientUuid, id, workerId, date",
        media: "clientUuid, refType, uploaded",
        syncQueue: "++id, type, status, createdAt",
        settings: "key",
      })
      .upgrade(async (tx) => {
        const legacyPending = tx.table("pointings_pending");
        if (legacyPending) {
          const rows = await legacyPending.toArray();
          if (rows.length > 0) {
            await tx.table("pointages").bulkPut(rows);
          }
        }

        const legacyMeta = tx.table("meta");
        if (legacyMeta) {
          const metaRows = await legacyMeta.toArray();
          if (metaRows.length > 0) {
            await tx.table("settings").bulkPut(metaRows);
          }
        }
      });

    this.version(3).stores({
      workers: "id, teamId, matricule, [firstName+lastName]",
      activities: "id, siteId, active",
      pointages: "clientUuid, workerId, date, status",
      pointings_synced: "clientUuid, id, workerId, date",
      media: "clientUuid, refType, uploaded",
      syncQueue: "++id, type, status, createdAt",
      settings: "key",
      badges: "nfcTagId, workerId",
      presenceLog: "clientUuid, date, arrivalTime, workerId, [workerId+date], status, synced",
    });

    this.version(4).stores({
      workers: "id, teamId, matricule, [firstName+lastName]",
      activities: "id, siteId, active",
      pointages: "clientUuid, workerId, date, status",
      pointings_synced: "clientUuid, id, workerId, date",
      media: "clientUuid, refType, uploaded",
      syncQueue: "++id, type, status, createdAt",
      settings: "key",
      badges: "nfcTagId, workerId",
      presenceLog: "clientUuid, date, arrivalTime, workerId, [workerId+date], status, synced",
      biometricTemplates: "workerId, expiresAt, syncedAt",
      biometricOfflineChecks: "clientUuid, workerId, synced, performedAt",
    });

    this.version(5).stores({
      requestsOutbox: "clientUuid, kind, status, createdAt",
    });
  }
}

export const db = new AlterraDB();

export async function getSetting(key: string): Promise<string | undefined> {
  return (await db.settings.get(key))?.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.settings.put({ key, value });
}

export async function deleteSetting(key: string): Promise<void> {
  await db.settings.delete(key);
}

/**
 * Efface les données locales à la déconnexion : sur un téléphone partagé, le chef d'équipe suivant ne doit
 * pas retrouver les MOC, activités, pointages ou gabarits du précédent. Seul ce qui n'a pas encore été
 * envoyé au serveur est conservé (saisies hors ligne en attente, file de synchronisation) pour ne rien perdre.
 */
export async function purgeLocalData(): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.workers,
      db.activities,
      db.badges,
      db.pointages,
      db.pointings_synced,
      db.media,
      db.presenceLog,
      db.biometricTemplates,
      db.biometricOfflineChecks,
      db.settings,
    ],
    async () => {
      await Promise.all([
        db.workers.clear(),
        db.activities.clear(),
        db.badges.clear(),
        db.pointings_synced.clear(),
        db.biometricTemplates.clear(),
        db.pointages.where("status").anyOf("synced", "rejected").delete(),
        db.media.filter((m) => m.uploaded).delete(),
        db.presenceLog.filter((r) => r.synced).delete(),
        db.biometricOfflineChecks.filter((c) => c.synced).delete(),
        // Copies locales des listes de demandes et référentiels (voir lib/offline-cache.ts).
        db.settings.filter((s) => s.key.startsWith("cache:")).delete(),
      ]);
    },
  );

  // Réponses d'API mises en cache par le service worker (liste des MOC, référentiels…).
  if (typeof caches !== "undefined") {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.includes("api")).map((n) => caches.delete(n)));
  }
}
