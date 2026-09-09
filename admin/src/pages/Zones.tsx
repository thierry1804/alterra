import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { api } from "../lib/api";
import type { Site } from "../lib/referentials";
import { geoPolygonCenter, type GeoPolygon, type Parcelle, type Zone } from "../lib/geo";
import PageHeader from "../components/shared/PageHeader";
import { Plus, Pencil, Trash2, Download } from "lucide-react";
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

  const { sorted: sortedZones, sortKey, sortDir, toggleSort } = useClientSort<Zone>(zones, "name");
  const zoneSelection = useRowSelection(sortedZones.map((z) => z.id));
  const parcelSelection = useRowSelection(parcelles.map((p) => p.id));

  const bulkDeleteZonesMutation = useMutation({
    mutationFn: () =>
      api.post<{ results: Array<{ id: string; status: string; error?: string }> }>(
        "/zones/bulk-delete",
        { ids: [...zoneSelection.selectedIds] },
      ),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["zones"] });
      const failed = res.data.results.filter((r) => r.status === "error");
      zoneSelection.clear();
      toast({
        title: failed.length
          ? `${res.data.results.length - failed.length} supprimée(s), ${failed.length} échec(s)`
          : "Zones supprimées",
        description: failed[0]?.error,
        variant: failed.length ? "destructive" : undefined,
      });
    },
  });

  const bulkDeleteParcelsMutation = useMutation({
    mutationFn: () =>
      api.post<{ results: Array<{ id: string; status: string; error?: string }> }>(
        "/parcels/bulk-delete",
        { ids: [...parcelSelection.selectedIds] },
      ),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ["parcels"] });
      const failed = res.data.results.filter((r) => r.status === "error");
      parcelSelection.clear();
      toast({
        title: failed.length
          ? `${res.data.results.length - failed.length} supprimée(s), ${failed.length} échec(s)`
          : "Parcelles supprimées",
        description: failed[0]?.error,
        variant: failed.length ? "destructive" : undefined,
      });
    },
  });

  function handleExport() {
    const rows: Array<{ type: string; name: string; code: string; surface: string }> = [];
    sortedZones.forEach((zone) => {
      rows.push({ type: "Zone", name: zone.name, code: zone.code ?? "", surface: "" });
      (parcelsByZone.get(zone.id) ?? []).forEach((p) => {
        rows.push({
          type: "Parcelle",
          name: p.name,
          code: p.code ?? "",
          surface: p.surfaceHa ?? "",
        });
      });
    });
    void exportToExcel(
      rows,
      [
        { header: "Type", accessor: (r) => r.type },
        { header: "Nom", accessor: (r) => r.name },
        { header: "Code", accessor: (r) => r.code },
        { header: "Surface (ha)", accessor: (r) => r.surface },
      ],
      "zones-parcelles",
    );
  }

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
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4" aria-hidden />
              Exporter
            </Button>
            <Button type="button" onClick={openZoneCreate} disabled={!effectiveSiteId}>
              Nouvelle zone
            </Button>
          </div>
        }
      />

      {zoneSelection.selectedCount > 0 && (
        <BulkActionBar count={zoneSelection.selectedCount} onClear={zoneSelection.clear}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={bulkDeleteZonesMutation.isPending}
            onClick={() => bulkDeleteZonesMutation.mutate()}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Supprimer les zones
          </Button>
        </BulkActionBar>
      )}
      {parcelSelection.selectedCount > 0 && (
        <BulkActionBar count={parcelSelection.selectedCount} onClear={parcelSelection.clear}>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={bulkDeleteParcelsMutation.isPending}
            onClick={() => bulkDeleteParcelsMutation.mutate()}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Supprimer les parcelles
          </Button>
        </BulkActionBar>
      )}

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
              <TableHead className="w-9">
                <Checkbox
                  checked={
                    zoneSelection.allVisibleSelected
                      ? true
                      : zoneSelection.someVisibleSelected
                        ? "indeterminate"
                        : false
                  }
                  onChange={zoneSelection.toggleAllVisible}
                  aria-label="Tout sélectionner"
                />
              </TableHead>
              <SortableHead sortKey="name" label="Nom" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <SortableHead sortKey="code" label="Code" currentKey={sortKey} currentDir={sortDir} onSort={toggleSort} />
              <TableHead>Surface</TableHead>
              <TableHead>GeoJSON</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-zinc-500">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && zones.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-sm text-zinc-500">
                  Aucune zone pour ce site.
                </TableCell>
              </TableRow>
            )}
            {sortedZones.map((zone) => {
              const zoneParcels = parcelsByZone.get(zone.id) ?? [];
              const expanded = expandedZones.has(zone.id);
              const totalHa = zoneParcels.reduce(
                (sum, p) => sum + Number(p.surfaceHa ?? 0),
                0,
              );
              return (
                <Fragment key={zone.id}>
                  <TableRow className="bg-zinc-50/80" data-state={zoneSelection.isSelected(zone.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={zoneSelection.isSelected(zone.id)}
                        onChange={() => zoneSelection.toggle(zone.id)}
                        aria-label={`Sélectionner ${zone.name}`}
                      />
                    </TableCell>
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
                      <TableRow key={parcel.id} data-state={parcelSelection.isSelected(parcel.id) ? "selected" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={parcelSelection.isSelected(parcel.id)}
                            onChange={() => parcelSelection.toggle(parcel.id)}
                            aria-label={`Sélectionner ${parcel.name}`}
                          />
                        </TableCell>
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
