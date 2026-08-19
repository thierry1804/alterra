import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../lib/api";
import type { Site } from "../lib/referentials";
import PageHeader from "../components/shared/PageHeader";
import { Pencil, Power } from "lucide-react";
import { Button } from "../components/ui/button";
import { IconButton, RowActions } from "../components/ui/IconButton";
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

  const pageCount = Math.max(1, Math.ceil(sites.length / PAGE_SIZE));
  const pagedSites = useMemo(
    () => sites.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [sites, page],
  );

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
          <Button type="button" onClick={openCreate}>
            Nouveau site
          </Button>
        }
      />

      <div className="rounded-lg border border-zinc-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Code</TableHead>
              <TableHead>Localisation</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-40">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-zinc-500">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              pagedSites.map((site) => (
                <TableRow key={site.id}>
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
