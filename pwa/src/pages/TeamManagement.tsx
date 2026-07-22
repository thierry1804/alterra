import { useCallback, useEffect, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import type { TeamDetail, TeamSummary, WorkerSearchHit } from "../lib/teams";
import Button from "../components/ui/Button";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { syncReferentials } from "../sync/ReferentialSync";

function memberLabel(member: { firstName: string; lastName: string; matricule: string }): string {
  return `${member.lastName} ${member.firstName} (${member.matricule})`;
}

function errorMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const code = err.response?.data?.code as string | undefined;
    const message = err.response?.data?.message as string | undefined;
    if (message) return message;
    if (code === "DUPLICATE") return "Ce nom d'équipe existe déjà.";
    if (code === "FORBIDDEN") return "Action non autorisée.";
  }
  return fallback;
}

interface MemberSearchProps {
  siteId: string;
  teamId: string;
  existingMemberIds: Set<string>;
  onAdd: (workerId: string) => Promise<void>;
  disabled?: boolean;
}

function MemberSearch({ siteId, teamId, existingMemberIds, onAdd, disabled }: MemberSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<WorkerSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await api.get<{ data: WorkerSearchHit[] }>("/workers", {
          params: { q: query.trim(), siteId, status: "ACTIVE", take: 20 },
        });
        setResults(
          response.data.data.filter(
            (worker) => !existingMemberIds.has(worker.id) && worker.teamId !== teamId,
          ),
        );
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query, siteId, teamId, existingMemberIds]);

  async function handleAdd(workerId: string) {
    setBusyId(workerId);
    try {
      await onAdd(workerId);
      setQuery("");
      setResults([]);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-zinc-600" htmlFor={`search-${teamId}`}>
        Ajouter un travailleur
      </label>
      <input
        id={`search-${teamId}`}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Nom, matricule ou Mvola…"
        disabled={disabled}
        className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
      />
      {searching && <p className="text-xs text-zinc-500">Recherche…</p>}
      {results.length > 0 && (
        <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 bg-white">
          {results.map((worker) => (
            <li key={worker.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-sm text-zinc-800">{memberLabel(worker)}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busyId === worker.id || disabled}
                onClick={() => void handleAdd(worker.id)}
              >
                Ajouter
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface TeamCardProps {
  team: TeamDetail;
  canEditStructure: boolean;
  chefs: TeamSummary["chef"][];
  onRefresh: () => Promise<void>;
  onSyncCache: () => Promise<void>;
}

type TeamConfirmAction =
  | { type: "deactivate" }
  | { type: "remove"; workerId: string; workerName: string };

function TeamCard({ team, canEditStructure, chefs, onRefresh, onSyncCache }: TeamCardProps) {
  const [expanded, setExpanded] = useState(!canEditStructure);
  const [name, setName] = useState(team.name);
  const [chefId, setChefId] = useState(team.chefId ?? "");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [members, setMembers] = useState(team.members);
  const [confirmAction, setConfirmAction] = useState<TeamConfirmAction | null>(null);
  const panelId = `team-panel-${team.id}`;

  useEffect(() => {
    setName(team.name);
    setChefId(team.chefId ?? "");
    setMembers(team.members);
  }, [team]);

  const memberIds = useMemo(() => new Set(members.map((member) => member.id)), [members]);

  async function saveStructure() {
    setBusy(true);
    setLocalError(null);
    try {
      await api.patch(`/teams/${team.id}`, {
        name: name.trim(),
        chefId: chefId || null,
      });
      await onRefresh();
    } catch (err) {
      setLocalError(errorMessage(err, "Mise à jour échouée."));
    } finally {
      setBusy(false);
    }
  }

  async function deactivateTeam() {
    setBusy(true);
    setLocalError(null);
    try {
      await api.delete(`/teams/${team.id}`);
      setConfirmAction(null);
      await onRefresh();
    } catch (err) {
      setLocalError(errorMessage(err, "Désactivation échouée."));
    } finally {
      setBusy(false);
    }
  }

  async function addMember(workerId: string) {
    setLocalError(null);
    try {
      await api.post(`/teams/${team.id}/members`, { workerId });
      const detail = await api.get<TeamDetail>(`/teams/${team.id}`);
      setMembers(detail.data.members);
      await onSyncCache();
    } catch (err) {
      setLocalError(errorMessage(err, "Ajout échoué."));
      throw err;
    }
  }

  async function removeMember(workerId: string) {
    setBusy(true);
    setLocalError(null);
    try {
      await api.delete(`/teams/${team.id}/members/${workerId}`);
      setMembers((current) => current.filter((member) => member.id !== workerId));
      setConfirmAction(null);
      await onSyncCache();
    } catch (err) {
      setLocalError(errorMessage(err, "Retrait échoué."));
    } finally {
      setBusy(false);
    }
  }

  function handleConfirmAction() {
    if (!confirmAction) return;
    if (confirmAction.type === "deactivate") {
      void deactivateTeam();
      return;
    }
    void removeMember(confirmAction.workerId);
  }

  return (
    <section className="rounded-md border border-zinc-200 bg-white">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full min-h-11 items-center justify-between gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-400"
      >
        <div>
          <p className="text-sm font-medium text-zinc-900">{team.name}</p>
          <p className="text-xs text-zinc-600">
            {members.length} travailleur(s)
            {team.chef ? ` · Chef : ${team.chef.lastName} ${team.chef.firstName}` : ""}
            {!team.active ? " · Inactive" : ""}
          </p>
        </div>
        <span className="shrink-0 text-xs font-medium text-zinc-600">{expanded ? "Masquer" : "Gérer"}</span>
      </button>

      {expanded && (
        <div id={panelId} className="space-y-4 border-t border-zinc-200 px-4 py-4">
          {localError && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {localError}
            </p>
          )}

          {canEditStructure && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-zinc-600" htmlFor={`name-${team.id}`}>
                  Nom
                </label>
                <input
                  id={`name-${team.id}`}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600" htmlFor={`chef-${team.id}`}>
                  Chef d'équipe
                </label>
                <select
                  id={`chef-${team.id}`}
                  value={chefId}
                  onChange={(event) => setChefId(event.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
                >
                  <option value="">— Aucun —</option>
                  {chefs.map((chef) =>
                    chef ? (
                      <option key={chef.id} value={chef.id}>
                        {chef.lastName} {chef.firstName}
                        {chef.teamId && chef.teamId !== team.id ? " (autre équipe)" : ""}
                      </option>
                    ) : null,
                  )}
                </select>
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button
                  type="button"
                  disabled={busy || !name.trim()}
                  onClick={() => void saveStructure()}
                >
                  Enregistrer
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => setConfirmAction({ type: "deactivate" })}
                >
                  Désactiver
                </Button>
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-zinc-600">Membres</p>
            {members.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-600">Aucun travailleur dans cette équipe.</p>
            ) : (
              <ul className="mt-2 divide-y divide-zinc-200 rounded-md border border-zinc-200">
                {members.map((member) => (
                  <li key={member.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="text-sm text-zinc-800">{memberLabel(member)}</span>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        setConfirmAction({
                          type: "remove",
                          workerId: member.id,
                          workerName: `${member.firstName} ${member.lastName}`,
                        })
                      }
                    >
                      Retirer
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <MemberSearch
            siteId={team.siteId}
            teamId={team.id}
            existingMemberIds={memberIds}
            onAdd={addMember}
            disabled={busy || !team.active}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmAction !== null}
        title={
          confirmAction?.type === "deactivate"
            ? "Désactiver l'équipe ?"
            : "Retirer ce travailleur ?"
        }
        description={
          confirmAction?.type === "deactivate"
            ? `L'équipe « ${team.name} » ne sera plus active. Les travailleurs restent dans le référentiel.`
            : confirmAction?.type === "remove"
              ? `${confirmAction.workerName} sera retiré de l'équipe « ${team.name} ».`
              : ""
        }
        confirmLabel={
          confirmAction?.type === "deactivate" ? "Désactiver" : "Retirer"
        }
        destructive
        busy={busy}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmAction(null)}
      />
    </section>
  );
}

export default function TeamManagement() {
  const { user } = useAuth();
  const isCds = user?.role === "CHEF_SERVICE" || user?.role === "ADMIN";
  const isCde = user?.role === "CHEF_EQUIPE";

  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [teamDetails, setTeamDetails] = useState<Map<string, TeamDetail>>(new Map());
  const [chefs, setChefs] = useState<TeamSummary["chef"][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamChefId, setNewTeamChefId] = useState("");
  const [creating, setCreating] = useState(false);

  const syncCache = useCallback(async () => {
    if (!user?.siteId) return;
    await syncReferentials({ siteId: user.siteId, teamId: user.teamId });
  }, [user?.siteId, user?.teamId]);

  const loadTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const listResponse = await api.get<{ data: TeamSummary[] }>("/teams", {
        params: { active: "true" },
      });
      const visibleTeams = isCde
        ? listResponse.data.data.filter((team) => team.id === user?.teamId)
        : listResponse.data.data;
      setTeams(visibleTeams);

      const details = await Promise.all(
        visibleTeams.map((team) => api.get<TeamDetail>(`/teams/${team.id}`).then((r) => r.data)),
      );
      setTeamDetails(new Map(details.map((detail) => [detail.id, detail])));

      if (isCds) {
        const chefsResponse = await api.get<{ data: TeamSummary["chef"][] }>("/teams/chef-candidates");
        setChefs(chefsResponse.data.data);
      }
    } catch (err) {
      setError(errorMessage(err, "Chargement des équipes échoué."));
    } finally {
      setLoading(false);
    }
  }, [isCde, isCds, user?.teamId]);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  async function createTeam() {
    if (!newTeamName.trim()) return;
    setCreating(true);
    setError(null);
    setMessage(null);
    try {
      await api.post("/teams", {
        name: newTeamName.trim(),
        chefId: newTeamChefId || null,
      });
      setNewTeamName("");
      setNewTeamChefId("");
      setMessage("Équipe créée.");
      await loadTeams();
      await syncCache();
    } catch (err) {
      setError(errorMessage(err, "Création échouée."));
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return <p className="p-4 text-sm text-zinc-600">Chargement des équipes…</p>;
  }

  return (
    <div className="space-y-4 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Équipes</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {isCds
              ? "Créez les équipes, assignez un chef et gérez les travailleurs."
              : "Ajoutez ou retirez les travailleurs de votre équipe."}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadTeams()}>
          Actualiser
        </Button>
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
          <h2 className="text-sm font-medium text-zinc-900">Nouvelle équipe</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-600" htmlFor="new-team-name">
                Nom
              </label>
              <input
                id="new-team-name"
                value={newTeamName}
                onChange={(event) => setNewTeamName(event.target.value)}
                placeholder="Ex. MNK-4"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600" htmlFor="new-team-chef">
                Chef d'équipe (optionnel)
              </label>
              <select
                id="new-team-chef"
                value={newTeamChefId}
                onChange={(event) => setNewTeamChefId(event.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
              >
                <option value="">— Aucun —</option>
                {chefs.map((chef) =>
                  chef ? (
                    <option key={chef.id} value={chef.id}>
                      {chef.lastName} {chef.firstName}
                      {chef.teamId ? " (équipe assignée)" : ""}
                    </option>
                  ) : null,
                )}
              </select>
            </div>
          </div>
          <Button type="button" className="mt-3" disabled={creating || !newTeamName.trim()} onClick={() => void createTeam()}>
            Créer l'équipe
          </Button>
        </section>
      )}

      {teams.length === 0 && (
        <p className="text-sm text-zinc-500">Aucune équipe active sur ce site.</p>
      )}

      <div className="space-y-3">
        {teams.map((team) => {
          const detail = teamDetails.get(team.id);
          if (!detail) return null;
          return (
            <TeamCard
              key={team.id}
              team={detail}
              canEditStructure={isCds}
              chefs={chefs}
              onRefresh={loadTeams}
              onSyncCache={syncCache}
            />
          );
        })}
      </div>
    </div>
  );
}
