import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { ActivitySummary, Pointage, WorkerSummary } from "../lib/pointages";
import type { TeamSummary } from "../lib/teams";
import TeamGroup, { type TeamGroupItem } from "../components/validation/TeamGroup";
import RejectDialog from "../components/ui/RejectDialog";
import Button from "../components/ui/Button";
import ContextHelp, { GlossaryTerm } from "../components/ui/ContextHelp";
import { apiErrorMessage } from "../lib/errors";
import { syncBiometricTemplatesFromServer } from "../services/biometric/TemplateCache";

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
  const [teamsMap, setTeamsMap] = useState<Map<string, TeamSummary>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkTeamKey, setBulkTeamKey] = useState<string | null>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{
    pointageId: string;
    workerName: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      void syncBiometricTemplatesFromServer().catch(() => undefined);
      const [pending, teamsResponse, activitiesResponse] = await Promise.all([
        fetchAllPendingPointages(),
        api.get<{ data: TeamSummary[] }>("/teams", { params: { active: "true" } }),
        api.get<{ data: ActivitySummary[] }>("/activities", { params: { active: "true" } }),
      ]);
      setPointages(pending);
      setTeamsMap(new Map(teamsResponse.data.data.map((team) => [team.id, team])));
      setActivitiesMap(
        new Map(activitiesResponse.data.data.map((activity) => [activity.id, activity])),
      );

      const workerIds = [...new Set(pending.map((pointage) => pointage.workerId))];
      const workerEntries = await Promise.all(
        workerIds.map(async (id) => {
          const response = await api.get<WorkerSummary>(`/workers/${id}`);
          return response.data;
        }),
      );
      setWorkersMap(new Map(workerEntries.map((worker) => [worker.id, worker])));
    } catch {
      setError("Impossible de charger les pointages en attente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && rejectTarget) {
        setRejectTarget(null);
      }
      if (event.key === "r" || event.key === "R") {
        const target = event.target as HTMLElement | null;
        if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
        void loadData();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [loadData, rejectTarget]);

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
      .map(([teamKey, items]) => {
        const team = teamKey === "none" ? null : teamsMap.get(teamKey);
        const chef = team?.chef;
        const teamLabel =
          teamKey === "none"
            ? "Sans équipe"
            : team?.name ??
              (chef ? `Équipe ${chef.lastName}` : `Équipe ${teamKey.slice(0, 8)}`);

        return {
          teamKey,
          teamLabel,
          items: items.sort((a, b) => a.worker.lastName.localeCompare(b.worker.lastName)),
        };
      })
      .sort((a, b) => a.teamLabel.localeCompare(b.teamLabel));
  }, [pointages, workersMap, activitiesMap, teamsMap]);

  async function handleValidate(pointageId: string) {
    setBusyId(pointageId);
    setMessage(null);
    setError(null);
    try {
      await api.patch(`/pointages/${pointageId}/validate`);
      setPointages((current) => current.filter((pointage) => pointage.id !== pointageId));
      setMessage("Pointage validé.");
    } catch (err) {
      setError(apiErrorMessage(err, "Validation échouée."));
    } finally {
      setBusyId(null);
    }
  }

  async function handleValidateTeam(_teamKey: string, items: TeamGroupItem[]) {
    const eligible = items.filter(({ pointage }) => pointage.bioCheck?.result === "OK");
    if (eligible.length === 0) {
      setError("Aucun pointage bio OK dans cette équipe — lancez les contrôles bio d'abord.");
      return;
    }

    setBulkTeamKey(_teamKey);
    setBulkProgress({ done: 0, total: eligible.length });
    setMessage(null);
    setError(null);

    let validated = 0;
    let skipped = 0;

    for (const { pointage } of eligible) {
      try {
        await api.patch(`/pointages/${pointage.id}/validate`);
        setPointages((current) => current.filter((row) => row.id !== pointage.id));
        validated += 1;
      } catch {
        skipped += 1;
      }
      setBulkProgress({ done: validated + skipped, total: eligible.length });
    }

    setBulkTeamKey(null);
    setBulkProgress(null);
    setMessage(
      `${validated} pointage(s) validé(s)` +
        (skipped > 0 ? ` · ${skipped} non validé(s) (bio ou erreur serveur)` : ""),
    );
  }

  function openRejectDialog(pointageId: string) {
    const worker = workersMap.get(
      pointages.find((pointage) => pointage.id === pointageId)?.workerId ?? "",
    );
    setRejectTarget({
      pointageId,
      workerName: worker ? `${worker.firstName} ${worker.lastName}` : "ce travailleur",
    });
  }

  async function handleRejectConfirm(reason: string) {
    if (!rejectTarget) return;

    setBusyId(rejectTarget.pointageId);
    setMessage(null);
    setError(null);
    try {
      await api.patch(`/pointages/${rejectTarget.pointageId}/reject`, {
        rejectionReason: reason,
      });
      setPointages((current) =>
        current.filter((pointage) => pointage.id !== rejectTarget.pointageId),
      );
      setMessage("Pointage rejeté.");
      setRejectTarget(null);
    } catch (err) {
      setError(apiErrorMessage(err, "Rejet échoué."));
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
            Pointages en attente groupés par équipe — contrôle bio requis avant validation.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadData()}>
          Actualiser
        </Button>
      </header>

      <ContextHelp id="validation" title="Comment valider ?">
        <GlossaryTerm term="Bio OK">
          Contrôle biométrique réussi — requis avant validation du paiement.
        </GlossaryTerm>
        <GlossaryTerm term="MOC">
          Main-d&apos;œuvre communautaire — travailleur du programme.
        </GlossaryTerm>
        <p>Raccourci clavier : touche R pour actualiser la liste.</p>
      </ContextHelp>

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
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <p>Aucun pointage en attente de validation.</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => void loadData()}>
            Actualiser
          </Button>
        </div>
      )}

      {groupedTeams.map((group) => (
        <TeamGroup
          key={group.teamKey}
          teamKey={group.teamKey}
          teamLabel={group.teamLabel}
          items={group.items}
          busyId={busyId}
          bulkBusy={bulkTeamKey === group.teamKey}
          bulkProgress={bulkTeamKey === group.teamKey ? bulkProgress : null}
          onValidate={(pointageId) => void handleValidate(pointageId)}
          onReject={openRejectDialog}
          onValidateTeam={(teamKey, items) => void handleValidateTeam(teamKey, items)}
        />
      ))}

      <RejectDialog
        open={rejectTarget !== null}
        workerName={rejectTarget?.workerName ?? ""}
        busy={busyId === rejectTarget?.pointageId}
        onConfirm={(reason) => void handleRejectConfirm(reason)}
        onCancel={() => setRejectTarget(null)}
      />
    </div>
  );
}
