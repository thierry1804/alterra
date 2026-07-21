import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../lib/api";
import type { Site } from "../lib/referentials";
import {
  EXAMPLE_GEO_POLYGON,
  type GeoPolygon,
  type Parcelle,
  type Zone,
} from "../lib/geo";
import PageHeader from "../components/shared/PageHeader";
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
import ConfirmDialog from "../components/ui/ConfirmDialog";

type DeleteConfirm =
  | { type: "zone"; id: string; name: string }
  | { type: "parcel"; id: string; name: string };

type DialogMode = "zone-create" | "zone-edit" | "parcel-create" | "parcel-edit";

interface ZoneForm {
  name: string;
  geoPolygonText: string;
}

interface ParcelForm {
  name: string;
  surfaceHa: string;
  geoPolygonText: string;
}

const emptyZoneForm: ZoneForm = { name: "", geoPolygonText: "" };
const emptyParcelForm: ParcelForm = { name: "", surfaceHa: "", geoPolygonText: "" };

function parseGeoText(text: string): GeoPolygon | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const parsed = JSON.parse(trimmed) as GeoPolygon;
  if (parsed.type !== "Polygon" || !Array.isArray(parsed.coordinates)) {
    throw new Error("GeoJSON Polygon invalide");
  }
  return parsed;
}

export default function ZonesPage() {
  const queryClient = useQueryClient();
  const [siteId, setSiteId] = useState("");
  const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>("zone-create");
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [editingParcel, setEditingParcel] = useState<Parcelle | null>(null);
  const [parentZoneId, setParentZoneId] = useState<string | null>(null);
  const [zoneForm, setZoneForm] = useState<ZoneForm>(emptyZoneForm);
  const [parcelForm, setParcelForm] = useState<ParcelForm>(emptyParcelForm);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);

  const { data: sites = [] } = useQuery({
    queryKey: ["sites"],
    queryFn: () => api.get<{ data: Site[] }>("/sites").then((r) => r.data.data),
  });

  const effectiveSiteId = siteId || sites[0]?.id || "";

  const { data: zones = [], isLoading } = useQuery({
    queryKey: ["zones", effectiveSiteId],
    queryFn: () =>
      api
        .get<{ data: Zone[] }>("/zones", { params: { siteId: effectiveSiteId } })
        .then((r) => r.data.data),
    enabled: !!effectiveSiteId,
  });

  const { data: parcelles = [] } = useQuery({
    queryKey: ["parcels", effectiveSiteId],
    queryFn: () =>
      api
        .get<{ data: Parcelle[] }>("/parcels", { params: { siteId: effectiveSiteId } })
        .then((r) => r.data.data),
    enabled: !!effectiveSiteId,
  });

  const parcelsByZone = useMemo(() => {
    const map = new Map<string, Parcelle[]>();
    parcelles.forEach((p) => {
      const list = map.get(p.zoneId) ?? [];
      list.push(p);
      map.set(p.zoneId, list);
    });
    return map;
  }, [parcelles]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (dialogMode === "zone-create" || dialogMode === "zone-edit") {
        const geoPolygon = parseGeoText(zoneForm.geoPolygonText);
        const payload = { name: zoneForm.name.trim(), geoPolygon };
        if (dialogMode === "zone-edit" && editingZone) {
          return api.patch(`/zones/${editingZone.id}`, payload);
        }
        return api.post("/zones", { ...payload, siteId: effectiveSiteId });
      }

      const geoPolygon = parseGeoText(parcelForm.geoPolygonText);
      const surfaceHa = parcelForm.surfaceHa.trim()
        ? Number(parcelForm.surfaceHa)
        : undefined;
      const payload = {
        name: parcelForm.name.trim(),
        surfaceHa,
        geoPolygon,
      };
      if (dialogMode === "parcel-edit" && editingParcel) {
        return api.patch(`/parcels/${editingParcel.id}`, {
          ...payload,
          surfaceHa: surfaceHa ?? null,
        });
      }
      return api.post("/parcels", { ...payload, zoneId: parentZoneId });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["zones"] });
      void queryClient.invalidateQueries({ queryKey: ["parcels"] });
      setDialogOpen(false);
      toast({ title: "Enregistré" });
    },
    onError: (err) => {
      const message = isAxiosError(err)
        ? err.response?.data?.message
        : err instanceof Error
          ? err.message
          : "Erreur";
      toast({ title: "Échec", description: String(message), variant: "destructive" });
    },
  });

  const deleteZoneMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/zones/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["zones"] });
      toast({ title: "Zone supprimée" });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Suppression impossible", description: String(message), variant: "destructive" });
    },
  });

  const deleteParcelMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/parcels/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["parcels"] });
      toast({ title: "Parcelle supprimée" });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Suppression impossible", description: String(message), variant: "destructive" });
    },
  });

  function handleDeleteConfirm() {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === "zone") {
      deleteZoneMutation.mutate(deleteConfirm.id, {
        onSuccess: () => setDeleteConfirm(null),
      });
      return;
    }
    deleteParcelMutation.mutate(deleteConfirm.id, {
      onSuccess: () => setDeleteConfirm(null),
    });
  }

  function openZoneCreate() {
    setDialogMode("zone-create");
    setEditingZone(null);
    setZoneForm(emptyZoneForm);
    setDialogOpen(true);
  }

  function openZoneEdit(zone: Zone) {
    setDialogMode("zone-edit");
    setEditingZone(zone);
    setZoneForm({
      name: zone.name,
      geoPolygonText: zone.geoPolygon ? JSON.stringify(zone.geoPolygon, null, 2) : "",
    });
    setDialogOpen(true);
  }

  function openParcelCreate(zoneId: string) {
    setDialogMode("parcel-create");
    setParentZoneId(zoneId);
    setEditingParcel(null);
    setParcelForm(emptyParcelForm);
    setDialogOpen(true);
  }

  function openParcelEdit(parcel: Parcelle) {
    setDialogMode("parcel-edit");
    setEditingParcel(parcel);
    setParentZoneId(parcel.zoneId);
    setParcelForm({
      name: parcel.name,
      surfaceHa: parcel.surfaceHa ?? "",
      geoPolygonText: parcel.geoPolygon ? JSON.stringify(parcel.geoPolygon, null, 2) : "",
    });
    setDialogOpen(true);
  }

  function toggleZone(id: string) {
    setExpandedZones((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const dialogTitle =
    dialogMode === "zone-create"
      ? "Nouvelle zone"
      : dialogMode === "zone-edit"
        ? "Modifier la zone"
        : dialogMode === "parcel-create"
          ? "Nouvelle parcelle"
          : "Modifier la parcelle";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Zones & parcelles"
        description="Hiérarchie géographique Site → Zone → Parcelle (GeoJSON)."
        action={
          <Button type="button" onClick={openZoneCreate} disabled={!effectiveSiteId}>
            Nouvelle zone
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 p-4">
        <div className="space-y-2">
          <Label htmlFor="zone-site">Site</Label>
          <select
            id="zone-site"
            value={effectiveSiteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="w-48 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name} ({site.shortCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Surface</TableHead>
              <TableHead>GeoJSON</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-sm text-zinc-500">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && zones.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-sm text-zinc-500">
                  Aucune zone pour ce site.
                </TableCell>
              </TableRow>
            )}
            {zones.map((zone) => {
              const zoneParcels = parcelsByZone.get(zone.id) ?? [];
              const expanded = expandedZones.has(zone.id);
              const totalHa = zoneParcels.reduce(
                (sum, p) => sum + Number(p.surfaceHa ?? 0),
                0,
              );
              return (
                <Fragment key={zone.id}>
                  <TableRow className="bg-zinc-50/80">
                    <TableCell>
                      <button
                        type="button"
                        className="mr-2 text-zinc-500"
                        onClick={() => toggleZone(zone.id)}
                      >
                        {expanded ? "▼" : "▶"}
                      </button>
                      <span className="font-medium">{zone.name}</span>
                    </TableCell>
                    <TableCell>
                      {totalHa > 0 ? `${totalHa.toLocaleString("fr-MG")} ha` : "—"}
                    </TableCell>
                    <TableCell>{zone.geoPolygon ? "Polygon" : "—"}</TableCell>
                    <TableCell className="space-x-2 text-right">
                      <Button type="button" variant="outline" size="sm" onClick={() => openParcelCreate(zone.id)}>
                        + Parcelle
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => openZoneEdit(zone)}>
                        Modifier
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDeleteConfirm({ type: "zone", id: zone.id, name: zone.name })
                        }
                      >
                        Supprimer
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expanded &&
                    zoneParcels.map((parcel) => (
                      <TableRow key={parcel.id}>
                        <TableCell className="pl-10 text-zinc-700">{parcel.name}</TableCell>
                        <TableCell>
                          {parcel.surfaceHa
                            ? `${Number(parcel.surfaceHa).toLocaleString("fr-MG")} ha`
                            : "—"}
                        </TableCell>
                        <TableCell>{parcel.geoPolygon ? "Polygon" : "—"}</TableCell>
                        <TableCell className="space-x-2 text-right">
                          <Button type="button" variant="outline" size="sm" onClick={() => openParcelEdit(parcel)}>
                            Modifier
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteConfirm({
                                type: "parcel",
                                id: parcel.id,
                                name: parcel.name,
                              })
                            }
                          >
                            Supprimer
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>
              Polygone au format GeoJSON. Laisser vide si non défini.
            </DialogDescription>
          </DialogHeader>

          {(dialogMode === "zone-create" || dialogMode === "zone-edit") && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="zone-name">Nom de la zone</Label>
                <Input
                  id="zone-name"
                  value={zoneForm.name}
                  onChange={(e) => setZoneForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="zone-geo">GeoJSON Polygon</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setZoneForm((f) => ({ ...f, geoPolygonText: EXAMPLE_GEO_POLYGON }))
                    }
                  >
                    Exemple
                  </Button>
                </div>
                <textarea
                  id="zone-geo"
                  rows={6}
                  value={zoneForm.geoPolygonText}
                  onChange={(e) => setZoneForm((f) => ({ ...f, geoPolygonText: e.target.value }))}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs"
                />
              </div>
            </div>
          )}

          {(dialogMode === "parcel-create" || dialogMode === "parcel-edit") && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="parcel-name">Nom de la parcelle</Label>
                <Input
                  id="parcel-name"
                  value={parcelForm.name}
                  onChange={(e) => setParcelForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parcel-surface">Surface (ha)</Label>
                <Input
                  id="parcel-surface"
                  type="number"
                  min="0"
                  step="0.01"
                  value={parcelForm.surfaceHa}
                  onChange={(e) => setParcelForm((f) => ({ ...f, surfaceHa: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="parcel-geo">GeoJSON Polygon</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setParcelForm((f) => ({ ...f, geoPolygonText: EXAMPLE_GEO_POLYGON }))
                    }
                  >
                    Exemple
                  </Button>
                </div>
                <textarea
                  id="parcel-geo"
                  rows={6}
                  value={parcelForm.geoPolygonText}
                  onChange={(e) =>
                    setParcelForm((f) => ({ ...f, geoPolygonText: e.target.value }))
                  }
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 font-mono text-xs"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              type="button"
              disabled={saveMutation.isPending}
              onClick={() => void saveMutation.mutate()}
            >
              {saveMutation.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirm !== null}
        title={
          deleteConfirm?.type === "zone"
            ? "Supprimer la zone ?"
            : "Supprimer la parcelle ?"
        }
        description={
          deleteConfirm
            ? `« ${deleteConfirm.name} » sera définitivement supprimée. Cette action est irréversible.`
            : ""
        }
        confirmLabel="Supprimer"
        destructive
        busy={deleteZoneMutation.isPending || deleteParcelMutation.isPending}
        onConfirm={handleDeleteConfirm}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirm(null);
        }}
      />
    </div>
  );
}
