import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { isAxiosError } from "axios";
import { History, Power, Plus } from "lucide-react";
import { api } from "../../lib/api";
import type { ActivitySubActivity, Site } from "../../lib/referentials";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../ui/table";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { IconButton, RowActions } from "../ui/IconButton";
import { Combobox } from "../ui/combobox";
import { toast } from "../../hooks/use-toast";
import { fetchAllCursorPages } from "../ui/data-table/fetchAllPages";

export interface SubActivityGroupSummary {
  groupKey: string;
  categoryId: string;
  label: string;
  shortLabel: string;
  unitId: string;
}

interface SubActivitySitesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: SubActivityGroupSummary | null;
  sites: Site[];
  onHistory: (siteId: string | null) => void;
}

function RateEditor({
  value,
  onSave,
  saving,
}: {
  value: string;
  onSave: (rate: number) => void;
  saving: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value && draft.trim() !== "" && Number(draft) > 0;

  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min="1"
        step="1"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-8 w-28"
      />
      {dirty && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={saving}
          onClick={() => onSave(Number(draft))}
        >
          Enregistrer
        </Button>
      )}
    </div>
  );
}

export default function SubActivitySitesModal({
  open,
  onOpenChange,
  group,
  sites,
  onHistory,
}: SubActivitySitesModalProps) {
  const queryClient = useQueryClient();
  const [newSiteId, setNewSiteId] = useState("");
  const [newRate, setNewRate] = useState("");

  const groupKey = group?.groupKey ?? null;

  const rowsQuery = useQuery({
    queryKey: ["sub-activities", "group", groupKey],
    enabled: open && !!groupKey,
    queryFn: () =>
      fetchAllCursorPages<ActivitySubActivity>((cursor) =>
        api
          .get<{ data: ActivitySubActivity[]; nextCursor: string | null; hasMore: boolean }>(
            "/sub-activities",
            { params: { groupKey, cursor, take: 100 } },
          )
          .then((r) => r.data),
      ),
  });

  const rows = rowsQuery.data ?? [];
  const globalRow = rows.find((r) => r.siteId === null);
  const siteRows = rows
    .filter((r) => r.siteId !== null)
    .sort((a, b) => (siteName(a.siteId) ?? "").localeCompare(siteName(b.siteId) ?? ""));
  const overriddenSiteIds = new Set(siteRows.map((r) => r.siteId));
  const availableSites = sites.filter((s) => !overriddenSiteIds.has(s.id));

  function siteName(siteId: string | null) {
    if (!siteId) return "Global";
    return sites.find((s) => s.id === siteId)?.name ?? siteId;
  }

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["sub-activities", "group", groupKey] });
    void queryClient.invalidateQueries({ queryKey: ["activity-categories"] });
  }

  const rateMutation = useMutation({
    mutationFn: ({ id, unitRate }: { id: string; unitRate: number }) =>
      api.patch(`/sub-activities/${id}`, { unitRate }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Tarif mis à jour" });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Échec", description: String(message), variant: "destructive" });
    },
  });

  const addSiteMutation = useMutation({
    mutationFn: () => {
      if (!group) throw new Error("no group");
      return api.post("/sub-activities", {
        categoryId: group.categoryId,
        label: group.label,
        shortLabel: group.shortLabel,
        unitId: group.unitId,
        groupKey: group.groupKey,
        siteId: newSiteId,
        unitRate: Number(newRate),
      });
    },
    onSuccess: () => {
      invalidate();
      setNewSiteId("");
      setNewRate("");
      toast({ title: "Surcharge de site créée" });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Échec", description: String(message), variant: "destructive" });
    },
  });

  const removeSiteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/sub-activities/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Surcharge retirée" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tarifs par site — {group?.label}</DialogTitle>
          <DialogDescription>
            Le tarif global s'applique à tous les sites sans surcharge. Modifier un tarif crée une
            nouvelle version (RG-04) pour cette seule lignée.
          </DialogDescription>
        </DialogHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Site</TableHead>
              <TableHead>Tarif</TableHead>
              <TableHead className="w-40">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rowsQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={3} className="text-zinc-500">
                  Chargement…
                </TableCell>
              </TableRow>
            )}
            {!rowsQuery.isLoading && globalRow && (
              <TableRow>
                <TableCell>
                  <Badge variant="success">Global (tous les autres sites)</Badge>
                </TableCell>
                <TableCell>
                  <RateEditor
                    value={globalRow.unitRate}
                    saving={rateMutation.isPending}
                    onSave={(unitRate) => rateMutation.mutate({ id: globalRow.id, unitRate })}
                  />
                </TableCell>
                <TableCell>
                  <RowActions>
                    <IconButton icon={History} label="Historique" onClick={() => onHistory(null)} />
                  </RowActions>
                </TableCell>
              </TableRow>
            )}
            {siteRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{siteName(row.siteId)}</TableCell>
                <TableCell>
                  <RateEditor
                    value={row.unitRate}
                    saving={rateMutation.isPending}
                    onSave={(unitRate) => rateMutation.mutate({ id: row.id, unitRate })}
                  />
                </TableCell>
                <TableCell>
                  <RowActions>
                    <IconButton
                      icon={History}
                      label="Historique"
                      onClick={() => onHistory(row.siteId)}
                    />
                    <IconButton
                      icon={Power}
                      label="Retirer la surcharge"
                      variant="destructive"
                      onClick={() => removeSiteMutation.mutate(row.id)}
                    />
                  </RowActions>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {availableSites.length > 0 && (
          <div className="flex items-end gap-2 border-t border-zinc-200 pt-4">
            <div className="flex-1 space-y-1">
              <p className="text-xs font-medium text-zinc-600">Ajouter un site</p>
              <Combobox
                placeholder="Rechercher un site…"
                options={availableSites.map((s) => ({
                  value: s.id,
                  label: `${s.name} (${s.shortCode})`,
                }))}
                value={newSiteId}
                onChange={setNewSiteId}
              />
            </div>
            <Input
              type="number"
              min="1"
              step="1"
              placeholder="Tarif"
              value={newRate}
              onChange={(e) => setNewRate(e.target.value)}
              className="w-28"
            />
            <Button
              type="button"
              variant="outline"
              disabled={!newSiteId || !newRate || Number(newRate) <= 0 || addSiteMutation.isPending}
              onClick={() => addSiteMutation.mutate()}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Ajouter
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
