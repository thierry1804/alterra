import { useEffect, useState } from "react";
import { subscribeSyncState } from "../sync/SyncManager";
import type { SyncState } from "../sync/sync-types";

export function useSyncState(): SyncState {
  const [state, setState] = useState<SyncState>({
    online: navigator.onLine,
    isSyncing: false,
    autoSyncEnabled: true,
    pendingCount: 0,
    syncingCount: 0,
    rejectedCount: 0,
    mediaPendingCount: 0,
    queuePendingCount: 0,
    lastSyncAt: null,
    lastSummary: null,
    recentLog: [],
  });

  useEffect(() => subscribeSyncState(setState), []);

  return state;
}
