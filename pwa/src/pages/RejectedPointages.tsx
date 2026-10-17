import { useCallback, useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { db } from "../db/db";
import {
  fetchMyRejectedPointages,
  formatPointageAmount,
  type Pointage,
  type WorkerSummary,
} from "../lib/pointages";
import { uploadPointagePhoto } from "../lib/pointage-photo";
import { workflowErrorMessage } from "../lib/workflows";
import PhotoCapture from "../components/pointage/PhotoCapture";
import Button from "../components/ui/Button";
import IconButton from "../components/ui/IconButton";
import { LoadingScreen, EmptyHint } from "../components/ui/feedback";
import { IconSync } from "../components/icons";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("fr-MG", { day: "2-digit", month: "short" });
}

interface EditDraft {
  quantity: string;
  subActivityId: string;
  date: string;
  resubmitReason: string;
  photoBlob: Blob | null;
  photoPreview: string | null;
}

export default function RejectedPointages() {
  const { user } = useAuth();
  const activities = useLiveQuery(() => db.activities.filter((a) => a.active).toArray(), []) ?? [];

  const [pointages, setPointages] = useState<Pointage[]>([]);
  const [workersMap, setWorkersMap] = useState<Map<string, WorkerSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, EditDraft>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchMyRejectedPointages(user.id);
      setPointages(rows);

      const workerIds = [...new Set(rows.map((p) => p.workerId))];
      const workers = await Promise.all(
        workerIds.map((id) => api.get<WorkerSummary>(`/workers/${id}`).then((r) => r.data)),
      );
      setWorkersMap(new Map(workers.map((w) => [w.id, w])));
    } catch (err) {
      setError(workflowErrorMessage(err, "Chargement des pointages rejetés échoué."));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activitiesMap = useMemo(() => new Map(activities.map((a) => [a.id, a])), [activities]);

  function draftFor(pointage: Pointage): EditDraft {
    return (
      drafts[pointage.id] ?? {
        quantity: pointage.quantity,
        subActivityId: pointage.subActivityId,
        date: pointage.date.slice(0, 10),
        resubmitReason: "",
        photoBlob: null,
        photoPreview: null,
      }
    );
  }

  function updateDraft(pointage: Pointage, patch: Partial<EditDraft>) {
    setDrafts((current) => ({
      ...current,
      [pointage.id]: { ...draftFor(pointage), ...patch },
    }));
  }

  async function handleResubmit(pointage: Pointage) {
    const draft = draftFor(pointage);
    if (draft.resubmitReason.trim().length < 10) {
      setError("Expliquez la correction en au moins 10 caractères.");
      return;
    }

    setBusyId(pointage.id);
    setError(null);
    setMessage(null);
    try {
      const photoKey = draft.photoBlob ? await uploadPointagePhoto(draft.photoBlob) : undefined;

      await api.patch(`/pointages/${pointage.id}/resubmit`, {
        quantity: Number(draft.quantity),
        subActivityId: draft.subActivityId,
        date: draft.date,
        photoKey,
        resubmitReason: draft.resubmitReason.trim(),
      });

      setMessage("Pointage corrigé et renvoyé pour validation.");
      setDrafts((current) => {
        const next = { ...current };
        delete next[pointage.id];
        return next;
      });
      setOpenId(null);
      await loadData();
    } catch (err) {
      setError(workflowErrorMessage(err, "Envoi de la correction échoué."));
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <LoadingScreen label="Chargement des pointages rejetés…" />;
  }

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Pointages rejetés</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Corrigez vos saisies rejetées — elles repartent en validation une fois renvoyées.
          </p>
        </div>
        <IconButton icon={IconSync} label="Actualiser" onClick={() => void loadData()} />
      </header>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}

      {pointages.length === 0 ? (
        <EmptyHint>Aucun pointage rejeté — rien à corriger.</EmptyHint>
      ) : (
        <ul className="space-y-3">
          {pointages.map((pointage) => {
            const worker = workersMap.get(pointage.workerId);
            const activity = activitiesMap.get(pointage.subActivityId);
            const isOpen = openId === pointage.id;
            const draft = draftFor(pointage);

            return (
              <li key={pointage.id} className="rounded-md border border-red-200 bg-red-50/40 p-3">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 text-left"
                  onClick={() => setOpenId(isOpen ? null : pointage.id)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">
                      {worker ? `${worker.firstName} ${worker.lastName}` : pointage.workerId}
                    </p>
                    <p className="text-xs text-zinc-600">
                      {activity?.label ?? pointage.subActivityId} · {formatDate(pointage.date)} ·{" "}
                      {formatPointageAmount(pointage.amount)}
                    </p>
                    <p className="mt-1 text-xs text-red-700">Rejet : {pointage.rejectionReason}</p>
                  </div>
                </button>

                {isOpen && (
                  <div className="mt-3 space-y-3 border-t border-red-200 pt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-600">Quantité</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={draft.quantity}
                          onChange={(e) => updateDraft(pointage, { quantity: e.target.value })}
                          className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-zinc-600">Date</label>
                        <input
                          type="date"
                          value={draft.date}
                          onChange={(e) => updateDraft(pointage, { date: e.target.value })}
                          className="w-full rounded-md border border-zinc-300 px-2 py-1.5 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs text-zinc-600">Activité</label>
                      <select
                        value={draft.subActivityId}
                        onChange={(e) =>
                          updateDraft(pointage, { subActivityId: e.target.value })
                        }
                        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                      >
                        {activity && !activitiesMap.has(activity.id) && (
                          <option value={activity.id}>{activity.label}</option>
                        )}
                        {activities.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <PhotoCapture
                      label="Photo"
                      previewUrl={draft.photoPreview}
                      workerName={worker ? `${worker.firstName} ${worker.lastName}` : undefined}
                      onCapture={(blob) =>
                        updateDraft(pointage, {
                          photoBlob: blob,
                          photoPreview: URL.createObjectURL(blob),
                        })
                      }
                      onClear={() => updateDraft(pointage, { photoBlob: null, photoPreview: null })}
                    />

                    <div className="space-y-1">
                      <label className="text-xs text-zinc-600">
                        Explication de la correction (min. 10 caractères)
                      </label>
                      <textarea
                        value={draft.resubmitReason}
                        onChange={(e) =>
                          updateDraft(pointage, { resubmitReason: e.target.value })
                        }
                        className="min-h-16 w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm"
                      />
                    </div>

                    <Button
                      type="button"
                      className="w-full"
                      disabled={busyId === pointage.id}
                      onClick={() => void handleResubmit(pointage)}
                    >
                      {busyId === pointage.id ? "Envoi…" : "Corriger et renvoyer"}
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
