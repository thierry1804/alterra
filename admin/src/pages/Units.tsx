import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { Pencil, Power, Plus } from "lucide-react";
import { api } from "../lib/api";
import type { Unit } from "../lib/referentials";
import PageHeader, { LoadMoreButton } from "../components/shared/PageHeader";
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

interface UnitForm {
  code: string;
  label: string;
}

const emptyUnitForm: UnitForm = { code: "", label: "" };

export default function UnitsPage() {
  const queryClient = useQueryClient();
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitForm, setUnitForm] = useState<UnitForm>(emptyUnitForm);

  const [search, setSearch] = useState("");

  const unitsQuery = useInfiniteQuery({
    queryKey: ["units", search],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: Unit[]; nextCursor: string | null; hasMore: boolean }>("/units", {
          params: { cursor: pageParam, take: 50, q: search || undefined },
        })
        .then((r) => r.data),
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
  });

  const units = useMemo(
    () => unitsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [unitsQuery.data],
  );
  const isLoading = unitsQuery.isLoading;

  const saveUnitMutation = useMutation({
    mutationFn: async () => {
      const payload = { code: unitForm.code.trim(), label: unitForm.label.trim() };
      if (editingUnit) {
        return api.patch<Unit>(`/units/${editingUnit.id}`, payload);
      }
      return api.post<Unit>("/units", payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["units"] });
      setUnitDialogOpen(false);
      toast({ title: editingUnit ? "Unité mise à jour" : "Unité créée" });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Échec", description: String(message), variant: "destructive" });
    },
  });

  const deactivateUnitMutation = useMutation({
    mutationFn: (unit: Unit) => api.delete(`/units/${unit.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["units"] });
      toast({ title: "Unité désactivée" });
    },
  });

  function openCreateUnit() {
    setEditingUnit(null);
    setUnitForm(emptyUnitForm);
    setUnitDialogOpen(true);
  }

  function openEditUnit(unit: Unit) {
    setEditingUnit(unit);
    setUnitForm({ code: unit.code, label: unit.label });
    setUnitDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Unités"
        description="Référentiel des unités de mesure utilisées par les sous-activités."
        action={
          <Button type="button" onClick={openCreateUnit}>
            <Plus className="h-4 w-4" aria-hidden />
            Nouvelle unité
          </Button>
        }
      />

      <Input
        placeholder="Rechercher (code, libellé…)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />

      {isLoading && <p className="text-sm text-zinc-500">Chargement…</p>}

      {!isLoading && (
        <div className="rounded-lg border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {units.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-zinc-500">
                    Aucune unité.
                  </TableCell>
                </TableRow>
              )}
              {units.map((unit) => (
                <TableRow key={unit.id}>
                  <TableCell>
                    <Badge variant={unit.active ? "success" : "default"}>{unit.code}</Badge>
                  </TableCell>
                  <TableCell>{unit.label}</TableCell>
                  <TableCell>
                    <Badge variant={unit.active ? "success" : "default"}>
                      {unit.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <RowActions>
                      <IconButton
                        icon={Pencil}
                        label="Modifier"
                        variant="brand"
                        onClick={() => openEditUnit(unit)}
                      />
                      {unit.active && (
                        <IconButton
                          icon={Power}
                          label="Désactiver"
                          variant="destructive"
                          onClick={() => deactivateUnitMutation.mutate(unit)}
                        />
                      )}
                    </RowActions>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <LoadMoreButton
        hasMore={!!unitsQuery.hasNextPage}
        loading={unitsQuery.isFetchingNextPage}
        onClick={() => void unitsQuery.fetchNextPage()}
      />

      <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUnit ? "Modifier l'unité" : "Nouvelle unité"}</DialogTitle>
            <DialogDescription>Code et libellé — ex. TROU / Trou, HA / Ha.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveUnitMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="unit-code">Code</Label>
              <Input
                id="unit-code"
                value={unitForm.code}
                onChange={(e) => setUnitForm((f) => ({ ...f, code: e.target.value }))}
                maxLength={20}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit-label">Libellé</Label>
              <Input
                id="unit-label"
                value={unitForm.label}
                onChange={(e) => setUnitForm((f) => ({ ...f, label: e.target.value }))}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setUnitDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saveUnitMutation.isPending}>
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
