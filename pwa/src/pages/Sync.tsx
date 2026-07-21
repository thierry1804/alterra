import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import Button from "../components/ui/Button";
import ContextHelp, { GlossaryTerm } from "../components/ui/ContextHelp";
import { db } from "../db/db";
import { discardRejectedPointage } from "../sync/ConflictResolver";
import { forceSync } from "../sync/SyncManager";
import { useSyncState } from "../hooks/useSyncState";

function logLevelClass(level: string): string {
  switch (level) {
    case "success":
      return "text-emerald-800";
    case "warning":
      return "text-amber-800";
    case "error":
      return "text-red-700";
    default:
      return "text-zinc-700";
  }
}

export default function Sync() {
  const state = useSyncState();
  const rejected = useLiveQuery(
    () => db.pointages.where("status").equals("rejected").toArray(),
    [],
  ) ?? [];
  const [busy, setBusy] = useState(false);

  async function handleForceSync() {
    setBusy(true);
    await forceSync();
    setBusy(false);
  }

  return (
    <div className="space-y-4 p-4">
      <header>
        <h1 className="text-lg font-semibold text-zinc-900">Synchronisation</h1>
        <p className="mt-1 text-sm text-zinc-600">
          État de la connexion et des données en attente d&apos;envoi vers le serveur.
        </p>
      </header>

      <ContextHelp id="sync" title="Synchronisation">
        <GlossaryTerm term="En attente">
          Données saisies sur le terrain pas encore confirmées par le serveur.
        </GlossaryTerm>
        <GlossaryTerm term="MVola">
          Mobile money — canal de paiement des travailleurs.
        </GlossaryTerm>
      </ContextHelp>

      <div className="grid gap-3 rounded-md border border-zinc-200 bg-white p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-zinc-500">Connexion</p>
          <p className={`text-sm font-medium ${state.online ? "text-emerald-800" : "text-red-700"}`}>
            {state.online ? "En ligne" : "Hors ligne"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">En attente</p>
          <p className="text-sm font-medium text-zinc-900">
            {state.pendingCount + state.syncingCount} pointage(s)
            {state.mediaPendingCount > 0 ? ` · ${state.mediaPendingCount} photo(s)` : ""}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Dernière sync</p>
          <p className="text-sm font-medium text-zinc-900">
            {state.lastSyncAt
              ? new Date(state.lastSyncAt).toLocaleString("fr-FR")
              : "Jamais"}
          </p>
        </div>
        <div>
          <p className="text-xs text-zinc-500">Sync auto</p>
          <p className="text-sm font-medium text-zinc-900">
            {state.autoSyncEnabled ? "Active (60 s)" : "Suspendue"}
          </p>
        </div>
      </div>

      <Button
        type="button"
        className="w-full"
        onClick={() => void handleForceSync()}
        disabled={busy || !state.online || state.isSyncing}
      >
        {busy || state.isSyncing
          ? "Synchronisation…"
          : `Forcer la synchronisation (${state.pendingCount})`}
      </Button>

      {rejected.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-medium text-red-700">
            Rejetés — serveur autoritaire ({rejected.length})
          </h2>
          <ul className="space-y-2">
            {rejected.map((pointage) => (
              <li
                key={pointage.clientUuid}
                className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm"
              >
                <div>
                  <p className="font-medium text-red-800">Pointage local rejeté</p>
                  <p className="text-red-700">{pointage.reason ?? "Rejeté par le serveur"}</p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => void discardRejectedPointage(pointage.clientUuid)}
                >
                  Abandonner
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-zinc-900">Journal récent</h2>
        {state.recentLog.length === 0 && (
          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            <p>Aucune entrée pour le moment.</p>
            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void handleForceSync()} disabled={!state.online}>
              Lancer une sync
            </Button>
          </div>
        )}
        <ul className="space-y-2">
          {state.recentLog.map((entry) => (
            <li
              key={entry.id}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`font-medium ${logLevelClass(entry.level)}`}>{entry.message}</span>
                <span className="shrink-0 text-xs text-zinc-600">
                  {new Date(entry.at).toLocaleTimeString("fr-FR")}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
