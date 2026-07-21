import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import WorkerRow, { type WorkerRowValue } from "../components/pointage/WorkerRow";
import Button, { ButtonLink } from "../components/ui/Button";
import { db, type ActivityRecord, type PointagePending, type WorkerRecord } from "../db/db";
import { useAuth } from "../hooks/useAuth";
import { getDaySession, type DaySession } from "../lib/day-session";
import { uuidv7 } from "../lib/uuid";
import { syncNow, enqueuePointageSync } from "../sync/SyncManager";

function emptyRowValue(defaultQuantity: number): WorkerRowValue {
  return {
    quantity: String(defaultQuantity),
    photoBlob: null,
    photoPreview: null,
  };
}

export default function BatchEntry() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [session, setSession] = useState<DaySession | null>(null);
  const [search, setSearch] = useState("");
  const [rowValues, setRowValues] = useState<Record<string, WorkerRowValue>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workers = useLiveQuery(async () => {
    let collection = db.workers.toCollection();
    if (user?.teamId) {
      collection = db.workers.where("teamId").equals(user.teamId);
    } else if (user?.siteId) {
      collection = db.workers.filter((worker) => worker.siteId === user.siteId);
    }
    return collection.sortBy("lastName");
  }, [user?.teamId, user?.siteId]) ?? [];

  const activity = useLiveQuery(async () => {
    if (!session?.activityId) return undefined;
    return db.activities.get(session.activityId);
  }, [session?.activityId]) as ActivityRecord | undefined;

  useEffect(() => {
    void getDaySession().then((value) => {
      if (!value) {
        navigate("/", { replace: true });
        return;
      }
      setSession(value);
    });
  }, [navigate]);

  useEffect(() => {
    if (!session || workers.length === 0) return;
    setRowValues((current) => {
      const next: Record<string, WorkerRowValue> = { ...current };
      workers.forEach((worker) => {
        if (!next[worker.id]) {
          next[worker.id] = emptyRowValue(session.defaultQuantity);
        }
      });
      return next;
    });
  }, [session, workers]);

  const filteredWorkers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return workers;
    return workers.filter((worker) => {
      const haystack = `${worker.firstName} ${worker.lastName} ${worker.matricule}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [workers, search]);

  const stats = useMemo(() => {
    if (!activity) return { count: 0, totalAmount: 0 };
    let count = 0;
    let totalAmount = 0;
    workers.forEach((worker) => {
      const value = rowValues[worker.id];
      const quantity = Number(value?.quantity ?? 0);
      if (Number.isFinite(quantity) && quantity > 0) {
        count += 1;
        totalAmount += quantity * activity.unitRate;
      }
    });
    return { count, totalAmount };
  }, [activity, rowValues, workers]);

  function applyDefaultToAll() {
    if (!session) return;
    setRowValues((current) => {
      const next: Record<string, WorkerRowValue> = {};
      workers.forEach((worker) => {
        const existing = current[worker.id];
        next[worker.id] = {
          quantity: String(session.defaultQuantity),
          photoBlob: existing?.photoBlob ?? null,
          photoPreview: existing?.photoPreview ?? null,
        };
      });
      return next;
    });
  }

  function updateWorkerRow(workerId: string, value: WorkerRowValue) {
    setRowValues((current) => ({ ...current, [workerId]: value }));
  }

  async function handleSave() {
    if (!session || !activity) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const entries = workers
        .map((worker) => ({ worker, value: rowValues[worker.id] }))
        .filter(({ value }) => {
          const quantity = Number(value?.quantity ?? 0);
          return Number.isFinite(quantity) && quantity > 0;
        });

      if (entries.length === 0) {
        setError("Saisissez au moins un travailleur avec une quantité > 0.");
        return;
      }

      const nowIso = new Date().toISOString();

      const pendingSync: PointagePending[] = [];

      await db.transaction("rw", db.pointages, db.media, async () => {
        for (const { worker, value } of entries) {
          const clientUuid = uuidv7();
          const pointage: PointagePending = {
            clientUuid,
            workerId: worker.id,
            activityId: session.activityId,
            quantity: Number(value.quantity),
            date: session.date,
            createdByClientAt: nowIso,
            status: "local",
          };

          await db.pointages.add(pointage);
          pendingSync.push(pointage);

          if (value.photoBlob) {
            await db.media.put({
              clientUuid,
              refType: "pointage",
              blob: value.photoBlob,
              uploaded: false,
            });
          }
        }
      });

      for (const pointage of pendingSync) {
        await enqueuePointageSync(pointage);
      }

      if (navigator.onLine) {
        const result = await syncNow();
        setMessage(`${entries.length} pointage(s) enregistré(s) · ${result.synced} synchronisé(s)`);
      } else {
        setMessage(`${entries.length} pointage(s) enregistré(s) localement`);
      }

      navigate("/sync");
    } catch {
      setError("Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  if (!session) {
    return <p className="p-4 text-sm text-zinc-600">Chargement session…</p>;
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="space-y-4 p-4 pb-28">
        <header className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-zinc-900">Saisie lot</h1>
              <p className="text-sm text-zinc-600">
                {activity?.label ?? "Activité"} · {session.date}
              </p>
            </div>
            <ButtonLink to="/" variant="ghost" size="sm">
              Changer
            </ButtonLink>
          </div>

          <input
            type="search"
            placeholder="Rechercher un travailleur…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
          />

          <Button type="button" variant="ghost" size="sm" onClick={applyDefaultToAll}>
            Appliquer quantité par défaut ({session.defaultQuantity}) à tous
          </Button>
        </header>

        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {message && (
          <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">{message}</p>
        )}

        <div className="space-y-3">
          {filteredWorkers.map((worker: WorkerRecord) => (
            <WorkerRow
              key={worker.id}
              matricule={worker.matricule}
              firstName={worker.firstName}
              lastName={worker.lastName}
              unit={activity?.unit ?? "unité"}
              unitRate={activity?.unitRate ?? 0}
              value={rowValues[worker.id] ?? emptyRowValue(session.defaultQuantity)}
              disabled={saving}
              onChange={(value) => updateWorkerRow(worker.id, value)}
            />
          ))}
        </div>

        {filteredWorkers.length === 0 && (
          <p className="text-sm text-zinc-600">Aucun travailleur trouvé pour cette équipe.</p>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-zinc-600">{stats.count} travailleur(s) saisi(s)</span>
          <span className="font-medium text-zinc-900">
            Total prévisionnel : {stats.totalAmount.toLocaleString("fr-MG")} Ar
          </span>
        </div>
        <Button type="button" className="w-full" disabled={saving} onClick={() => void handleSave()}>
          {saving ? "Enregistrement…" : "Enregistrer le lot"}
        </Button>
      </div>
    </div>
  );
}
