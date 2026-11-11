import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { fetchAllCursorPages } from "../lib/pagination";
import { cachedFetch } from "../lib/offline-cache";
import { newClientUuid, submitOrQueue } from "../lib/requests-outbox";
import { useQueuedRequests } from "../hooks/useQueuedRequests";
import QueuedRequestCard from "../components/requests/QueuedRequestCard";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import SegmentedTabs from "../components/ui/SegmentedTabs";
import ChoiceChips from "../components/ui/ChoiceChips";
import StickyAction from "../components/ui/StickyAction";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import {
  fetchAllActivityRequests,
  requestStatusClass,
  requestStatusLabel,
  workflowErrorMessage,
  type ActivityRequestRow,
} from "../lib/workflows";

interface ActivityCategoryOption {
  id: string;
  code: string;
  label: string;
  active: boolean;
}

interface UnitOption {
  id: string;
  code: string;
  label: string;
  active: boolean;
}

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

  const [categories, setCategories] = useState<ActivityCategoryOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);

  const [categoryId, setCategoryId] = useState("");
  const [proposedLabel, setProposedLabel] = useState("");
  const [unitId, setUnitId] = useState("");
  const [proposedRate, setProposedRate] = useState("");
  const [justification, setJustification] = useState("");
  const [tab, setTab] = useState<"new" | "list">("new");
  const [stale, setStale] = useState(false);
  const queued = useQueuedRequests(["activity"]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await cachedFetch("activity-requests", () => fetchAllActivityRequests());
      setRequests(result.data);
      setStale(result.stale);
    } catch (err) {
      setError(workflowErrorMessage(err, "Chargement des demandes échoué."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  // Envoi automatique des demandes saisies hors ligne : on rafraîchit la liste à la reconnexion.
  useEffect(() => {
    const refresh = () => void loadRequests();
    window.addEventListener("alterra:requests-synced", refresh);
    return () => window.removeEventListener("alterra:requests-synced", refresh);
  }, [loadRequests]);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [categoriesRows, unitsRows] = await Promise.all([
          cachedFetch("activity-categories", () =>
            fetchAllCursorPages<ActivityCategoryOption>("/activity-categories"),
          ),
          cachedFetch("units", () => fetchAllCursorPages<UnitOption>("/units")),
        ]);
        setCategories(categoriesRows.data.filter((c) => c.active));
        setUnits(unitsRows.data.filter((u) => u.active));
      } catch (err) {
        setError(workflowErrorMessage(err, "Chargement des référentiels échoué."));
      }
    }
    void loadOptions();
  }, []);

  const missingFields = [
    !categoryId && "catégorie",
    !proposedLabel.trim() && "libellé",
    !unitId && "unité",
    !(Number(proposedRate) > 0) && "tarif",
    justification.trim().length < 10 && "justification (10 caractères minimum)",
  ].filter(Boolean) as string[];

  async function handleSubmit() {
    const rate = Number(proposedRate);
    if (!categoryId || !proposedLabel.trim() || !unitId || !Number.isFinite(rate) || rate <= 0) {
      return;
    }
    if (justification.trim().length < 10) return;

    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const outcome = await submitOrQueue({
        clientUuid: newClientUuid(),
        kind: "activity",
        payload: {
          categoryId,
          proposedLabel: proposedLabel.trim(),
          unitId,
          proposedRate: rate,
          justification: justification.trim(),
        },
      });
      setCategoryId("");
      setProposedLabel("");
      setUnitId("");
      setProposedRate("");
      setJustification("");
      setMessage(
        outcome === "queued"
          ? "Pas de réseau : demande enregistrée sur l'appareil, elle sera envoyée à la reconnexion."
          : "Demande envoyée à l'administrateur.",
      );
      setTab("list");
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
      <PageHeader title="Demande d'activité" subtitle="Proposez une activité avec son tarif." />

      <SegmentedTabs
        label="Demandes"
        value={tab}
        onChange={setTab}
        options={[
          { value: "new", label: "Nouvelle" },
          {
            value: "list",
            label: `Mes demandes${requests.length + queued.length > 0 ? ` (${requests.length + queued.length})` : ""}`,
          },
        ]}
      />

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

      {stale && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Hors ligne : données du dernier chargement.
        </p>
      )}

      {tab === "new" && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-900">Nouvelle proposition</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <p className="text-xs font-semibold text-zinc-600">Catégorie</p>
              <ChoiceChips
                label="Catégorie"
                value={categoryId}
                options={categories.map((category) => ({
                  value: category.id,
                  label: category.label,
                }))}
                onChange={setCategoryId}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600" htmlFor="act-label">
                Libellé
              </label>
              <input
                id="act-label"
                value={proposedLabel}
                onChange={(event) => setProposedLabel(event.target.value)}
                placeholder="Ex. Plantation bambou"
                className="mt-1 min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <p className="text-xs font-semibold text-zinc-600">Unité</p>
              <ChoiceChips
                label="Unité"
                value={unitId}
                options={units.map((unit) => ({ value: unit.id, label: unit.label }))}
                onChange={setUnitId}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600" htmlFor="act-rate">
                Tarif unitaire (Ar)
              </label>
              <input
                id="act-rate"
                type="number"
                min="1"
                value={proposedRate}
                onChange={(event) => setProposedRate(event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3"
              />
            </div>
            <div className="sm:col-span-2">
              <label
                className="block text-xs font-medium text-zinc-600"
                htmlFor="act-justification"
              >
                Justification
              </label>
              <textarea
                id="act-justification"
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
                rows={3}
                placeholder="Contexte, saison, parcelle concernée…"
                className="mt-1 min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3"
              />
            </div>
          </div>
          {missingFields.length > 0 && (
            <p className="mt-3 text-xs text-zinc-600">À renseigner : {missingFields.join(", ")}.</p>
          )}
        </section>
      )}

      {tab === "new" && (
        <StickyAction>
          <Button
            type="button"
            size="lg"
            className="w-full rounded-2xl shadow-lg"
            disabled={
              submitting ||
              !categoryId ||
              !proposedLabel.trim() ||
              !unitId ||
              !proposedRate ||
              Number(proposedRate) <= 0 ||
              justification.trim().length < 10
            }
            onClick={() => void handleSubmit()}
          >
            Envoyer à l'administrateur
          </Button>
        </StickyAction>
      )}

      {tab === "list" && (
        <section className="space-y-3">
          {requests.length === 0 && queued.length === 0 && (
            <p className="text-sm text-zinc-500">Aucune demande enregistrée.</p>
          )}
          {queued.map((record) => (
            <QueuedRequestCard
              key={record.clientUuid}
              record={record}
              title={String(record.payload.proposedLabel ?? "")}
            >
              <p className="mt-1 text-xs text-zinc-500">
                {Number(record.payload.proposedRate).toLocaleString("fr-MG")} Ar ·{" "}
                {formatDate(record.createdAt)}
              </p>
              <p className="mt-3 text-sm text-zinc-700">{String(record.payload.justification)}</p>
            </QueuedRequestCard>
          ))}
          {requests.map((request) => (
            <article key={request.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900">{request.proposedLabel}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {request.unit?.label} · {Number(request.proposedRate).toLocaleString("fr-MG")}{" "}
                    Ar
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
      )}

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
