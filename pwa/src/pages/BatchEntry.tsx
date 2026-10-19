import { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useNavigate } from "react-router-dom";
import { Copy, Search } from "lucide-react";
import WorkerRow, { type WorkerRowValue } from "../components/pointage/WorkerRow";
import { parseDecimal } from "../lib/number";
import Button, { ButtonLink } from "../components/ui/Button";
import { LoadingScreen, EmptyHint, Spinner } from "../components/ui/feedback";
import { IconCheck } from "../components/icons";
import Stepper from "../components/ui/Stepper";
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

  const workersResult = useLiveQuery(async () => {
    let collection = db.workers.toCollection();
    if (user?.teamId) {
      collection = db.workers.where("teamId").equals(user.teamId);
    } else if (user?.siteId) {
      collection = db.workers.filter((worker) => worker.siteId === user.siteId);
    }
    return collection.sortBy("lastName");
  }, [user?.teamId, user?.siteId]);
  const workers = useMemo(() => workersResult ?? [], [workersResult]);

  const activity = useLiveQuery(async () => {
    if (!session?.subActivityId) return undefined;
    return db.activities.get(session.subActivityId);
  }, [session?.subActivityId]) as ActivityRecord | undefined;

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
      const quantity = parseDecimal(value?.quantity ?? "0");
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
          const quantity = parseDecimal(value?.quantity ?? "0");
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
            subActivityId: session.subActivityId,
            quantity: parseDecimal(value.quantity),
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
    return <LoadingScreen label="Chargement de la session…" />;
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="space-y-4 p-4 pb-32">
        <header className="space-y-3">
          <Stepper steps={["Activité", "Quantités"]} current={1} />

          <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-900">
                {activity?.label ?? "Activité"}
              </p>
              <p className="text-xs text-zinc-500">
                {activity && (
                  <>
                    <span className="alterra-num">{activity.unitRate.toLocaleString("fr-MG")}</span>{" "}
                    Ar / {activity.unit} ·{" "}
                  </>
                )}
                {new Date(`${session.date}T00:00:00.000Z`).toLocaleDateString("fr-FR", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  timeZone: "UTC",
                })}
              </p>
            </div>
            <ButtonLink to="/" variant="outline" size="sm">
              Changer
            </ButtonLink>
          </div>

          {workers.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-zinc-600">
                <span>
                  <span className="alterra-num font-semibold text-zinc-900">{stats.count}</span> sur{" "}
                  <span className="alterra-num">{workers.length}</span> saisis
                </span>
                <button
                  type="button"
                  onClick={applyDefaultToAll}
                  className="alterra-focus inline-flex min-h-8 items-center gap-1.5 rounded-full px-2 font-semibold text-brand"
                >
                  <Copy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Mettre {session.defaultQuantity} à tous
                </button>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${Math.round((stats.count / workers.length) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {workers.length > 6 && (
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Chercher un travailleur…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-zinc-300 py-2 pl-9 pr-3"
              />
            </div>
          )}
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

        <div className="space-y-2">
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
          <EmptyHint>
            {search
              ? "Aucun travailleur ne correspond à cette recherche."
              : "Aucun travailleur dans cette équipe."}
          </EmptyHint>
        )}
      </div>

      <div
        className="fixed inset-x-0 z-20 border-t border-zinc-200 bg-white p-4"
        style={{ bottom: "calc(var(--bottom-nav-h) + var(--safe-area-bottom))" }}
      >
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-zinc-600">
            <span className="alterra-num">{stats.count}</span> travailleur(s) saisi(s)
          </span>
          <span className="text-zinc-600">
            Total prévisionnel{" "}
            <span className="alterra-num font-semibold text-brand">
              {stats.totalAmount.toLocaleString("fr-MG")} Ar
            </span>
          </span>
        </div>
        <Button
          type="button"
          size="lg"
          className="w-full gap-2"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? (
            <Spinner className="h-4 w-4 text-white" />
          ) : (
            <IconCheck className="h-4 w-4 shrink-0" />
          )}
          {saving ? "Enregistrement…" : "Enregistrer le lot"}
        </Button>
      </div>
    </div>
  );
}
