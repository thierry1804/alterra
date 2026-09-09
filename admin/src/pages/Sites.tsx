import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../lib/api";
import type { Site } from "../lib/referentials";
import PageHeader from "../components/shared/PageHeader";
import { Pencil, Power, PowerOff, Download } from "lucide-react";
import { Button } from "../components/ui/button";
import { IconButton, RowActions } from "../components/ui/IconButton";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Checkbox } from "../components/ui/checkbox";
import { useRowSelection } from "../components/ui/data-table/useRowSelection";
import { useClientSort } from "../components/ui/data-table/useClientSort";
import { SortableHead } from "../components/ui/data-table/SortableHead";
import { BulkActionBar } from "../components/ui/data-table/BulkActionBar";
import { exportToExcel } from "../components/ui/data-table/exportToExcel";
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

const PAGE_SIZE = 10;

interface SiteForm {
  name: string;
  shortCode: string;
  location: string;
}

const emptyForm: SiteForm = { name: "", shortCode: "", location: "" };

export default function SitesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [form, setForm] = useState<SiteForm>(emptyForm);

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ["sites"],
    queryFn: () => api.get<{ data: Site[] }>("/sites").then((r) => r.data.data),
  });

  const { sorted, sortKey, sortDir, toggleSort } = useClientSort<Site>(sites, "name");

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pagedSites = useMemo(
    () => sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [sorted, page],
  );

  const selection = useRowSelection(pagedSites.map((s) => s.id));

  const bulkStatusMutation = useMutation({
    mutationFn: (active: boolean) =>
      api.post<{ results: Array<{ id: string; status: string; error?: string }> }>(
        "/sites/bulk-status",
        { ids: [...selection.selectedIds], active },
      ),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["sites"] });
      const failed = res.data.results.filter((r) => r.status === "error");
      selection.clear();
      toast({
        title: failed.length ? `${res.data.results.length - failed.length} traité(s), ${failed.length} échec(s)` : "Statut mis à jour",
        description: failed[0]?.error,
        variant: failed.length ? "destructive" : undefined,
      });
    },
  });

  function handleExport() {
    const rows =
      selection.selectedCount > 0 ? sorted.filter((s) => selection.isSelected(s.id)) : sorted;
    void exportToExcel(
      rows,
      [
        { header: "Nom", accessor: (s) => s.name },
        { header: "Code", accessor: (s) => s.shortCode },
        { header: "Localisation", accessor: (s) => s.location ?? "" },
        { header: "Statut", accessor: (s) => (s.active ? "Actif" : "Inactif") },
      ],
      "sites",
    );
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        shortCode: form.shortCode.trim().toUpperCase(),
        location: form.location.trim() || undefined,
      };
      if (editing) {
        return api.patch<Site>(`/sites/${editing.id}`, {
          name: payload.name,
          location: payload.location ?? null,
        });
      }
      return api.post<Site>("/sites", payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sites"] });
      setDialogOpen(false);
      toast({ title: editing ? "Site mis à jour" : "Site créé" });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Échec", description: String(message), variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (site: Site) => api.delete<Site>(`/sites/${site.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sites"] });
      toast({ title: "Site désactivé" });
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(site: Site) {
    setEditing(site);
    setForm({
      name: site.name,
      shortCode: site.shortCode,
      location: site.location ?? "",
    });
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sites"
        description="Référentiel des sites ALTERRA."
        action={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" aria-hidden />
              Exporter
            </Button>
            <Button type="button" onClick={openCreate}>
              Nouveau site
            </Button>
          </div>
        }
      />

      <BulkActionBar count={selection.selectedCount} onClear={selection.clear}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={bulkStatusMutation.isPending}
          onClick={() => bulkStatusMutation.mutate(true)}
        >
          <Power className="h-3.5 w-3.5" aria-hidden />
          Activer
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={bulkStatusMutation.isPending}
          onClick={() => bulkStatusMutation.mutate(false)}
        >
          <PowerOff className="h-3.5 w-3.5" aria-hidden />
          Désactiver
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
              <SortableHead sortKey="name" label="Nom" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableHead sortKey="shortCode" label="Code" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableHead sortKey="location" label="Localisation" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableHead sortKey="active" label="Statut" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <TableHead className="w-40">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-zinc-500">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              pagedSites.map((site) => (
                <TableRow key={site.id} data-state={selection.isSelected(site.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selection.isSelected(site.id)}
                      onChange={() => selection.toggle(site.id)}
                      aria-label={`Sélectionner ${site.name}`}
                    />
                  </TableCell>
                  <TableCell>{site.name}</TableCell>
                  <TableCell>{site.shortCode}</TableCell>
                  <TableCell>{site.location ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={site.active ? "success" : "danger"}>
                      {site.active ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <RowActions>
                      <IconButton
                        icon={Pencil}
                        label="Modifier"
                        variant="brand"
                        onClick={() => openEdit(site)}
                      />
                      {site.active && (
                        <IconButton
                          icon={Power}
                          label="Désactiver"
                          variant="destructive"
                          onClick={() => deactivateMutation.mutate(site)}
                        />
                      )}
                    </RowActions>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Précédent
          </Button>
          <span className="text-sm text-zinc-500">
            Page {page + 1} / {pageCount}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Suivant
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier le site" : "Nouveau site"}</DialogTitle>
            <DialogDescription>
              Code site : 2 à 3 lettres majuscules (ex. MNK).
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="site-name">Nom</Label>
              <Input
                id="site-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-code">Code</Label>
              <Input
                id="site-code"
                value={form.shortCode}
                onChange={(e) => setForm((f) => ({ ...f, shortCode: e.target.value.toUpperCase() }))}
                disabled={!!editing}
                pattern="[A-Z]{2,3}"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-location">Localisation</Label>
              <Input
                id="site-location"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
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
    </div>
  );
}
