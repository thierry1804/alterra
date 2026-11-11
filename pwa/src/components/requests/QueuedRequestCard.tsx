import type { ReactNode } from "react";
import type { RequestOutboxRecord } from "../../db/db";
import { discardQueuedRequest } from "../../lib/requests-outbox";
import Button from "../ui/Button";

interface QueuedRequestCardProps {
  record: RequestOutboxRecord;
  title: string;
  children?: ReactNode;
}

/** Carte d'une demande saisie hors ligne : badge « en attente d'envoi » ou motif du refus. */
export default function QueuedRequestCard({ record, title, children }: QueuedRequestCardProps) {
  const rejected = record.status === "rejected";
  return (
    <article
      className={`rounded-2xl border bg-white p-4 ${rejected ? "border-red-200" : "border-amber-200"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-zinc-900">{title}</p>
        <span
          className={`shrink-0 rounded border px-2 py-0.5 text-xs ${
            rejected
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {rejected ? "Refusée" : "En attente d'envoi"}
        </span>
      </div>
      {children}
      {rejected ? (
        <p className="mt-2 text-xs text-red-700">{record.error ?? "Refusée par le serveur"}</p>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">
          Enregistrée sur cet appareil, envoi automatique dès que le réseau revient.
        </p>
      )}
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="mt-3"
        onClick={() => void discardQueuedRequest(record.clientUuid)}
      >
        Supprimer
      </Button>
    </article>
  );
}
