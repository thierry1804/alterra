import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { cachedFetch } from "../lib/offline-cache";
import { newClientUuid, submitOrQueue, discardQueuedRequest } from "../lib/requests-outbox";
import { useQueuedRequests } from "../hooks/useQueuedRequests";
import QueuedRequestCard from "../components/requests/QueuedRequestCard";
import type { ActivitySummary, Pointage, WorkerSummary } from "../lib/pointages";
import PhotoCapture from "../components/pointage/PhotoCapture";
import ClarificationAnswerPhotoViewer from "../components/clarification/ClarificationAnswerPhotoViewer";
import Button from "../components/ui/Button";
import IconButton from "../components/ui/IconButton";
import PageHeader from "../components/ui/PageHeader";
import StickyAction from "../components/ui/StickyAction";
import { LoadingScreen, EmptyHint } from "../components/ui/feedback";
import { IconSync, IconSend, IconCheck } from "../components/icons";
import { cn } from "../lib/cn";
import {
  clarificationStatusClass,
  clarificationStatusLabel,
  fetchAllClarificationRequests,
  workflowErrorMessage,
  type ClarificationRequestRow,
} from "../lib/workflows";
import { CLARIFICATIONS_UPDATED_EVENT } from "../hooks/useOpenClarificationsCount";

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

async function fetchAllActiveSubActivities(): Promise<ActivitySummary[]> {
  const rows: ActivitySummary[] = [];
  let cursor: string | undefined;

  do {
    const response = await api.get<{
      data: ActivitySummary[];
      nextCursor: string | null;
      hasMore: boolean;
    }>("/sub-activities", {
      params: { active: "true", take: 100, cursor },
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

  const [selectedPointageId, setSelectedPointageId] = useState(
    searchParams.get("pointageId") ?? "",
  );
  const [question, setQuestion] = useState("");
  const [requestedPhoto, setRequestedPhoto] = useState(false);
  const [creating, setCreating] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [stale, setStale] = useState(false);
  const queued = useQueuedRequests(["clarification", "clarification-answer"]);
  const queuedCreations = queued.filter((record) => record.kind === "clarification");
  const queuedAnswers = queued.filter((record) => record.kind === "clarification-answer");

  const [answerDrafts, setAnswerDrafts] = useState<
    Record<string, { text: string; previewUrl: string | null; blob: Blob | null }>
  >({});

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, stale: isStale } = await cachedFetch(
        `clarifications:${isCds ? "cds" : "cde"}`,
        async () => {
          const clarifications = await fetchAllClarificationRequests();
          if (!isCds) {
            return {
              clarifications,
              pending: [] as Pointage[],
              workers: [] as WorkerSummary[],
              activities: [] as ActivitySummary[],
            };
          }

          const pending = await fetchPendingPointages();
          const workerIds = [...new Set(pending.map((pointage) => pointage.workerId))];
          const workers = await Promise.all(
            workerIds.map((id) =>
              api.get<WorkerSummary>(`/workers/${id}`).then((response) => response.data),
            ),
          );
          const activities = await fetchAllActiveSubActivities();
          return { clarifications, pending, workers, activities };
        },
      );
      setRequests(data.clarifications);
      setPendingPointages(data.pending);
      setWorkersMap(new Map(data.workers.map((worker) => [worker.id, worker])));
      setActivitiesMap(new Map(data.activities.map((activity) => [activity.id, activity])));
      setStale(isStale);
    } catch (err) {
      setError(workflowErrorMessage(err, "Chargement des demandes échoué."));
    } finally {
      setLoading(false);
    }
  }, [isCds]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Envoi automatique des demandes et réponses saisies hors ligne : on rafraîchit à la reconnexion.
  useEffect(() => {
    const refresh = () => void loadData();
    window.addEventListener("alterra:requests-synced", refresh);
    return () => window.removeEventListener("alterra:requests-synced", refresh);
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
    const alreadyAsked = new Set(queuedCreations.map((record) => record.payload.pointageId));
    return pendingPointages
      .filter((pointage) => !alreadyAsked.has(pointage.id))
      .map((pointage) => {
        const worker = workersMap.get(pointage.workerId);
        const activity = activitiesMap.get(pointage.subActivityId);
        const label =
          worker && activity
            ? `${worker.lastName} ${worker.firstName} · ${activity.label} · ${pointage.date}`
            : `${pointage.id.slice(0, 8)} · ${pointage.date}`;
        return { id: pointage.id, label };
      });
  }, [pendingPointages, workersMap, activitiesMap, queuedCreations]);

  async function handleCreate() {
    if (!selectedPointageId || question.trim().length < 10) return;
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      const outcome = await submitOrQueue({
        clientUuid: newClientUuid(),
        kind: "clarification",
        payload: { pointageId: selectedPointageId, question: question.trim(), requestedPhoto },
      });
      setQuestion("");
      setRequestedPhoto(false);
      setSelectedPointageId("");
      setMessage(
        outcome === "queued"
          ? "Pas de réseau : demande enregistrée sur l'appareil, elle sera envoyée à la reconnexion."
          : "Demande envoyée au chef d'équipe.",
      );
      setComposeOpen(false);
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
      if (request.requestedPhoto && !draft?.blob) {
        setError("Une photo est requise pour cette demande.");
        return;
      }

      const outcome = await submitOrQueue({
        clientUuid: newClientUuid(),
        kind: "clarification-answer",
        targetId: request.id,
        photo: request.requestedPhoto ? (draft?.blob ?? undefined) : undefined,
        payload: { answerText },
      });
      setMessage(
        outcome === "queued"
          ? "Pas de réseau : réponse enregistrée sur l'appareil, elle sera envoyée à la reconnexion."
          : "Réponse envoyée.",
      );
      setAnswerDrafts((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
      await loadData();
      window.dispatchEvent(new Event(CLARIFICATIONS_UPDATED_EVENT));
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
      setMessage("Demande clôturée - le pointage repasse en attente.");
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
    return <LoadingScreen label="Chargement des demandes…" />;
  }

  return (
    <div className="space-y-4 p-4">
      <PageHeader
        title="Messages"
        subtitle={
          isCde
            ? "Questions du chef de service sur vos pointages."
            : "Demandes de précisions envoyées aux chefs d'équipe."
        }
        action={<IconButton icon={IconSync} label="Actualiser" onClick={() => void loadData()} />}
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

      {queuedCreations.map((record) => (
        <QueuedRequestCard key={record.clientUuid} record={record} title="Précision demandée">
          <p className="mt-3 text-sm text-zinc-800">{String(record.payload.question)}</p>
        </QueuedRequestCard>
      ))}

      {isCds && composeOpen && (
        <section className="rounded-2xl border border-zinc-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-900">Nouvelle demande</h2>
            <button
              type="button"
              onClick={() => setComposeOpen(false)}
              className="alterra-focus min-h-9 rounded-full px-3 text-sm font-medium text-zinc-600"
            >
              Annuler
            </button>
          </div>
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
                <option value="">- Choisir un pointage -</option>
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
            <Button
              type="button"
              className="w-full gap-2"
              disabled={creating || !selectedPointageId || question.trim().length < 10}
              onClick={() => void handleCreate()}
            >
              <IconSend className="h-4 w-4 shrink-0" />
              Envoyer au chef d'équipe
            </Button>
          </div>
        </section>
      )}

      {visibleRequests.length === 0 && queuedCreations.length === 0 && (
        <EmptyHint>{isCde ? "Aucune demande ouverte." : "Aucune demande de précisions."}</EmptyHint>
      )}

      <div className="space-y-3">
        {visibleRequests.map((request) => {
          const draft = answerDrafts[request.id];
          const busy = busyId === request.id;
          const queuedAnswer = queuedAnswers.find((record) => record.targetId === request.id);
          return (
            <article key={request.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-zinc-900">
                    Pointage <span className="alterra-num">{request.pointageId.slice(0, 8)}</span>
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{formatDate(request.createdAt)}</p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                    clarificationStatusClass(request.status),
                  )}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
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
                    <ClarificationAnswerPhotoViewer clarificationId={request.id} />
                  )}
                </div>
              )}

              {isCde && request.status === "OPEN" && queuedAnswer && (
                <div className="mt-3 space-y-2 border-t border-zinc-200 pt-3">
                  <p className="text-xs font-medium text-zinc-600">Votre réponse</p>
                  <p className="text-sm text-zinc-800">{String(queuedAnswer.payload.answerText)}</p>
                  {queuedAnswer.status === "rejected" ? (
                    <p className="text-xs text-red-700">
                      Refusée : {queuedAnswer.error ?? "Refusée par le serveur"}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700">
                      En attente d&apos;envoi - enregistrée sur cet appareil.
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void discardQueuedRequest(queuedAnswer.clientUuid)}
                  >
                    {queuedAnswer.status === "rejected" ? "Écrire une autre réponse" : "Supprimer"}
                  </Button>
                </div>
              )}

              {isCde && request.status === "OPEN" && !queuedAnswer && (
                <div className="mt-3 space-y-3 border-t border-zinc-200 pt-3">
                  <div>
                    <label
                      className="block text-xs font-medium text-zinc-600"
                      htmlFor={`answer-${request.id}`}
                    >
                      Votre réponse
                    </label>
                    <textarea
                      id={`answer-${request.id}`}
                      value={draft?.text ?? ""}
                      onChange={(event) =>
                        updateAnswerDraft(request.id, { text: event.target.value })
                      }
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
                      onClear={() =>
                        updateAnswerDraft(request.id, { blob: null, previewUrl: null })
                      }
                    />
                  )}
                  <Button
                    type="button"
                    className="w-full gap-2"
                    disabled={busy}
                    onClick={() => void handleAnswer(request)}
                  >
                    <IconSend className="h-4 w-4 shrink-0" />
                    Envoyer la réponse
                  </Button>
                </div>
              )}

              {isCds && request.status === "ANSWERED" && (
                <div className="mt-3 border-t border-zinc-200 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    disabled={busy}
                    onClick={() => void handleClose(request.id)}
                  >
                    <IconCheck className="h-4 w-4 shrink-0" />
                    Clôturer et remettre en validation
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {isCds && !composeOpen && (
        <StickyAction>
          <Button
            size="lg"
            className="w-full gap-2 rounded-2xl bg-[color:var(--color-earth)] shadow-lg hover:opacity-90"
            onClick={() => setComposeOpen(true)}
          >
            <IconSend className="h-4 w-4 shrink-0" />
            Demander une précision
          </Button>
        </StickyAction>
      )}
    </div>
  );
}
