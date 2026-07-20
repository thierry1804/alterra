import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db } from "../db/db";
import { syncNow } from "../sync/SyncManager";

export default function Sync() {
  const pending = useLiveQuery(() => db.pointings_pending.toArray(), []) ?? [];
  const [syncing, setSyncing] = useState(false);

  async function onSyncClick() {
    setSyncing(true);
    await syncNow();
    setSyncing(false);
  }

  const rejected = pending.filter((p) => p.status === "rejected");
  const local = pending.filter((p) => p.status !== "rejected");

  return (
    <div className="p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Synchronisation</h1>
        <span className={navigator.onLine ? "text-green-600" : "text-red-600"}>
          {navigator.onLine ? "En ligne" : "Hors ligne"}
        </span>
      </header>

      <button
        onClick={onSyncClick}
        disabled={syncing || !navigator.onLine}
        className="mb-4 w-full rounded bg-slate-900 py-2 text-white disabled:opacity-50"
      >
        {syncing ? "Synchronisation…" : `Synchroniser (${local.length})`}
      </button>

      {rejected.length > 0 && (
        <section>
          <h2 className="mb-2 font-medium text-red-600">Rejetés ({rejected.length})</h2>
          <ul className="space-y-1">
            {rejected.map((p) => (
              <li key={p.clientUuid} className="rounded border border-red-200 p-2 text-sm">
                {p.reason ?? "Rejeté par le serveur"}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
