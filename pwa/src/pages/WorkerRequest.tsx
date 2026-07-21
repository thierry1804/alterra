import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import type { TeamSummary } from "../lib/teams";
import PhotoCapture from "../components/pointage/PhotoCapture";
import {
  fetchAllWorkerRequests,
  requestStatusClass,
  requestStatusLabel,
  uploadWorkflowPhoto,
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
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mvolaNumber, setMvolaNumber] = useState("");
  const [cinNumber, setCinNumber] = useState("");
  const [targetTeamId, setTargetTeamId] = useState("");
  const [justification, setJustification] = useState("");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [workerRequests, teamsResponse] = await Promise.all([
        fetchAllWorkerRequests(),
        api.get<{ data: TeamSummary[] }>("/teams", { params: { active: "true" } }),
      ]);
      setRequests(workerRequests);
      setTeams(teamsResponse.data.data);
    } catch (err) {
      setError(workflowErrorMessage(err, "Chargement des demandes échoué."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
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
      let proposedPhotoKey: string | undefined;
      if (photoBlob) {
        proposedPhotoKey = await uploadWorkflowPhoto(
          photoBlob,
          "/worker-requests/photo-upload-url",
        );
      }

      await api.post("/worker-requests", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        mvolaNumber: mvolaNumber.trim(),
        cinNumber: cinNumber.trim() || undefined,
        targetTeamId: targetTeamId || undefined,
        justification: justification.trim(),
        proposedPhotoKey,
      });

      setFirstName("");
      setLastName("");
      setMvolaNumber("");
      setCinNumber("");
      setTargetTeamId("");
      setJustification("");
      clearPhoto();
      setMessage("Demande MOC envoyée à l'administrateur.");
      await loadData();
    } catch (err) {
      setError(workflowErrorMessage(err, "Envoi de la demande échoué."));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(requestId: string) {
    if (!window.confirm("Annuler cette demande ?")) return;
    setBusyId(requestId);
    setError(null);
    setMessage(null);
    try {
      await api.patch(`/worker-requests/${requestId}/cancel`);
      setMessage("Demande annulée.");
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
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Demande MOC</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Proposez l'ajout d'un nouveau travailleur — l'administrateur validera la création.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadData()}
          className="text-xs text-zinc-600 underline"
        >
          Actualiser
        </button>
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
        <h2 className="text-sm font-medium text-zinc-900">Nouveau MOC</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-zinc-600" htmlFor="wkr-first">
              Prénom
            </label>
            <input
              id="wkr-first"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600" htmlFor="wkr-last">
              Nom
            </label>
            <input
              id="wkr-last"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600" htmlFor="wkr-mvola">
              Numéro MVola
            </label>
            <input
              id="wkr-mvola"
              value={mvolaNumber}
              onChange={(event) => setMvolaNumber(event.target.value)}
              placeholder="034…"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600" htmlFor="wkr-cin">
              CIN (optionnel)
            </label>
            <input
              id="wkr-cin"
              value={cinNumber}
              onChange={(event) => setCinNumber(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-600" htmlFor="wkr-team">
              Équipe cible (optionnel)
            </label>
            <select
              id="wkr-team"
              value={targetTeamId}
              onChange={(event) => setTargetTeamId(event.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="">— Aucune —</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-zinc-600" htmlFor="wkr-justification">
              Justification
            </label>
            <textarea
              id="wkr-justification"
              value={justification}
              onChange={(event) => setJustification(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-zinc-600">Photo d'identité</p>
            <div className="mt-2">
              <PhotoCapture
                label="Prendre photo"
                previewUrl={photoPreviewUrl}
                disabled={submitting}
                onCapture={(blob) => {
                  setPhotoBlob(blob);
                  setPhotoPreviewUrl(URL.createObjectURL(blob));
                }}
                onClear={clearPhoto}
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          disabled={
            submitting ||
            !firstName.trim() ||
            !lastName.trim() ||
            mvolaNumber.trim().length < 9 ||
            justification.trim().length < 10
          }
          onClick={() => void handleSubmit()}
          className="mt-3 rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Envoyer à l'administrateur
        </button>
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
                className={`rounded border px-1.5 py-0.5 text-[10px] ${requestStatusClass(request.status)}`}
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
              <button
                type="button"
                disabled={busyId === request.id}
                onClick={() => void handleCancel(request.id)}
                className="mt-3 text-xs text-red-700 underline disabled:opacity-50"
              >
                Annuler
              </button>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
