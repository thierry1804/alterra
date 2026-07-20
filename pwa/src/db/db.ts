import Dexie, { type Table } from "dexie";

export type PointageLocalStatus = "local" | "syncing" | "synced" | "rejected";

export interface WorkerRecord {
  id: string;
  firstName: string;
  lastName: string;
  teamId: string | null;
  matricule: string;
}

export interface ActivityRecord {
  id: string;
  label: string;
  unit: string;
  unitRate: number;
  siteId: string | null;
  active: boolean;
}

export interface PointagePending {
  clientUuid: string; // uuid v7, primary key
  workerId: string;
  activityId: string;
  quantity: number;
  date: string; // ISO date
  parcelleId?: string;
  geoLat?: number;
  geoLng?: number;
  notes?: string;
  createdByClientAt: string; // ISO datetime
  status: PointageLocalStatus;
  reason?: string; // set when status === 'rejected'
}

export interface PointageSynced {
  clientUuid: string;
  id: string; // server id
  workerId: string;
  date: string;
}

export interface MediaRecord {
  clientUuid: string;
  refType: "pointage";
  blob: Blob;
  uploaded: boolean;
}

export interface MetaRecord {
  key: string; // 'accessToken' | 'lastSyncAt' | ...
  value: string;
}

class AlterraDB extends Dexie {
  workers!: Table<WorkerRecord, string>;
  activities!: Table<ActivityRecord, string>;
  pointings_pending!: Table<PointagePending, string>;
  pointings_synced!: Table<PointageSynced, string>;
  media!: Table<MediaRecord, string>;
  meta!: Table<MetaRecord, string>;

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
  }
}

export const db = new AlterraDB();
