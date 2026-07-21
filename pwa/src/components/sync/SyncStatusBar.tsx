import { Link } from "react-router-dom";
import { forceSync } from "../../sync/SyncManager";
import { useSyncState } from "../../hooks/useSyncState";

function formatLastSync(iso: string | null): string {
  if (!iso) return "Jamais";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SyncStatusBar() {
  const state = useSyncState();
  const pendingTotal = state.pendingCount + state.syncingCount + state.queuePendingCount;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-100 px-4 py-2 text-xs text-zinc-700">
      <div className="flex flex-wrap items-center gap-3">
        <span className={state.online ? "text-emerald-800" : "text-red-700"}>
          {state.online ? "En ligne" : "Hors ligne"}
        </span>
        <span>
          {pendingTotal} en attente
          {state.mediaPendingCount > 0 ? ` · ${state.mediaPendingCount} photo(s)` : ""}
        </span>
        <span>Dernière sync : {formatLastSync(state.lastSyncAt)}</span>
        {state.isSyncing && <span className="text-zinc-900">Synchronisation…</span>}
        {!state.autoSyncEnabled && (
          <span className="text-amber-800">Sync auto suspendue</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Link to="/sync" className="underline">
          Détail
        </Link>
        <button
          type="button"
          disabled={!state.online || state.isSyncing}
          onClick={() => void forceSync()}
          className="rounded border border-zinc-300 bg-white px-2 py-1 disabled:opacity-50"
        >
          Forcer
        </button>
      </div>
    </div>
  );
}
