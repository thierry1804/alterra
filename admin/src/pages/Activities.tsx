import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../lib/api";
import type { Activity, Site } from "../lib/referentials";
import { formatDate, formatRate } from "../lib/referentials";
import PageHeader from "../components/shared/PageHeader";
import RateHistoryDrawer from "../components/activities/RateHistoryDrawer";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
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
  unitRate: string;
  siteId: string;
}

const emptyForm: ActivityForm = { label: "", unit: "", unitRate: "", siteId: "" };

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

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        label: form.label.trim(),
        unit: form.unit.trim(),
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
          <Button type="button" onClick={openCreate}>
            Nouvelle activité
          </Button>
        }
      />

      <div className="rounded-lg border border-zinc-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Libellé</TableHead>
              <TableHead>Unité</TableHead>
              <TableHead>Tarif</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Depuis</TableHead>
              <TableHead className="w-52">Actions</TableHead>
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
              activities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell>{activity.label}</TableCell>
                  <TableCell>{activity.unit}</TableCell>
                  <TableCell>{formatRate(activity.unitRate)}</TableCell>
                  <TableCell>{siteName(activity.siteId)}</TableCell>
                  <TableCell>{formatDate(activity.validFrom)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => openEdit(activity)}>
                        Modifier
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setHistoryLabel(activity.label)}
                      >
                        Historique
                      </Button>
                      {activity.active && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => deactivateMutation.mutate(activity)}
                        >
                          Désactiver
                        </Button>
                      )}
                    </div>
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
