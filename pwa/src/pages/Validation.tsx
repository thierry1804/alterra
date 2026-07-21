import { useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../lib/api";
import type { ActivitySummary, Pointage, WorkerSummary } from "../lib/pointages";
import TeamGroup, { type TeamGroupItem } from "../components/validation/TeamGroup";

async function fetchAllPendingPointages(): Promise<Pointage[]> {
  const rows: Pointage[] = [];
  let cursor: string | undefined;

  do {
    const response = await api.get<{
      data: Pointage[];
      nextCursor: string | null;
      hasMore: boolean;
    }>("/pointages", {
      params: {
        status: "PENDING",
        cursor,
      },
    });

    rows.push(...response.data.data);
    cursor = response.data.hasMore ? (response.data.nextCursor ?? undefined) : undefined;
  } while (cursor);

  return rows;
}

export default function Validation() {
  const [pointages, setPointages] = useState<Pointage[]>([]);
  const [workersMap, setWorkersMap] = useState<Map<string, WorkerSummary>>(new Map());
  const [activitiesMap, setActivitiesMap] = useState<Map<string, ActivitySummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const pending = await fetchAllPendingPointages();
      setPointages(pending);

      const workerIds = [...new Set(pending.map((pointage) => pointage.workerId))];
      const workerEntries = await Promise.all(
        workerIds.map(async (id) => {
          const response = await api.get<WorkerSummary>(`/workers/${id}`);
          return response.data;
        }),
      );
      setWorkersMap(new Map(workerEntries.map((worker) => [worker.id, worker])));

      const activitiesResponse = await api.get<{ data: ActivitySummary[] }>("/activities", {
        params: { active: "true" },
      });
      setActivitiesMap(
        new Map(activitiesResponse.data.data.map((activity) => [activity.id, activity])),
      );
    } catch {
      setError("Impossible de charger les pointages en attente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const groupedTeams = useMemo(() => {
    const groups = new Map<string, TeamGroupItem[]>();

    pointages.forEach((pointage) => {
      const worker = workersMap.get(pointage.workerId);
      const activity = activitiesMap.get(pointage.activityId);
      if (!worker || !activity) return;

      const teamKey = worker.teamId ?? "none";
      const current = groups.get(teamKey) ?? [];
      current.push({ pointage, worker, activity });
      groups.set(teamKey, current);
    });

    return [...groups.entries()]
      .map(([teamKey, items]) => ({
        teamKey,
        teamLabel:
          teamKey === "none"
            ? "Sans équipe"
            : `Équipe ${teamKey.slice(0, 8)}`,
        items: items.sort((a, b) => a.worker.lastName.localeCompare(b.worker.lastName)),
      }))
      .sort((a, b) => a.teamLabel.localeCompare(b.teamLabel));
  }, [pointages, workersMap, activitiesMap]);

  async function handleValidate(pointageId: string) {
    setBusyId(pointageId);
    setMessage(null);
    try {
      await api.patch(`/pointages/${pointageId}/validate`);
      setPointages((current) => current.filter((pointage) => pointage.id !== pointageId));
      setMessage("Pointage validé.");
    } catch (err) {
      const code = isAxiosError(err) ? err.response?.data?.code : null;
      if (code === "BIO_NOT_OK") {
        setError("Validation impossible — contrôle biométrique requis.");
      } else {
        setError("Validation échouée.");
      }
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(pointageId: string) {
    const reason = window.prompt("Motif de rejet (min. 3 caractères) :");
    if (!reason || reason.trim().length < 3) return;

    setBusyId(pointageId);
    setMessage(null);
    try {
      await api.patch(`/pointages/${pointageId}/reject`, { rejectionReason: reason.trim() });
      setPointages((current) => current.filter((pointage) => pointage.id !== pointageId));
      setMessage("Pointage rejeté.");
    } catch {
      setError("Rejet échoué.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="p-4 text-sm text-zinc-600">Chargement des pointages…</p>;
  }

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Validation hebdomadaire</h1>
          <p className="mt-1 text-sm text-zinc-600">
            Pointages en attente groupés par équipe — bio requise avant validation.
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

      {groupedTeams.length === 0 && (
        <p className="text-sm text-zinc-500">Aucun pointage en attente de validation.</p>
      )}

      {groupedTeams.map((group) => (
        <TeamGroup
          key={group.teamKey}
          teamLabel={group.teamLabel}
          items={group.items}
          busyId={busyId}
          onValidate={(pointageId) => void handleValidate(pointageId)}
          onReject={(pointageId) => void handleReject(pointageId)}
        />
      ))}
    </div>
  );
}
