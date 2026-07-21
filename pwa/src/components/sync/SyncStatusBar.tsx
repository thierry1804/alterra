import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";
import { forceSync } from "../../sync/SyncManager";
import { useSyncState } from "../../hooks/useSyncState";
import Button from "../ui/Button";

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
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-100 px-4 py-2 text-sm text-zinc-700">
      <div className="flex flex-wrap items-center gap-3">
        <span className={state.online ? "font-medium text-emerald-800" : "font-medium text-red-700"}>
          {state.online ? "En ligne" : "Hors ligne"}
        </span>
        <span>
          {pendingTotal} en attente
          {state.mediaPendingCount > 0 ? ` · ${state.mediaPendingCount} photo(s)` : ""}
        </span>
        <span className="text-zinc-600">Dernière sync : {formatLastSync(state.lastSyncAt)}</span>
        {state.isSyncing && <span className="font-medium text-zinc-900">Synchronisation…</span>}
        {!state.autoSyncEnabled && (
          <span className="font-medium text-amber-800">Sync auto suspendue</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Link
          to="/sync"
          className={cn(
            "inline-flex min-h-9 items-center text-sm text-zinc-700 underline-offset-2 hover:underline",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2",
          )}
        >
          Détail
        </Link>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!state.online || state.isSyncing}
          onClick={() => void forceSync()}
        >
          Forcer
        </Button>
      </div>
    </div>
  );
}
