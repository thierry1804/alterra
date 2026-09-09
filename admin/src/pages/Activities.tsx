import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../lib/api";
import type { Activity, Site } from "../lib/referentials";
import { formatDate, formatRate } from "../lib/referentials";
import PageHeader from "../components/shared/PageHeader";
import RateHistoryDrawer from "../components/activities/RateHistoryDrawer";
import { Pencil, History, Power, Download } from "lucide-react";
import { Button } from "../components/ui/button";
import { IconButton, RowActions } from "../components/ui/IconButton";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
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

interface ActivityForm {
  label: string;
  unit: string;
  code: string;
  unitRate: string;
  siteId: string;
}

const emptyForm: ActivityForm = { label: "", unit: "", code: "", unitRate: "", siteId: "" };

export default function ActivitiesPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyLabel, setHistoryLabel] = useState<string | null>(null);
  const [editing, setEditing] = useState<Activity | null>(null);
  const [form, setForm] = useState<ActivityForm>(emptyForm);

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: () => api.get<{ data: Activity[] }>("/activities").then((r) => r.data.data),
  });

  const { data: sites = [] } = useQuery({
    queryKey: ["sites"],
    queryFn: () => api.get<{ data: Site[] }>("/sites").then((r) => r.data.data),
  });

  const siteName = (siteId: string | null) =>
    siteId ? sites.find((s) => s.id === siteId)?.shortCode ?? siteId : "Global";

  const { sorted, sortKey, sortDir, toggleSort } = useClientSort<Activity>(activities, "label", {
    unitRate: (a) => Number(a.unitRate),
    siteId: (a) => siteName(a.siteId),
  });
  const selection = useRowSelection(sorted.map((a) => a.id));

  const bulkDeactivateMutation = useMutation({
    mutationFn: () =>
      api.post<{ results: Array<{ id: string; status: string; error?: string }> }>(
        "/activities/bulk-deactivate",
        { ids: [...selection.selectedIds] },
      ),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["activities"] });
      const failed = res.data.results.filter((r) => r.status === "error");
      selection.clear();
      toast({
        title: failed.length
          ? `${res.data.results.length - failed.length} désactivée(s), ${failed.length} échec(s)`
          : "Activités désactivées",
        description: failed[0]?.error,
        variant: failed.length ? "destructive" : undefined,
      });
    },
  });

  function handleExport() {
    const rows =
      selection.selectedCount > 0 ? sorted.filter((a) => selection.isSelected(a.id)) : sorted;
    void exportToExcel(
      rows,
      [
        { header: "Libellé", accessor: (a) => a.label },
        { header: "Code", accessor: (a) => a.code ?? "" },
        { header: "Unité", accessor: (a) => a.unit },
        { header: "Tarif (Ar)", accessor: (a) => Number(a.unitRate) },
        { header: "Site", accessor: (a) => siteName(a.siteId) },
        { header: "Depuis", accessor: (a) => formatDate(a.validFrom) },
        { header: "Statut", accessor: (a) => (a.active ? "Actif" : "Inactif") },
      ],
      "activites",
    );
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        label: form.label.trim(),
        unit: form.unit.trim(),
        code: form.code.trim() || null,
        unitRate: Number(form.unitRate),
        siteId: form.siteId || null,
      };
      if (editing) {
        return api.patch<Activity>(`/activities/${editing.id}`, payload);
      }
      return api.post<Activity>("/activities", payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["activities"] });
      setDialogOpen(false);
      toast({ title: editing ? "Activité mise à jour" : "Activité créée" });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Échec", description: String(message), variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (activity: Activity) => api.delete<Activity>(`/activities/${activity.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast({ title: "Activité désactivée" });
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(activity: Activity) {
    setEditing(activity);
    setForm({
      label: activity.label,
      unit: activity.unit,
      code: activity.code ?? "",
      unitRate: activity.unitRate,
      siteId: activity.siteId ?? "",
    });
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activités"
        description="Tâches et tarifs unitaires."
        action={
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" aria-hidden />
              Exporter
            </Button>
            <Button type="button" onClick={openCreate}>
              Nouvelle activité
            </Button>
          </div>
        }
      />

      <BulkActionBar count={selection.selectedCount} onClear={selection.clear}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={bulkDeactivateMutation.isPending}
          onClick={() => bulkDeactivateMutation.mutate()}
        >
          <Power className="h-3.5 w-3.5" aria-hidden />
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
              <SortableHead sortKey="label" label="Libellé" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableHead sortKey="code" label="Code" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableHead sortKey="unit" label="Unité" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableHead sortKey="unitRate" label="Tarif" numeric currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableHead sortKey="siteId" label="Site" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableHead sortKey="validFrom" label="Depuis" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <TableHead className="w-52">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-zinc-500">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              sorted.map((activity) => (
                <TableRow key={activity.id} data-state={selection.isSelected(activity.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selection.isSelected(activity.id)}
                      onChange={() => selection.toggle(activity.id)}
                      aria-label={`Sélectionner ${activity.label}`}
                    />
                  </TableCell>
                  <TableCell>{activity.label}</TableCell>
                  <TableCell>{activity.code ?? "—"}</TableCell>
                  <TableCell>{activity.unit}</TableCell>
                  <TableCell>{formatRate(activity.unitRate)}</TableCell>
                  <TableCell>{siteName(activity.siteId)}</TableCell>
                  <TableCell>{formatDate(activity.validFrom)}</TableCell>
                  <TableCell>
                    <RowActions>
                      <IconButton
                        icon={Pencil}
                        label="Modifier"
                        variant="brand"
                        onClick={() => openEdit(activity)}
                      />
                      <IconButton
                        icon={History}
                        label="Historique des tarifs"
                        onClick={() => setHistoryLabel(activity.label)}
                      />
                      {activity.active && (
                        <IconButton
                          icon={Power}
                          label="Désactiver"
                          variant="destructive"
                          onClick={() => deactivateMutation.mutate(activity)}
                        />
                      )}
                    </RowActions>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <RateHistoryDrawer
        label={historyLabel}
        open={!!historyLabel}
        onOpenChange={(open) => {
          if (!open) setHistoryLabel(null);
        }}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier l'activité" : "Nouvelle activité"}</DialogTitle>
            <DialogDescription>
              Un changement de tarif crée une nouvelle version (RG-04).
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
              <Label htmlFor="act-label">Libellé</Label>
              <Input
                id="act-label"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="act-unit">Unité</Label>
                <Input
                  id="act-unit"
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="act-rate">Tarif (Ar)</Label>
                <Input
                  id="act-rate"
                  type="number"
                  min="1"
                  step="1"
                  value={form.unitRate}
                  onChange={(e) => setForm((f) => ({ ...f, unitRate: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-code">Code (ex. ACT04, unique par site)</Label>
              <Input
                id="act-code"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                maxLength={20}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-site">Site (vide = global)</Label>
              <select
                id="act-site"
                className="flex h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
                value={form.siteId}
                onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}
              >
                <option value="">Global</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name} ({site.shortCode})
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
    </div>
  );
}
