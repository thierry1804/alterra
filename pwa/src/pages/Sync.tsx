import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import Button from "../components/ui/Button";
import ContextHelp, { GlossaryTerm } from "../components/ui/ContextHelp";
import PageHeader from "../components/ui/PageHeader";
import StickyAction from "../components/ui/StickyAction";
import { cn } from "../lib/cn";
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
  const rejected =
    useLiveQuery(() => db.pointages.where("status").equals("rejected").toArray(), []) ?? [];
  const [busy, setBusy] = useState(false);

  const pendingTotal = state.pendingCount + state.syncingCount;

  async function handleForceSync() {
    setBusy(true);
    await forceSync();
    setBusy(false);
  }

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="Synchronisation"
        subtitle="Connexion et données en attente d'envoi."
        help={
          <ContextHelp id="sync" title="Synchronisation">
            <GlossaryTerm term="En attente">
              Données saisies sur le terrain pas encore confirmées par le serveur.
            </GlossaryTerm>
            <GlossaryTerm term="MVola">
              Mobile money — canal de paiement des travailleurs.
            </GlossaryTerm>
          </ContextHelp>
        }
      />

      <section
        className={cn(
          "rounded-2xl p-5 text-center",
          pendingTotal === 0 && state.online ? "bg-brand-tint" : "bg-amber-50",
        )}
      >
        <p
          className={cn(
            "alterra-display alterra-num text-5xl font-extrabold",
            pendingTotal === 0 && state.online ? "text-brand" : "text-amber-900",
          )}
        >
          {pendingTotal === 0 ? "✓" : pendingTotal}
        </p>
        <p className="mt-1 text-sm font-semibold text-zinc-900">
          {pendingTotal === 0 ? "Tout est envoyé au serveur" : "à envoyer"}
        </p>
        <p className="text-xs text-zinc-600">
          {pendingTotal === 0
            ? "Rien n'est en attente sur ce téléphone."
            : "Enregistrés sur ce téléphone, envoyés dès que le réseau le permet."}
          {state.mediaPendingCount > 0 ? ` · ${state.mediaPendingCount} photo(s)` : ""}
        </p>
      </section>

      <dl className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white px-4 text-sm">
        <div className="flex items-center justify-between py-3">
          <dt className="text-zinc-500">Connexion</dt>
          <dd
            className={
              state.online ? "font-semibold text-emerald-800" : "font-semibold text-red-700"
            }
          >
            {state.online ? "En ligne" : "Hors ligne"}
          </dd>
        </div>
        <div className="flex items-center justify-between py-3">
          <dt className="text-zinc-500">Dernière synchro</dt>
          <dd className="font-semibold text-zinc-900">
            {state.lastSyncAt ? new Date(state.lastSyncAt).toLocaleString("fr-FR") : "Jamais"}
          </dd>
        </div>
        <div className="flex items-center justify-between py-3">
          <dt className="text-zinc-500">Envoi automatique</dt>
          <dd className="font-semibold text-zinc-900">
            {state.autoSyncEnabled ? "Toutes les 60 s" : "Suspendu"}
          </dd>
        </div>
      </dl>

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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => void handleForceSync()}
              disabled={!state.online}
            >
              Lancer une sync
            </Button>
          </div>
        )}
        <ul className="space-y-2">
          {state.recentLog.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm"
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

      <StickyAction>
        <Button
          type="button"
          size="lg"
          className="w-full rounded-2xl shadow-lg"
          onClick={() => void handleForceSync()}
          disabled={busy || !state.online || state.isSyncing}
        >
          {busy || state.isSyncing
            ? "Synchronisation…"
            : pendingTotal > 0
              ? `Envoyer maintenant (${pendingTotal})`
              : "Vérifier avec le serveur"}
        </Button>
      </StickyAction>
    </div>
  );
}
