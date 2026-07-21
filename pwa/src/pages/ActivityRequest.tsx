import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import Button from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import {
  fetchAllActivityRequests,
  requestStatusClass,
  requestStatusLabel,
  workflowErrorMessage,
  type ActivityRequestRow,
} from "../lib/workflows";

function formatDate(value: string): string {
  return new Date(value).toLocaleString("fr-MG", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ActivityRequest() {
  const [requests, setRequests] = useState<ActivityRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelRequestId, setCancelRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [proposedLabel, setProposedLabel] = useState("");
  const [proposedUnit, setProposedUnit] = useState("");
  const [proposedRate, setProposedRate] = useState("");
  const [justification, setJustification] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRequests(await fetchAllActivityRequests());
    } catch (err) {
      setError(workflowErrorMessage(err, "Chargement des demandes échoué."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  async function handleSubmit() {
    const rate = Number(proposedRate);
    if (!proposedLabel.trim() || !proposedUnit.trim() || !Number.isFinite(rate) || rate <= 0) return;
    if (justification.trim().length < 10) return;

    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      await api.post("/activity-requests", {
        proposedLabel: proposedLabel.trim(),
        proposedUnit: proposedUnit.trim(),
        proposedRate: rate,
        justification: justification.trim(),
      });
      setProposedLabel("");
      setProposedUnit("");
      setProposedRate("");
      setJustification("");
      setMessage("Demande envoyée à l'administrateur.");
      await loadRequests();
    } catch (err) {
      setError(workflowErrorMessage(err, "Envoi de la demande échoué."));
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmCancel() {
    if (!cancelRequestId) return;
    setBusyId(cancelRequestId);
    setError(null);
    setMessage(null);
    try {
      await api.patch(`/activity-requests/${cancelRequestId}/cancel`);
      setMessage("Demande annulée.");
      setCancelRequestId(null);
      await loadRequests();
    } catch (err) {
      setError(workflowErrorMessage(err, "Annulation échouée."));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="p-4 text-sm text-zinc-600">Chargement…</p>;
  }

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Demande d'activité</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Proposez une nouvelle activité avec tarif — l'administrateur décidera.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadRequests()}>
          Actualiser
        </Button>
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
          {message}
        </p>
      )}

      <section className="rounded-md border border-zinc-200 bg-white p-4">
        <h2 className="text-sm font-medium text-zinc-900">Nouvelle proposition</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-600" htmlFor="act-label">
              Libellé
            </label>
            <input
              id="act-label"
              value={proposedLabel}
              onChange={(event) => setProposedLabel(event.target.value)}
              placeholder="Ex. Plantation bambou"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600" htmlFor="act-unit">
              Unité
            </label>
            <input
              id="act-unit"
              value={proposedUnit}
              onChange={(event) => setProposedUnit(event.target.value)}
              placeholder="plant, m², jour…"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600" htmlFor="act-rate">
              Tarif unitaire (Ar)
            </label>
            <input
              id="act-rate"
              type="number"
              min="1"
              value={proposedRate}
              onChange={(event) => setProposedRate(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-600" htmlFor="act-justification">
              Justification
            </label>
            <textarea
              id="act-justification"
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              rows={3}
              placeholder="Contexte, saison, parcelle concernée…"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
        </div>
        <Button
          type="button"
          className="mt-3"
          disabled={
            submitting ||
            !proposedLabel.trim() ||
            !proposedUnit.trim() ||
            !proposedRate ||
            Number(proposedRate) <= 0 ||
            justification.trim().length < 10
          }
          onClick={() => void handleSubmit()}
        >
          Envoyer à l'administrateur
        </Button>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-zinc-900">Mes demandes</h2>
        {requests.length === 0 && (
          <p className="text-sm text-zinc-500">Aucune demande enregistrée.</p>
        )}
        {requests.map((request) => (
          <article key={request.id} className="rounded-md border border-zinc-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-900">{request.proposedLabel}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {request.proposedUnit} · {Number(request.proposedRate).toLocaleString("fr-MG")} Ar
                </p>
                <p className="mt-1 text-xs text-zinc-500">{formatDate(request.createdAt)}</p>
              </div>
              <span
                className={`rounded border px-2 py-0.5 text-xs ${requestStatusClass(request.status)}`}
              >
                {requestStatusLabel(request.status)}
              </span>
            </div>
            <p className="mt-3 text-sm text-zinc-700">{request.justification}</p>
            {request.decisionReason && (
              <p className="mt-2 text-xs text-zinc-500">Décision : {request.decisionReason}</p>
            )}
            {request.status === "PENDING" && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="mt-3"
                disabled={busyId === request.id}
                onClick={() => setCancelRequestId(request.id)}
              >
                Annuler
              </Button>
            )}
          </article>
        ))}
      </section>

      <ConfirmDialog
        open={cancelRequestId !== null}
        title="Annuler cette demande ?"
        description="La demande ne sera plus visible par l'administrateur."
        confirmLabel="Annuler la demande"
        destructive
        busy={cancelRequestId !== null && busyId === cancelRequestId}
        onConfirm={() => void confirmCancel()}
        onCancel={() => setCancelRequestId(null)}
      />
    </div>
  );
}
