import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { Pencil, Power, Plus, Ruler } from "lucide-react";
import { api } from "../lib/api";
import { EmptyState } from "../components/ui/EmptyState";
import FilterChips from "../components/ui/FilterChips";
import type { Unit } from "../lib/referentials";
import PageHeader, { LoadMoreButton } from "../components/shared/PageHeader";
import { Button } from "../components/ui/button";
import { IconButton, RowActions } from "../components/ui/IconButton";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
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
  const [statusFilter, setStatusFilter] = useState<"" | "true" | "false">("");

  const unitsQuery = useInfiniteQuery({
    queryKey: ["units", search, statusFilter],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api
        .get<{ data: Unit[]; nextCursor: string | null; hasMore: boolean }>("/units", {
          params: {
            cursor: pageParam,
            take: 50,
            q: search || undefined,
            active: statusFilter || undefined,
          },
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
    <div className="space-y-4">
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

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Rechercher (code, libellé…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <FilterChips
          label="Statut"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "", label: "Toutes" },
            { value: "true", label: "Actives" },
            { value: "false", label: "Inactives" },
          ]}
        />
      </div>

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
                  <TableCell colSpan={4} className="p-0">
                    <EmptyState
                      icon={Ruler}
                      title="Aucune unité"
                      hint="Les unités (Ha, Jour, Pièce…) servent à chiffrer les sous-activités."
                      action={
                        <Button type="button" onClick={openCreateUnit}>
                          <Plus className="h-4 w-4" aria-hidden />
                          Nouvelle unité
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              )}
              {units.map((unit) => (
                <TableRow
                  key={unit.id}
                  className="cursor-pointer"
                  onClick={() => openEditUnit(unit)}
                >
                  <TableCell>
                    <Badge variant={unit.active ? "success" : "default"}>{unit.code}</Badge>
                  </TableCell>
                  <TableCell>{unit.label}</TableCell>
                  <TableCell>
                    <Badge variant={unit.active ? "success" : "default"}>
                      {unit.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
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

      <Sheet open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editingUnit ? "Modifier l'unité" : "Nouvelle unité"}</SheetTitle>
            <SheetDescription>Code et libellé — ex. TROU / Trou, HA / Ha.</SheetDescription>
          </SheetHeader>
          <form
            className="contents"
            onSubmit={(e) => {
              e.preventDefault();
              saveUnitMutation.mutate();
            }}
          >
            <SheetBody className="space-y-4">
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
            </SheetBody>
            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setUnitDialogOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={saveUnitMutation.isPending}>
                Enregistrer
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}
