import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import type { ActivitySummary, Pointage, WorkerSummary } from "../lib/pointages";
import PhotoCapture from "../components/pointage/PhotoCapture";
import {
  clarificationStatusClass,
  clarificationStatusLabel,
  fetchAllClarificationRequests,
  uploadWorkflowPhoto,
  workflowErrorMessage,
  type ClarificationRequestRow,
} from "../lib/workflows";

async function fetchPendingPointages(): Promise<Pointage[]> {
  const rows: Pointage[] = [];
  let cursor: string | undefined;

  do {
    const response = await api.get<{
      data: Pointage[];
      nextCursor: string | null;
      hasMore: boolean;
    }>("/pointages", {
      params: { status: "PENDING", cursor },
    });
    rows.push(...response.data.data);
    cursor = response.data.hasMore ? (response.data.nextCursor ?? undefined) : undefined;
  } while (cursor);

  return rows;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("fr-MG", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ClarificationRequest() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isCds = user?.role === "CHEF_SERVICE" || user?.role === "ADMIN";
  const isCde = user?.role === "CHEF_EQUIPE";

  const [requests, setRequests] = useState<ClarificationRequestRow[]>([]);
  const [pendingPointages, setPendingPointages] = useState<Pointage[]>([]);
  const [workersMap, setWorkersMap] = useState<Map<string, WorkerSummary>>(new Map());
  const [activitiesMap, setActivitiesMap] = useState<Map<string, ActivitySummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [selectedPointageId, setSelectedPointageId] = useState(searchParams.get("pointageId") ?? "");
  const [question, setQuestion] = useState("");
  const [requestedPhoto, setRequestedPhoto] = useState(false);
  const [creating, setCreating] = useState(false);

  const [answerDrafts, setAnswerDrafts] = useState<Record<string, { text: string; previewUrl: string | null; blob: Blob | null }>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const clarifications = await fetchAllClarificationRequests();
      setRequests(clarifications);

      if (isCds) {
        const pending = await fetchPendingPointages();
        setPendingPointages(pending);

        const workerIds = [...new Set(pending.map((pointage) => pointage.workerId))];
        const workers = await Promise.all(
          workerIds.map((id) => api.get<WorkerSummary>(`/workers/${id}`).then((response) => response.data)),
        );
        setWorkersMap(new Map(workers.map((worker) => [worker.id, worker])));

        const activitiesResponse = await api.get<{ data: ActivitySummary[] }>("/activities", {
          params: { active: "true" },
        });
        setActivitiesMap(
          new Map(activitiesResponse.data.data.map((activity) => [activity.id, activity])),
        );
      }
    } catch (err) {
      setError(workflowErrorMessage(err, "Chargement des demandes échoué."));
    } finally {
      setLoading(false);
    }
  }, [isCds]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const pointageId = searchParams.get("pointageId");
    if (pointageId) setSelectedPointageId(pointageId);
  }, [searchParams]);

  const visibleRequests = useMemo(() => {
    if (isCde) return requests.filter((request) => request.status === "OPEN");
    return requests;
  }, [isCde, requests]);

  const pointageOptions = useMemo(() => {
    return pendingPointages.map((pointage) => {
      const worker = workersMap.get(pointage.workerId);
      const activity = activitiesMap.get(pointage.activityId);
      const label = worker && activity
        ? `${worker.lastName} ${worker.firstName} · ${activity.label} · ${pointage.date}`
        : `${pointage.id.slice(0, 8)} · ${pointage.date}`;
      return { id: pointage.id, label };
    });
  }, [pendingPointages, workersMap, activitiesMap]);

  async function handleCreate() {
    if (!selectedPointageId || question.trim().length < 10) return;
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      await api.post("/clarification-requests", {
        pointageId: selectedPointageId,
        question: question.trim(),
        requestedPhoto,
      });
      setQuestion("");
      setRequestedPhoto(false);
      setSelectedPointageId("");
      setMessage("Demande envoyée au chef d'équipe.");
      await loadData();
    } catch (err) {
      setError(workflowErrorMessage(err, "Envoi de la demande échoué."));
    } finally {
      setCreating(false);
    }
  }

  async function handleAnswer(request: ClarificationRequestRow) {
    const draft = answerDrafts[request.id];
    const answerText = draft?.text.trim() ?? "";
    if (answerText.length < 3) {
      setError("La réponse doit contenir au moins 3 caractères.");
      return;
    }

    setBusyId(request.id);
    setError(null);
    setMessage(null);
    try {
      let answerPhotoKey: string | undefined;
      if (request.requestedPhoto) {
        if (!draft?.blob) {
          setError("Une photo est requise pour cette demande.");
          return;
        }
        answerPhotoKey = await uploadWorkflowPhoto(
          draft.blob,
          "/clarification-requests/photo-upload-url",
        );
      }

      await api.patch(`/clarification-requests/${request.id}/answer`, {
        answerText,
        answerPhotoKey,
      });
      setMessage("Réponse envoyée.");
      setAnswerDrafts((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
      await loadData();
    } catch (err) {
      setError(workflowErrorMessage(err, "Envoi de la réponse échoué."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleClose(requestId: string) {
    setBusyId(requestId);
    setError(null);
    setMessage(null);
    try {
      await api.patch(`/clarification-requests/${requestId}/close`);
      setMessage("Demande clôturée — le pointage repasse en attente.");
      await loadData();
    } catch (err) {
      setError(workflowErrorMessage(err, "Clôture échouée."));
    } finally {
      setBusyId(null);
    }
  }

  function updateAnswerDraft(
    requestId: string,
    patch: Partial<{ text: string; previewUrl: string | null; blob: Blob | null }>,
  ) {
    setAnswerDrafts((current) => ({
      ...current,
      [requestId]: {
        text: current[requestId]?.text ?? "",
        previewUrl: current[requestId]?.previewUrl ?? null,
        blob: current[requestId]?.blob ?? null,
        ...patch,
      },
    }));
  }

  if (loading) {
    return <p className="p-4 text-sm text-zinc-600">Chargement…</p>;
  }

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Précisions</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {isCde
              ? "Répondez aux questions du chef de service avant validation."
              : "Demandez des précisions au chef d'équipe sur un pointage en attente."}
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

      {isCds && (
        <section className="rounded-md border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-900">Nouvelle demande</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600" htmlFor="clar-pointage">
                Pointage concerné
              </label>
              <select
                id="clar-pointage"
                value={selectedPointageId}
                onChange={(event) => setSelectedPointageId(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">— Choisir un pointage —</option>
                {pointageOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600" htmlFor="clar-question">
                Question
              </label>
              <textarea
                id="clar-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                rows={3}
                placeholder="Décrivez ce qui manque ou doit être clarifié…"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-700">
              <input
                type="checkbox"
                checked={requestedPhoto}
                onChange={(event) => setRequestedPhoto(event.target.checked)}
              />
              Demander une photo dans la réponse
            </label>
            <button
              type="button"
              disabled={creating || !selectedPointageId || question.trim().length < 10}
              onClick={() => void handleCreate()}
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Envoyer au chef d'équipe
            </button>
          </div>
        </section>
      )}

      {visibleRequests.length === 0 && (
        <p className="text-sm text-zinc-500">
          {isCde ? "Aucune demande ouverte." : "Aucune demande de précisions."}
        </p>
      )}

      <div className="space-y-3">
        {visibleRequests.map((request) => {
          const draft = answerDrafts[request.id];
          const busy = busyId === request.id;
          return (
            <article key={request.id} className="rounded-md border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900">Pointage {request.pointageId.slice(0, 8)}</p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(request.createdAt)}</p>
                </div>
                <span
                  className={`rounded border px-1.5 py-0.5 text-[10px] ${clarificationStatusClass(request.status)}`}
                >
                  {clarificationStatusLabel(request.status)}
                </span>
              </div>

              <p className="mt-3 text-sm text-zinc-800">{request.question}</p>
              {request.requestedPhoto && (
                <p className="mt-1 text-xs text-zinc-500">Photo demandée dans la réponse</p>
              )}

              {request.answerText && (
                <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <p className="text-xs font-medium text-zinc-600">Réponse</p>
                  <p className="mt-1 text-sm text-zinc-800">{request.answerText}</p>
                  {request.answerPhotoKey && (
                    <p className="mt-1 text-xs text-zinc-500">Photo jointe ({request.answerPhotoKey.slice(-12)})</p>
                  )}
                </div>
              )}

              {isCde && request.status === "OPEN" && (
                <div className="mt-3 space-y-3 border-t border-zinc-200 pt-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-600" htmlFor={`answer-${request.id}`}>
                      Votre réponse
                    </label>
                    <textarea
                      id={`answer-${request.id}`}
                      value={draft?.text ?? ""}
                      onChange={(event) => updateAnswerDraft(request.id, { text: event.target.value })}
                      rows={3}
                      className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                    />
                  </div>
                  {request.requestedPhoto && (
                    <PhotoCapture
                      label="Photo réponse"
                      previewUrl={draft?.previewUrl ?? null}
                      disabled={busy}
                      onCapture={(blob) => {
                        const previewUrl = URL.createObjectURL(blob);
                        updateAnswerDraft(request.id, { blob, previewUrl });
                      }}
                      onClear={() => updateAnswerDraft(request.id, { blob: null, previewUrl: null })}
                    />
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleAnswer(request)}
                    className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Envoyer la réponse
                  </button>
                </div>
              )}

              {isCds && request.status === "ANSWERED" && (
                <div className="mt-3 border-t border-zinc-200 pt-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleClose(request.id)}
                    className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-800 disabled:opacity-50"
                  >
                    Clôturer et remettre en validation
                  </button>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
