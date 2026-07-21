import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { UserRound } from "lucide-react";
import { api } from "../lib/api";
import type { Site, Worker } from "../lib/referentials";
import { WORKER_STATUS_LABELS } from "../lib/referentials";
import PageHeader, { LoadMoreButton } from "../components/shared/PageHeader";
import ImportDialog from "../components/workers/ImportDialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
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

interface WorkerForm {
  matricule: string;
  firstName: string;
  lastName: string;
  mvolaNumber: string;
  siteId: string;
  hiredAt: string;
  status: Worker["status"];
}

const emptyForm: WorkerForm = {
  matricule: "",
  firstName: "",
  lastName: "",
  mvolaNumber: "",
  siteId: "",
  hiredAt: new Date().toISOString().slice(0, 10),
  status: "ACTIVE",
};

export default function WorkersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [siteFilter, setSiteFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<Worker["status"] | "">("");
  const [importOpen, setImportOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Worker | null>(null);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [form, setForm] = useState<WorkerForm>(emptyForm);

  const { data: sites = [] } = useQuery({
    queryKey: ["sites"],
    queryFn: () => api.get<{ data: Site[] }>("/sites").then((r) => r.data.data),
  });

  const workersQuery = useInfiniteQuery({
    queryKey: ["workers", search, siteFilter, statusFilter],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: Worker[]; nextCursor: string | null; hasMore: boolean }>("/workers", {
          params: {
            q: search || undefined,
            siteId: siteFilter || undefined,
            status: statusFilter || undefined,
            cursor: pageParam,
            take: 50,
          },
        })
        .then((r) => r.data),
    getNextPageParam: (last) => (last.hasMore ? last.nextCursor ?? undefined : undefined),
  });

  const workers = useMemo(
    () => workersQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [workersQuery.data],
  );

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
      const { data } = await api.post<{ uploadUrl: string; photoKey: string }>(
        `/workers/${worker.id}/photo-upload-url`,
      );
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      const file = await new Promise<File | null>((resolve) => {
        input.onchange = () => resolve(input.files?.[0] ?? null);
        input.click();
      });
      if (!file) return null;

      await fetch(data.uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
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

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, siteId: sites[0]?.id ?? "" });
    setDialogOpen(true);
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
    });
    setDialogOpen(true);
  }

  const siteName = (siteId: string) =>
    sites.find((s) => s.id === siteId)?.shortCode ?? siteId.slice(0, 8);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Travailleurs"
        description="Main-d'œuvre communautaire — référentiel travailleurs (MOC)."
        action={
          <div className="flex gap-2">
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
          className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
          value={siteFilter}
          onChange={(e) => setSiteFilter(e.target.value)}
        >
          <option value="">Tous les sites</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>
              {site.shortCode}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border border-zinc-300 bg-white px-3 text-sm"
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
      </div>

      <div className="rounded-lg border border-zinc-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12" />
              <TableHead>Matricule</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>MVola</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-48">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {workersQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-zinc-500">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {!workersQuery.isLoading &&
              workers.map((worker) => (
                <TableRow key={worker.id}>
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
                    {worker.firstName} {worker.lastName}
                  </TableCell>
                  <TableCell>{worker.mvolaNumber}</TableCell>
                  <TableCell>{siteName(worker.siteId)}</TableCell>
                  <TableCell>
                    <Badge variant={worker.status === "ACTIVE" ? "success" : "warning"}>
                      {WORKER_STATUS_LABELS[worker.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(worker)}>
                        Modifier
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-red-700 hover:text-red-800"
                        onClick={() => setDeleteTarget(worker)}
                      >
                        Supprimer
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!workersQuery.isLoading && workers.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-zinc-500">
                  Aucun MOC trouvé.
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

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void queryClient.invalidateQueries({ queryKey: ["workers"] })}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le MOC" : "Nouveau MOC"}</DialogTitle>
            <DialogDescription>Numéro MVola au format 034XXXXXXXX.</DialogDescription>
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
                <Label htmlFor="w-matricule">Matricule</Label>
                <Input
                  id="w-matricule"
                  value={form.matricule}
                  onChange={(e) => setForm((f) => ({ ...f, matricule: e.target.value }))}
                  required
                />
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
                  className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
                  value={form.siteId}
                  onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}
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
            <div className="space-y-2">
              <Label htmlFor="w-status">Statut</Label>
              <select
                id="w-status"
                className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
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
    </div>
  );
}
