import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../lib/api";
import type { Site } from "../lib/referentials";
import { geoPolygonCenter, type GeoPolygon, type Parcelle, type Zone } from "../lib/geo";
import PageHeader from "../components/shared/PageHeader";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { IconButton, RowActions } from "../components/ui/IconButton";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import PolygonDrawMap from "../components/map/PolygonDrawMap";
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

const DEFAULT_MAP_CENTER: [number, number] = [-18.91, 47.52];

type DeleteConfirm =
  | { type: "zone"; id: string; name: string }
  | { type: "parcel"; id: string; name: string };

type DialogMode = "zone-create" | "zone-edit" | "parcel-create" | "parcel-edit";

interface ZoneForm {
  name: string;
  code: string;
  geoPolygon: GeoPolygon | null;
}

interface ParcelForm {
  name: string;
  code: string;
  surfaceHa: string;
  geoPolygon: GeoPolygon | null;
}

const emptyZoneForm: ZoneForm = { name: "", code: "", geoPolygon: null };
const emptyParcelForm: ParcelForm = { name: "", code: "", surfaceHa: "", geoPolygon: null };

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

  const selectedSite = sites.find((s) => s.id === effectiveSiteId);
  const mapCenter: [number, number] =
    selectedSite?.geoLat != null && selectedSite?.geoLng != null
      ? [selectedSite.geoLat, selectedSite.geoLng]
      : DEFAULT_MAP_CENTER;

  const parentZone = zones.find((z) => z.id === parentZoneId);
  const parcelMapCenter = geoPolygonCenter(parentZone?.geoPolygon ?? null) ?? mapCenter;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (dialogMode === "zone-create" || dialogMode === "zone-edit") {
        const payload = {
          name: zoneForm.name.trim(),
          code: zoneForm.code.trim() || null,
          geoPolygon: zoneForm.geoPolygon,
        };
        if (dialogMode === "zone-edit" && editingZone) {
          return api.patch(`/zones/${editingZone.id}`, payload);
        }
        return api.post("/zones", { ...payload, siteId: effectiveSiteId });
      }

      const surfaceHa = parcelForm.surfaceHa.trim()
        ? Number(parcelForm.surfaceHa)
        : undefined;
      const payload = {
        name: parcelForm.name.trim(),
        code: parcelForm.code.trim() || null,
        surfaceHa,
        geoPolygon: parcelForm.geoPolygon,
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
      code: zone.code ?? "",
      geoPolygon: zone.geoPolygon,
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
      code: parcel.code ?? "",
      surfaceHa: parcel.surfaceHa ?? "",
      geoPolygon: parcel.geoPolygon,
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
              <TableHead>Code</TableHead>
              <TableHead>Surface</TableHead>
              <TableHead>GeoJSON</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-sm text-zinc-500">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && zones.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-sm text-zinc-500">
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
                    <TableCell>{zone.code ?? "—"}</TableCell>
                    <TableCell>
                      {totalHa > 0 ? `${totalHa.toLocaleString("fr-MG")} ha` : "—"}
                    </TableCell>
                    <TableCell>{zone.geoPolygon ? "Polygon" : "—"}</TableCell>
                    <TableCell className="text-right">
                      <RowActions>
                        <IconButton
                          icon={Plus}
                          label="Ajouter une parcelle"
                          onClick={() => openParcelCreate(zone.id)}
                        />
                        <IconButton
                          icon={Pencil}
                          label="Modifier la zone"
                          variant="brand"
                          onClick={() => openZoneEdit(zone)}
                        />
                        <IconButton
                          icon={Trash2}
                          label="Supprimer la zone"
                          variant="destructive"
                          onClick={() =>
                            setDeleteConfirm({ type: "zone", id: zone.id, name: zone.name })
                          }
                        />
                      </RowActions>
                    </TableCell>
                  </TableRow>
                  {expanded &&
                    zoneParcels.map((parcel) => (
                      <TableRow key={parcel.id}>
                        <TableCell className="pl-10 text-zinc-700">{parcel.name}</TableCell>
                        <TableCell>{parcel.code ?? "—"}</TableCell>
                        <TableCell>
                          {parcel.surfaceHa
                            ? `${Number(parcel.surfaceHa).toLocaleString("fr-MG")} ha`
                            : "—"}
                        </TableCell>
                        <TableCell>{parcel.geoPolygon ? "Polygon" : "—"}</TableCell>
                        <TableCell className="text-right">
                          <RowActions>
                            <IconButton
                              icon={Pencil}
                              label="Modifier la parcelle"
                              variant="brand"
                              onClick={() => openParcelEdit(parcel)}
                            />
                            <IconButton
                              icon={Trash2}
                              label="Supprimer la parcelle"
                              variant="destructive"
                              onClick={() =>
                                setDeleteConfirm({
                                  type: "parcel",
                                  id: parcel.id,
                                  name: parcel.name,
                                })
                              }
                            />
                          </RowActions>
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
              Dessinez le polygone sur la carte, puis nommez et attribuez un code.
            </DialogDescription>
          </DialogHeader>

          {(dialogMode === "zone-create" || dialogMode === "zone-edit") && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="zone-name">Nom de la zone</Label>
                  <Input
                    id="zone-name"
                    value={zoneForm.name}
                    onChange={(e) => setZoneForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zone-code">Code (unique par site)</Label>
                  <Input
                    id="zone-code"
                    value={zoneForm.code}
                    onChange={(e) => setZoneForm((f) => ({ ...f, code: e.target.value }))}
                    maxLength={20}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Polygone</Label>
                <PolygonDrawMap
                  key={`zone-${editingZone?.id ?? "new"}`}
                  value={zoneForm.geoPolygon}
                  onChange={(geoPolygon) => setZoneForm((f) => ({ ...f, geoPolygon }))}
                  center={mapCenter}
                />
                <p className="text-xs text-zinc-500">
                  Icône polygone pour dessiner (clic sommet par sommet, terminer sur le premier
                  point). Poignées pour éditer, icône poubelle pour effacer.
                </p>
              </div>
            </div>
          )}

          {(dialogMode === "parcel-create" || dialogMode === "parcel-edit") && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="parcel-name">Nom de la parcelle</Label>
                  <Input
                    id="parcel-name"
                    value={parcelForm.name}
                    onChange={(e) => setParcelForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="parcel-code">Code (unique par zone)</Label>
                  <Input
                    id="parcel-code"
                    value={parcelForm.code}
                    onChange={(e) => setParcelForm((f) => ({ ...f, code: e.target.value }))}
                    maxLength={20}
                  />
                </div>
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
                <Label>Polygone</Label>
                <PolygonDrawMap
                  key={`parcel-${editingParcel?.id ?? "new"}`}
                  value={parcelForm.geoPolygon}
                  onChange={(geoPolygon) => setParcelForm((f) => ({ ...f, geoPolygon }))}
                  center={parcelMapCenter}
                />
                <p className="text-xs text-zinc-500">
                  Icône polygone pour dessiner (clic sommet par sommet, terminer sur le premier
                  point). Poignées pour éditer, icône poubelle pour effacer.
                </p>
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
