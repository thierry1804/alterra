import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { cachedFetch } from "../lib/offline-cache";
import { newClientUuid, submitOrQueue } from "../lib/requests-outbox";
import { useQueuedRequests } from "../hooks/useQueuedRequests";
import QueuedRequestCard from "../components/requests/QueuedRequestCard";
import type { TeamSummary } from "../lib/teams";
import PhotoCapture from "../components/pointage/PhotoCapture";
import Button from "../components/ui/Button";
import PageHeader from "../components/ui/PageHeader";
import SegmentedTabs from "../components/ui/SegmentedTabs";
import ChoiceChips from "../components/ui/ChoiceChips";
import StickyAction from "../components/ui/StickyAction";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import {
  fetchAllWorkerRequests,
  requestStatusClass,
  requestStatusLabel,
  workflowErrorMessage,
  type WorkerRequestRow,
} from "../lib/workflows";

function formatDate(value: string): string {
  return new Date(value).toLocaleString("fr-MG", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function WorkerRequest() {
  const [requests, setRequests] = useState<WorkerRequestRow[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cancelRequestId, setCancelRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mvolaNumber, setMvolaNumber] = useState("");
  const [cinNumber, setCinNumber] = useState("");
  const [sexe, setSexe] = useState<"" | "MASCULIN" | "FEMININ">("");
  const [targetTeamId, setTargetTeamId] = useState("");
  const [justification, setJustification] = useState("");
  const [tab, setTab] = useState<"new" | "list">("new");
  const [stale, setStale] = useState(false);
  const queued = useQueuedRequests(["worker"]);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, stale: isStale } = await cachedFetch("worker-requests", async () => {
        const [workerRequests, teamsResponse] = await Promise.all([
          fetchAllWorkerRequests(),
          api.get<{ data: TeamSummary[] }>("/teams", { params: { active: "true" } }),
        ]);
        return { requests: workerRequests, teams: teamsResponse.data.data };
      });
      setRequests(data.requests);
      setTeams(data.teams);
      setStale(isStale);
    } catch (err) {
      setError(workflowErrorMessage(err, "Chargement des demandes échoué."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Envoi automatique des demandes saisies hors ligne : on rafraîchit la liste à la reconnexion.
  useEffect(() => {
    const refresh = () => void loadData();
    window.addEventListener("alterra:requests-synced", refresh);
    return () => window.removeEventListener("alterra:requests-synced", refresh);
  }, [loadData]);

  function clearPhoto() {
    setPhotoBlob(null);
    setPhotoPreviewUrl(null);
  }

  async function handleSubmit() {
    if (!firstName.trim() || !lastName.trim() || mvolaNumber.trim().length < 9) return;
    if (justification.trim().length < 10) return;

    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const outcome = await submitOrQueue({
        clientUuid: newClientUuid(),
        kind: "worker",
        photo: photoBlob ?? undefined,
        payload: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          mvolaNumber: mvolaNumber.trim(),
          cinNumber: cinNumber.trim() || undefined,
          sexe: sexe || undefined,
          targetTeamId: targetTeamId || undefined,
          justification: justification.trim(),
        },
      });

      setFirstName("");
      setLastName("");
      setMvolaNumber("");
      setCinNumber("");
      setSexe("");
      setTargetTeamId("");
      setJustification("");
      clearPhoto();
      setMessage(
        outcome === "queued"
          ? "Pas de réseau : demande enregistrée sur l'appareil, elle sera envoyée à la reconnexion."
          : "Demande envoyée à l'administrateur.",
      );
      setTab("list");
      await loadData();
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
      await api.patch(`/worker-requests/${cancelRequestId}/cancel`);
      setMessage("Demande annulée.");
      setCancelRequestId(null);
      await loadData();
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
      <PageHeader title="Demande de travailleur" subtitle="Proposez l'ajout d'un travailleur." />

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
        <section className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center gap-4">
            <div className="w-28 shrink-0">
              <PhotoCapture
                label="Photo"
                previewUrl={photoPreviewUrl}
                disabled={submitting}
                onCapture={(blob) => {
                  setPhotoBlob(blob);
                  setPhotoPreviewUrl(URL.createObjectURL(blob));
                }}
                onClear={clearPhoto}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-zinc-900">Photo d&apos;identité</p>
              <p className="text-xs text-zinc-600">
                Visage de face, sans casquette : elle sert au contrôle biométrique.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-zinc-600" htmlFor="wkr-first">
                Prénom
              </label>
              <input
                id="wkr-first"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600" htmlFor="wkr-last">
                Nom
              </label>
              <input
                id="wkr-last"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                className="mt-1 min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-600" htmlFor="wkr-mvola">
              Numéro MVola
            </label>
            <input
              id="wkr-mvola"
              inputMode="tel"
              value={mvolaNumber}
              onChange={(event) => setMvolaNumber(event.target.value)}
              placeholder="034…, 036…, 038…"
              className="mt-1 min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3"
            />
          </div>

          {teams.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-zinc-600">Équipe cible (optionnel)</p>
              <ChoiceChips
                label="Équipe cible"
                value={targetTeamId}
                options={teams.map((team) => ({ value: team.id, label: team.name }))}
                onChange={setTargetTeamId}
              />
            </div>
          )}

          <div>
            <label
              className="block text-xs font-semibold text-zinc-600"
              htmlFor="wkr-justification"
            >
              Justification
            </label>
            <textarea
              id="wkr-justification"
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              rows={3}
              placeholder="Pourquoi ce travailleur doit rejoindre l'équipe (10 caractères min.)"
              className="mt-1 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2"
            />
          </div>

          <details className="rounded-xl border border-zinc-200 px-3 py-2">
            <summary className="alterra-focus min-h-9 cursor-pointer list-none text-sm font-medium text-zinc-700">
              + CIN et sexe (optionnel)
            </summary>
            <div className="space-y-3 pb-2 pt-2">
              <div>
                <label className="block text-xs font-semibold text-zinc-600" htmlFor="wkr-cin">
                  CIN
                </label>
                <input
                  id="wkr-cin"
                  inputMode="numeric"
                  value={cinNumber}
                  onChange={(event) => setCinNumber(event.target.value)}
                  className="mt-1 min-h-12 w-full rounded-xl border border-zinc-300 bg-white px-3"
                />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-600">Sexe</p>
                <ChoiceChips
                  label="Sexe"
                  value={sexe}
                  options={[
                    { value: "MASCULIN", label: "Masculin" },
                    { value: "FEMININ", label: "Féminin" },
                  ]}
                  onChange={(value) => setSexe(value as "" | "MASCULIN" | "FEMININ")}
                />
              </div>
            </div>
          </details>
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
              !firstName.trim() ||
              !lastName.trim() ||
              mvolaNumber.trim().length < 9 ||
              justification.trim().length < 10
            }
            onClick={() => void handleSubmit()}
          >
            {submitting ? "Envoi…" : "Envoyer à l'administrateur"}
          </Button>
        </StickyAction>
      )}

      {tab === "list" && (
        <section className="space-y-3">
          {queued.map((record) => (
            <QueuedRequestCard
              key={record.clientUuid}
              record={record}
              title={`${String(record.payload.firstName)} ${String(record.payload.lastName)}`}
            >
              <p className="mt-1 text-xs text-zinc-500">
                MVola {String(record.payload.mvolaNumber)} · {formatDate(record.createdAt)}
              </p>
              <p className="mt-3 text-sm text-zinc-700">{String(record.payload.justification)}</p>
              {record.photo && <p className="mt-1 text-xs text-zinc-500">Photo jointe</p>}
            </QueuedRequestCard>
          ))}
          {requests.length === 0 && queued.length === 0 && (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              <p>Aucune demande enregistrée.</p>
              <p className="mt-1 text-zinc-600">
                Utilisez le formulaire ci-dessus pour proposer un nouveau travailleur.
              </p>
            </div>
          )}
          {requests.map((request) => (
            <article key={request.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    {request.firstName} {request.lastName}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    MVola {request.mvolaNumber}
                    {request.cinNumber ? ` · CIN ${request.cinNumber}` : ""}
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
              {request.proposedPhotoKey && (
                <p className="mt-1 text-xs text-zinc-500">Photo jointe</p>
              )}
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
