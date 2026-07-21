export type SyncLogLevel = "info" | "success" | "warning" | "error";

export interface SyncLogEntry {
  id: string;
  at: string;
  level: SyncLogLevel;
  message: string;
}

export interface SyncRunResult {
  synced: number;
  rejected: number;
  skipped: number;
}

export interface SyncState {
  online: boolean;
  isSyncing: boolean;
  autoSyncEnabled: boolean;
  pendingCount: number;
  syncingCount: number;
  rejectedCount: number;
  mediaPendingCount: number;
  queuePendingCount: number;
  lastSyncAt: string | null;
  lastSummary: string | null;
  recentLog: SyncLogEntry[];
}

export type SyncResultStatus = "created" | "already_exists" | "rejected";

export interface PointageSyncResult {
  clientUuid: string;
  status: SyncResultStatus;
  id?: string;
  reason?: string;
}
