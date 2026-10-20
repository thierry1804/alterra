import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { isAxiosError } from "axios";
import { UserRound, Pencil, Trash2, Power, PowerOff, Download } from "lucide-react";
import { api } from "../lib/api";
import { EmptyState } from "../components/ui/EmptyState";
import WorkerDetailDrawer from "../components/workers/WorkerDetailDrawer";
import { useSiteScope } from "../lib/site-scope";
import { cn } from "../lib/utils";
import type { Site, Team, Worker } from "../lib/referentials";
import { WORKER_SEXE_LABELS, WORKER_STATUS_LABELS } from "../lib/referentials";
import PageHeader, { LoadMoreButton } from "../components/shared/PageHeader";
import ImportDialog from "../components/workers/ImportDialog";
import { Button } from "../components/ui/button";
import { IconButton, RowActions } from "../components/ui/IconButton";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { useRowSelection } from "../components/ui/data-table/useRowSelection";
import { useServerSort } from "../components/ui/data-table/useServerSort";
import { SortableHead } from "../components/ui/data-table/SortableHead";
import { BulkActionBar } from "../components/ui/data-table/BulkActionBar";
import { exportToExcel } from "../components/ui/data-table/exportToExcel";
import { fetchAllCursorPages } from "../components/ui/data-table/fetchAllPages";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { toast } from "../hooks/use-toast";
import { TableQueryError } from "../components/ui/QueryError";

interface WorkerForm {
  matricule: string;
  firstName: string;
  lastName: string;
  mvolaNumber: string;
  siteId: string;
  hiredAt: string;
  status: Worker["status"];
  sexe: NonNullable<Worker["sexe"]> | "";
}

const emptyForm: WorkerForm = {
  matricule: "",
  firstName: "",
  lastName: "",
  mvolaNumber: "",
  siteId: "",
  hiredAt: new Date().toISOString().slice(0, 10),
  status: "ACTIVE",
  sexe: "",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export default function WorkersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useSiteScope();
  const [detail, setDetail] = useState<Worker | null>(null);
  const [teamFilter, setTeamFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<Worker["status"] | "">("");
  const [sexeFilter, setSexeFilter] = useState<NonNullable<Worker["sexe"]> | "">("");
  const [importOpen, setImportOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Worker | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [form, setForm] = useState<WorkerForm>(emptyForm);
  const [matriculeGenerating, setMatriculeGenerating] = useState(false);
  const [matriculeLocked, setMatriculeLocked] = useState(true);
  const [matriculeSeq, setMatriculeSeq] = useState<number | null>(null);
  // Ref plutôt que state : autofillMatricule est appelé juste après openCreate()/le
  // changement de site, dans le même tick — un state ne serait pas encore à jour
  // (closure figée sur l'ancienne valeur) au moment où autofillMatricule le lit.
  const matriculeEditedRef = useRef(false);
  const matriculeInputRef = useRef<HTMLInputElement>(null);

  const { data: sites = [] } = useQuery({
    queryKey: ["sites"],
    queryFn: () => api.get<{ data: Site[] }>("/sites").then((r) => r.data.data),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ["teams", "all"],
    queryFn: () => api.get<{ data: Team[] }>("/teams").then((r) => r.data.data),
  });

  const teamsForSiteFilter = useMemo(
    () => (siteFilter ? teams.filter((t) => t.siteId === siteFilter) : teams),
    [teams, siteFilter],
  );

  const { sortKey, sortDir, toggleSort } = useServerSort("lastName");

  const workersQuery = useInfiniteQuery({
    queryKey: [
      "workers",
      search,
      siteFilter,
      teamFilter,
      statusFilter,
      sexeFilter,
      sortKey,
      sortDir,
    ],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: Worker[]; nextCursor: string | null; hasMore: boolean }>("/workers", {
          params: {
            q: search || undefined,
            siteId: siteFilter || undefined,
            teamId: teamFilter || undefined,
            status: statusFilter || undefined,
            sexe: sexeFilter || undefined,
            cursor: pageParam,
            take: 50,
            orderBy: sortKey ?? undefined,
            dir: sortKey ? sortDir : undefined,
          },
        })
        .then((r) => r.data),
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
    // Pas de websocket/push : on repolle pour refléter vite les MOC créés/modifiés ailleurs.
    refetchInterval: 15000,
  });

  const workers = useMemo(
    () => workersQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [workersQuery.data],
  );

  const selection = useRowSelection(workers.map((w) => w.id));

  const bulkStatusMutation = useMutation({
    mutationFn: (status: Worker["status"]) =>
      api.post<{ results: Array<{ id: string; status: string; error?: string }> }>(
        "/workers/bulk-status",
        { ids: [...selection.selectedIds], status },
      ),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["workers"] });
      const failed = res.data.results.filter((r) => r.status === "error");
      selection.clear();
      toast({
        title: failed.length
          ? `${res.data.results.length - failed.length} traité(s), ${failed.length} échec(s)`
          : "Statut mis à jour",
        description: failed[0]?.error,
        variant: failed.length ? "destructive" : undefined,
      });
    },
  });

  const bulkSexeMutation = useMutation({
    mutationFn: (sexe: NonNullable<Worker["sexe"]>) =>
      api.post<{ results: Array<{ id: string; status: string; error?: string }> }>(
        "/workers/bulk-sexe",
        { ids: [...selection.selectedIds], sexe },
      ),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["workers"] });
      const failed = res.data.results.filter((r) => r.status === "error");
      selection.clear();
      toast({
        title: failed.length
          ? `${res.data.results.length - failed.length} traité(s), ${failed.length} échec(s)`
          : "Sexe mis à jour",
        description: failed[0]?.error,
        variant: failed.length ? "destructive" : undefined,
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: () =>
      api.post<{ results: Array<{ id: string; status: string; error?: string }> }>(
        "/workers/bulk-delete",
        { ids: [...selection.selectedIds] },
      ),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["workers"] });
      const failed = res.data.results.filter((r) => r.status === "error");
      selection.clear();
      setBulkDeleteConfirmOpen(false);
      toast({
        title: failed.length
          ? `${res.data.results.length - failed.length} supprimé(s), ${failed.length} échec(s)`
          : "Travailleurs supprimés",
        description: failed[0]?.error,
        variant: failed.length ? "destructive" : undefined,
      });
    },
  });

  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const rows =
        selection.selectedCount > 0
          ? workers.filter((w) => selection.isSelected(w.id))
          : await fetchAllCursorPages<Worker>((cursor) =>
              api
                .get<{ data: Worker[]; nextCursor: string | null; hasMore: boolean }>("/workers", {
                  params: {
                    q: search || undefined,
                    siteId: siteFilter || undefined,
                    teamId: teamFilter || undefined,
                    status: statusFilter || undefined,
                    sexe: sexeFilter || undefined,
                    cursor,
                    take: 100,
                  },
                })
                .then((r) => r.data),
            );
      await exportToExcel(
        rows,
        [
          { header: "Matricule", accessor: (w) => w.matricule },
          { header: "Prénom", accessor: (w) => w.firstName },
          { header: "Nom", accessor: (w) => w.lastName },
          { header: "MVola", accessor: (w) => w.mvolaNumber },
          { header: "Site", accessor: (w) => siteName(w.siteId) },
          { header: "Équipe", accessor: (w) => teamName(w.teamId) },
          { header: "Statut", accessor: (w) => WORKER_STATUS_LABELS[w.status] },
          { header: "Sexe", accessor: (w) => (w.sexe ? WORKER_SEXE_LABELS[w.sexe] : "") },
        ],
        "travailleurs",
      );
    } finally {
      setExporting(false);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        matricule: form.matricule.trim(),
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        mvolaNumber: form.mvolaNumber.trim(),
        siteId: form.siteId,
        hiredAt: form.hiredAt,
        status: form.status,
        sexe: form.sexe || null,
        ...(!editing && matriculeSeq !== null ? { legacyMocId: matriculeSeq } : {}),
      };
      if (editing) {
        return api.patch<Worker>(`/workers/${editing.id}`, payload);
      }
      return api.post<Worker>("/workers", payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workers"] });
      setDialogOpen(false);
      toast({ title: editing ? "MOC mis à jour" : "MOC créé" });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Échec", description: String(message), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (worker: Worker) => api.delete(`/workers/${worker.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workers"] });
      setDeleteTarget(null);
      toast({ title: "Travailleur supprimé" });
    },
  });

  const photoMutation = useMutation({
    mutationFn: async (worker: Worker) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      const file = await new Promise<File | null>((resolve) => {
        input.onchange = () => resolve(input.files?.[0] ?? null);
        input.click();
      });
      if (!file) return null;

      // Upload direct au backend : pas de presigned URL MinIO (injoignable depuis le navigateur,
      // bloquée par la CSP) — même raison que pour les photos de pointage.
      const { data } = await api.post<{ photoKey: string }>(
        `/workers/${worker.id}/photo-upload`,
        await file.arrayBuffer(),
        { headers: { "Content-Type": file.type || "image/jpeg" } },
      );
      await api.post(`/workers/${worker.id}/photo`, { photoKey: data.photoKey });
      return data.photoKey;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["workers"] });
      toast({ title: "Photo enregistrée" });
    },
    onError: () => {
      toast({ title: "Échec upload photo", variant: "destructive" });
    },
  });

  async function autofillMatricule(siteId: string) {
    const site = sites.find((s) => s.id === siteId);
    if (!site) return;

    setMatriculeGenerating(true);
    try {
      const siteWorkers = await fetchAllCursorPages<Worker>((cursor) =>
        api
          .get<{ data: Worker[]; nextCursor: string | null; hasMore: boolean }>("/workers", {
            params: { siteId, cursor, take: 100 },
          })
          .then((r) => r.data),
      );
      const prefix = `MOC-${site.shortCode}-`;
      const lastSeq = siteWorkers.reduce((max, w) => {
        if (!w.matricule.startsWith(prefix)) return max;
        const seq = Number(w.matricule.slice(prefix.length));
        return Number.isFinite(seq) ? Math.max(max, seq) : max;
      }, 0);
      const nextMatricule = `${prefix}${pad2(lastSeq + 1)}`;
      setMatriculeSeq(lastSeq + 1);
      // Ne pas écraser une saisie manuelle du matricule (mais un changement de site doit
      // pouvoir régénérer un matricule qui n'a encore jamais été touché à la main).
      setForm((f) => (matriculeEditedRef.current ? f : { ...f, matricule: nextMatricule }));
    } finally {
      setMatriculeGenerating(false);
    }
  }

  function openCreate() {
    setEditing(null);
    const defaultSiteId = sites[0]?.id ?? "";
    setForm({ ...emptyForm, siteId: defaultSiteId });
    matriculeEditedRef.current = false;
    setMatriculeLocked(true);
    setMatriculeSeq(null);
    setDialogOpen(true);
    if (defaultSiteId) void autofillMatricule(defaultSiteId);
  }

  function openEdit(worker: Worker) {
    setEditing(worker);
    setForm({
      matricule: worker.matricule,
      firstName: worker.firstName,
      lastName: worker.lastName,
      mvolaNumber: worker.mvolaNumber,
      siteId: worker.siteId,
      hiredAt: worker.hiredAt.slice(0, 10),
      status: worker.status,
      sexe: worker.sexe ?? "",
    });
    matriculeEditedRef.current = true;
    setMatriculeLocked(true);
    setMatriculeSeq(null);
    setDialogOpen(true);
  }

  const siteName = (siteId: string) =>
    sites.find((s) => s.id === siteId)?.shortCode ?? siteId.slice(0, 8);

  const teamName = (teamId: string | null) =>
    teamId ? (teams.find((t) => t.id === teamId)?.name ?? "—") : "—";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Travailleurs"
        description="Main-d'œuvre communautaire — référentiel travailleurs (MOC)."
        action={
          <div className="flex items-center gap-2">
            <IconButton icon={Download} label="Exporter" loading={exporting} onClick={() => void handleExport()} />
            <Button type="button" variant="outline" onClick={() => setImportOpen(true)}>
              Import Excel
            </Button>
            <Button type="button" onClick={openCreate}>
              Nouveau MOC
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Rechercher (nom, matricule, MVola…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          className="h-8 rounded-md border border-zinc-300 bg-white px-2.5 text-sm"
          value={siteFilter}
          onChange={(e) => {
            const nextSiteId = e.target.value;
            setSiteFilter(nextSiteId);
            // L'équipe sélectionnée peut ne plus appartenir au site choisi — on la réinitialise.
            if (nextSiteId && teamFilter) {
              const stillValid = teams.some((t) => t.id === teamFilter && t.siteId === nextSiteId);
              if (!stillValid) setTeamFilter("");
            }
          }}
        >
          <option value="">Tous les sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.shortCode}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded-md border border-zinc-300 bg-white px-2.5 text-sm"
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
        >
          <option value="">Toutes les équipes</option>
          {teamsForSiteFilter.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded-md border border-zinc-300 bg-white px-2.5 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as Worker["status"] | "")}
        >
          <option value="">Tous statuts</option>
          {(Object.keys(WORKER_STATUS_LABELS) as Worker["status"][]).map((status) => (
            <option key={status} value={status}>
              {WORKER_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        <select
          className="h-8 rounded-md border border-zinc-300 bg-white px-2.5 text-sm"
          value={sexeFilter}
          onChange={(e) => setSexeFilter(e.target.value as NonNullable<Worker["sexe"]> | "")}
        >
          <option value="">Tous sexes</option>
          {(Object.keys(WORKER_SEXE_LABELS) as NonNullable<Worker["sexe"]>[]).map((sexe) => (
            <option key={sexe} value={sexe}>
              {WORKER_SEXE_LABELS[sexe]}
            </option>
          ))}
        </select>
      </div>

      <BulkActionBar count={selection.selectedCount} onClear={selection.clear}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={bulkStatusMutation.isPending}
          onClick={() => bulkStatusMutation.mutate("ACTIVE")}
        >
          <Power className="h-3.5 w-3.5" aria-hidden />
          Activer
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={bulkStatusMutation.isPending}
          onClick={() => bulkStatusMutation.mutate("INACTIVE")}
        >
          <PowerOff className="h-3.5 w-3.5" aria-hidden />
          Désactiver
        </Button>
        <select
          className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm"
          disabled={bulkSexeMutation.isPending}
          value=""
          onChange={(e) => {
            const sexe = e.target.value as NonNullable<Worker["sexe"]> | "";
            if (sexe) bulkSexeMutation.mutate(sexe);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            Modifier le sexe…
          </option>
          {(Object.keys(WORKER_SEXE_LABELS) as NonNullable<Worker["sexe"]>[]).map((sexe) => (
            <option key={sexe} value={sexe}>
              {WORKER_SEXE_LABELS[sexe]}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={bulkDeleteMutation.isPending}
          onClick={() => setBulkDeleteConfirmOpen(true)}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Supprimer ({selection.selectedCount})
        </Button>
      </BulkActionBar>

      <div className="rounded-lg border border-zinc-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-9">
                <Checkbox
                  checked={
                    selection.allVisibleSelected
                      ? true
                      : selection.someVisibleSelected
                        ? "indeterminate"
                        : false
                  }
                  onChange={selection.toggleAllVisible}
                  aria-label="Tout sélectionner"
                />
              </TableHead>
              <TableHead className="w-12" />
              <SortableHead
                sortKey="matricule"
                label="Matricule"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHead
                sortKey="lastName"
                label="Nom"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHead
                sortKey="mvolaNumber"
                label="MVola"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHead
                sortKey="siteId"
                label="Site"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHead
                sortKey="teamId"
                label="Équipe"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHead
                sortKey="status"
                label="Statut"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHead
                sortKey="sexe"
                label="Sexe"
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={toggleSort}
              />
              <TableHead className="w-48">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workersQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={10} className="text-zinc-500">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {workersQuery.isError && (
              <TableQueryError
                colSpan={10}
                what="les MOC"
                onRetry={() => void workersQuery.refetch()}
              />
            )}
            {!workersQuery.isLoading &&
              workers.map((worker) => (
                <TableRow
                  key={worker.id}
                  data-state={selection.isSelected(worker.id) ? "selected" : undefined}
                >
                  <TableCell>
                    <Checkbox
                      checked={selection.isSelected(worker.id)}
                      onChange={() => selection.toggle(worker.id)}
                      aria-label={`Sélectionner ${worker.firstName} ${worker.lastName}`}
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100"
                      title="Photo"
                      onClick={() => photoMutation.mutate(worker)}
                    >
                      {worker.photoKey ? (
                        <span className="text-xs text-emerald-700">OK</span>
                      ) : (
                        <UserRound className="h-4 w-4 text-zinc-400" />
                      )}
                    </button>
                  </TableCell>
                  <TableCell>{worker.matricule}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => setDetail(worker)}
                      className="alterra-focus rounded text-left font-medium text-zinc-900 hover:text-brand hover:underline"
                    >
                      {worker.firstName} {worker.lastName}
                    </button>
                  </TableCell>
                  <TableCell>{worker.mvolaNumber}</TableCell>
                  <TableCell>{siteName(worker.siteId)}</TableCell>
                  <TableCell>{teamName(worker.teamId)}</TableCell>
                  <TableCell>
                    <Badge variant={worker.status === "ACTIVE" ? "success" : "warning"}>
                      {WORKER_STATUS_LABELS[worker.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{worker.sexe ? WORKER_SEXE_LABELS[worker.sexe] : "—"}</TableCell>
                  <TableCell>
                    <RowActions>
                      <IconButton
                        icon={Pencil}
                        label="Modifier"
                        variant="brand"
                        onClick={() => openEdit(worker)}
                      />
                      <IconButton
                        icon={Trash2}
                        label="Supprimer"
                        variant="destructive"
                        onClick={() => setDeleteTarget(worker)}
                      />
                    </RowActions>
                  </TableCell>
                </TableRow>
              ))}
            {!workersQuery.isLoading && workers.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="p-0">
                  <EmptyState
                    icon={UserRound}
                    title="Aucun MOC trouvé"
                    hint="Modifiez la recherche ou les filtres, ou ajoutez des travailleurs par import Excel."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <LoadMoreButton
        hasMore={!!workersQuery.hasNextPage}
        loading={workersQuery.isFetchingNextPage}
        onClick={() => void workersQuery.fetchNextPage()}
      />

      <WorkerDetailDrawer
        worker={detail}
        siteName={detail ? siteName(detail.siteId) : ""}
        teamName={detail ? teamName(detail.teamId) : ""}
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        onEdit={(worker) => {
          setDetail(null);
          openEdit(worker);
        }}
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void queryClient.invalidateQueries({ queryKey: ["workers"] })}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le MOC" : "Nouveau MOC"}</DialogTitle>
            <DialogDescription>
              Numéro MVola au format 034XXXXXXXX, 036XXXXXXXX ou 038XXXXXXXX.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="w-matricule">
                  Matricule{" "}
                  {matriculeGenerating && <span className="text-zinc-400">(génération…)</span>}
                </Label>
                <div className="relative">
                  <Input
                    id="w-matricule"
                    ref={matriculeInputRef}
                    value={form.matricule}
                    onChange={(e) => {
                      matriculeEditedRef.current = true;
                      setForm((f) => ({ ...f, matricule: e.target.value }));
                    }}
                    readOnly={matriculeLocked}
                    className={cn("pr-9", matriculeLocked && "bg-zinc-50 text-zinc-600")}
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-zinc-500 hover:text-zinc-700"
                    onClick={() => {
                      setMatriculeLocked(false);
                      requestAnimationFrame(() => matriculeInputRef.current?.focus());
                    }}
                    aria-label="Modifier le matricule"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="w-mvola">MVola</Label>
                <Input
                  id="w-mvola"
                  value={form.mvolaNumber}
                  onChange={(e) => setForm((f) => ({ ...f, mvolaNumber: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="w-first">Prénom</Label>
                <Input
                  id="w-first"
                  value={form.firstName}
                  onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="w-last">Nom</Label>
                <Input
                  id="w-last"
                  value={form.lastName}
                  onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="w-site">Site</Label>
                <select
                  id="w-site"
                  className="flex h-8 w-full rounded-md border border-zinc-300 bg-white px-2.5 text-sm"
                  value={form.siteId}
                  onChange={(e) => {
                    const siteId = e.target.value;
                    setForm((f) => ({ ...f, siteId }));
                    if (!editing) void autofillMatricule(siteId);
                  }}
                  required
                >
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="w-hired">Embauche</Label>
                <Input
                  id="w-hired"
                  type="date"
                  value={form.hiredAt}
                  onChange={(e) => setForm((f) => ({ ...f, hiredAt: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="w-sexe">Sexe</Label>
                <select
                  id="w-sexe"
                  className="flex h-8 w-full rounded-md border border-zinc-300 bg-white px-2.5 text-sm"
                  value={form.sexe}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sexe: e.target.value as NonNullable<Worker["sexe"]> | "",
                    }))
                  }
                >
                  <option value="">Non renseigné</option>
                  {(Object.keys(WORKER_SEXE_LABELS) as NonNullable<Worker["sexe"]>[]).map(
                    (sexe) => (
                      <option key={sexe} value={sexe}>
                        {WORKER_SEXE_LABELS[sexe]}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="w-status">Statut</Label>
                <select
                  id="w-status"
                  className="flex h-8 w-full rounded-md border border-zinc-300 bg-white px-2.5 text-sm"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as Worker["status"] }))
                  }
                >
                  {(Object.keys(WORKER_STATUS_LABELS) as Worker["status"][]).map((status) => (
                    <option key={status} value={status}>
                      {WORKER_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer ce travailleur ?</DialogTitle>
            <DialogDescription>
              {deleteTarget
                ? `${deleteTarget.firstName} ${deleteTarget.lastName} (${deleteTarget.matricule}) sera définitivement retiré du référentiel.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              {deleteMutation.isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer {selection.selectedCount} travailleur(s) ?</DialogTitle>
            <DialogDescription>
              Les travailleurs sélectionnés seront retirés du référentiel.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setBulkDeleteConfirmOpen(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={bulkDeleteMutation.isPending}
              onClick={() => bulkDeleteMutation.mutate()}
            >
              {bulkDeleteMutation.isPending ? "Suppression…" : "Supprimer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
