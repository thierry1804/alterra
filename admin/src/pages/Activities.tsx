import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import {
  Pencil,
  History,
  Power,
  Plus,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  MapPinned,
} from "lucide-react";
import { api } from "../lib/api";
import type { ActivityCategory, ActivitySubActivity, Site, Unit } from "../lib/referentials";
import { formatDate, formatRate } from "../lib/referentials";
import PageHeader, { LoadMoreButton } from "../components/shared/PageHeader";
import RateHistoryDrawer from "../components/activities/RateHistoryDrawer";
import SubActivitySitesModal, {
  type SubActivityGroupSummary,
} from "../components/activities/SubActivitySitesModal";
import { Button } from "../components/ui/button";
import { IconButton, RowActions } from "../components/ui/IconButton";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Combobox } from "../components/ui/combobox";
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
import { fetchAllCursorPages } from "../components/ui/data-table/fetchAllPages";
import { sortRows, useSortState } from "../components/ui/data-table/useClientSort";
import { SortableHead } from "../components/ui/data-table/SortableHead";
import { QueryError } from "../components/ui/QueryError";

type CategoryWithSubActivities = ActivityCategory & { subActivities: ActivitySubActivity[] };

interface CategoryForm {
  code: string;
  label: string;
}

const emptyCategoryForm: CategoryForm = { code: "", label: "" };

interface SubActivityForm {
  categoryId: string;
  label: string;
  shortLabel: string;
  unitId: string;
  unitRate: string;
  siteId: string;
}

const emptySubActivityForm: SubActivityForm = {
  categoryId: "",
  label: "",
  shortLabel: "",
  unitId: "",
  unitRate: "",
  siteId: "",
};

export default function ActivitiesPage() {
  const queryClient = useQueryClient();
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ActivityCategory | null>(null);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(emptyCategoryForm);

  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<ActivitySubActivity | null>(null);
  const [subForm, setSubForm] = useState<SubActivityForm>(emptySubActivityForm);
  const [shortLabelEdited, setShortLabelEdited] = useState(false);

  const [history, setHistory] = useState<{
    groupKey: string;
    siteId: string | null;
    label: string;
  } | null>(null);
  const [sitesModalGroup, setSitesModalGroup] = useState<SubActivityGroupSummary | null>(null);
  const [sitesModalOpen, setSitesModalOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(categoryId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  const [search, setSearch] = useState("");
  const categorySort = useSortState();
  // Un seul état de tri pour les tableaux de sous-activités : trier une colonne s'applique à toutes les catégories ouvertes.
  const subSort = useSortState();

  const categoriesQuery = useInfiniteQuery({
    queryKey: ["activity-categories", search],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api
        .get<{
          data: CategoryWithSubActivities[];
          nextCursor: string | null;
          hasMore: boolean;
        }>("/activity-categories", {
          params: {
            includeSubActivities: "true",
            cursor: pageParam,
            take: 50,
            q: search || undefined,
          },
        })
        .then((r) => r.data),
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
  });

  const categories = useMemo(
    () => categoriesQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [categoriesQuery.data],
  );
  const isLoading = categoriesQuery.isLoading;

  const { data: sites = [] } = useQuery({
    queryKey: ["sites"],
    queryFn: () => api.get<{ data: Site[] }>("/sites").then((r) => r.data.data),
  });

  const { data: units = [] } = useQuery({
    queryKey: ["units", "all"],
    queryFn: () =>
      fetchAllCursorPages<Unit>((cursor) =>
        api
          .get<{ data: Unit[]; nextCursor: string | null; hasMore: boolean }>("/units", {
            params: { cursor, take: 100 },
          })
          .then((r) => r.data),
      ),
  });

  const siteName = (siteId: string | null) =>
    siteId ? (sites.find((s) => s.id === siteId)?.shortCode ?? siteId) : "Global";

  const saveCategoryMutation = useMutation({
    mutationFn: async () => {
      const payload = { code: categoryForm.code.trim(), label: categoryForm.label.trim() };
      if (editingCategory) {
        return api.patch<ActivityCategory>(`/activity-categories/${editingCategory.id}`, payload);
      }
      return api.post<ActivityCategory>("/activity-categories", payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["activity-categories"] });
      setCategoryDialogOpen(false);
      toast({ title: editingCategory ? "Catégorie mise à jour" : "Catégorie créée" });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Échec", description: String(message), variant: "destructive" });
    },
  });

  const deactivateCategoryMutation = useMutation({
    mutationFn: (category: ActivityCategory) => api.delete(`/activity-categories/${category.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["activity-categories"] });
      toast({ title: "Catégorie désactivée" });
    },
  });

  const saveSubActivityMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        categoryId: subForm.categoryId,
        label: subForm.label.trim(),
        shortLabel: subForm.shortLabel.trim(),
        unitId: subForm.unitId,
        unitRate: Number(subForm.unitRate),
        siteId: subForm.siteId || null,
      };
      if (editingSub) {
        return api.patch<ActivitySubActivity>(`/sub-activities/${editingSub.id}`, payload);
      }
      return api.post<ActivitySubActivity>("/sub-activities", payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["activity-categories"] });
      setSubDialogOpen(false);
      toast({ title: editingSub ? "Sous-activité mise à jour" : "Sous-activité créée" });
    },
    onError: (err) => {
      const message = isAxiosError(err) ? err.response?.data?.message : "Erreur";
      toast({ title: "Échec", description: String(message), variant: "destructive" });
    },
  });

  const deactivateSubMutation = useMutation({
    mutationFn: (subActivity: ActivitySubActivity) =>
      api.delete(`/sub-activities/${subActivity.id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["activity-categories"] });
      toast({ title: "Sous-activité désactivée" });
    },
  });

  function openCreateCategory() {
    setEditingCategory(null);
    setCategoryForm(emptyCategoryForm);
    setCategoryDialogOpen(true);
  }

  function openEditCategory(category: ActivityCategory) {
    setEditingCategory(category);
    setCategoryForm({ code: category.code, label: category.label });
    setCategoryDialogOpen(true);
  }

  function openCreateSub(categoryId: string) {
    setEditingSub(null);
    setSubForm({ ...emptySubActivityForm, categoryId });
    setShortLabelEdited(false);
    setSubDialogOpen(true);
  }

  function openEditSub(subActivity: ActivitySubActivity) {
    setEditingSub(subActivity);
    setSubForm({
      categoryId: subActivity.categoryId,
      label: subActivity.label,
      shortLabel: subActivity.shortLabel,
      unitId: subActivity.unitId,
      unitRate: subActivity.unitRate,
      siteId: subActivity.siteId ?? "",
    });
    setShortLabelEdited(true);
    setSubDialogOpen(true);
  }

  function openSitesModal(representative: ActivitySubActivity) {
    setSitesModalGroup({
      groupKey: representative.groupKey,
      categoryId: representative.categoryId,
      label: representative.label,
      shortLabel: representative.shortLabel,
      unitId: representative.unitId,
    });
    setSitesModalOpen(true);
  }

  function groupSubActivities(subActivities: ActivitySubActivity[]) {
    const byGroup = new Map<string, ActivitySubActivity[]>();
    subActivities.forEach((sub) => {
      const current = byGroup.get(sub.groupKey) ?? [];
      current.push(sub);
      byGroup.set(sub.groupKey, current);
    });
    return [...byGroup.values()].map((rows) => ({
      representative: rows.find((r) => r.siteId === null) ?? rows[0],
      siteOverrideCount: rows.filter((r) => r.siteId !== null).length,
    }));
  }

  type SubActivityRow = ReturnType<typeof groupSubActivities>[number];
  const categoryAccessors: Record<string, (c: CategoryWithSubActivities) => unknown> = {
    subCount: (c) => c.subActivities.length,
    active: (c) => (c.active ? "Active" : "Inactive"),
  };
  const subAccessors: Record<string, (g: SubActivityRow) => unknown> = {
    label: (g) => g.representative.label,
    shortLabel: (g) => g.representative.shortLabel,
    unit: (g) => g.representative.unit?.label,
    unitRate: (g) => Number(g.representative.unitRate),
    site: (g) => siteName(g.representative.siteId),
    validFrom: (g) => g.representative.validFrom,
  };
  const sortedCategories = sortRows(categories, categorySort.sortKey, categorySort.sortDir, categoryAccessors);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activités"
        description="Catégories officielles et sous-activités — tâches et tarifs unitaires."
        action={
          <Button type="button" onClick={openCreateCategory}>
            <FolderPlus className="h-4 w-4" aria-hidden />
            Nouvelle catégorie
          </Button>
        }
      />

      <Input
        placeholder="Rechercher (code, libellé, sous-activité…)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />

      {isLoading && <p className="text-sm text-zinc-500">Chargement…</p>}

      {categoriesQuery.isError && (
        <div className="rounded-lg border border-zinc-200">
          <QueryError what="les activités" onRetry={() => void categoriesQuery.refetch()} />
        </div>
      )}

      {!isLoading && !categoriesQuery.isError && (
        <div className="rounded-lg border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-9" />
                <SortableHead sortKey="code" label="Code" currentKey={categorySort.sortKey} currentDir={categorySort.sortDir} onSort={categorySort.toggleSort} />
                <SortableHead sortKey="label" label="Libellé" currentKey={categorySort.sortKey} currentDir={categorySort.sortDir} onSort={categorySort.toggleSort} />
                <SortableHead sortKey="subCount" label="Sous-activités" currentKey={categorySort.sortKey} currentDir={categorySort.sortDir} onSort={categorySort.toggleSort} />
                <SortableHead sortKey="active" label="Statut" currentKey={categorySort.sortKey} currentDir={categorySort.sortDir} onSort={categorySort.toggleSort} />
                <TableHead className="w-40">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-zinc-500">
                    Aucune catégorie.
                  </TableCell>
                </TableRow>
              )}
              {sortedCategories.map((category) => {
                const isOpen = search.trim().length > 0 || expanded.has(category.id);
                return (
                  <Fragment key={category.id}>
                    <TableRow>
                      <TableCell>
                        <button
                          type="button"
                          className="flex h-6 w-6 items-center justify-center rounded hover:bg-zinc-100"
                          onClick={() => toggleExpanded(category.id)}
                          aria-label={isOpen ? "Réduire" : "Développer"}
                          aria-expanded={isOpen}
                        >
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4 text-zinc-500" aria-hidden />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-zinc-500" aria-hidden />
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant={category.active ? "success" : "default"}>
                          {category.code}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-zinc-900">{category.label}</TableCell>
                      <TableCell className="text-zinc-600">
                        {category.subActivities.length}
                      </TableCell>
                      <TableCell>
                        <Badge variant={category.active ? "success" : "default"}>
                          {category.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <RowActions>
                          <IconButton
                            icon={Plus}
                            label="Nouvelle sous-activité"
                            onClick={() => openCreateSub(category.id)}
                          />
                          <IconButton
                            icon={Pencil}
                            label="Modifier la catégorie"
                            variant="brand"
                            onClick={() => openEditCategory(category)}
                          />
                          {category.active && (
                            <IconButton
                              icon={Power}
                              label="Désactiver la catégorie"
                              variant="destructive"
                              onClick={() => deactivateCategoryMutation.mutate(category)}
                            />
                          )}
                        </RowActions>
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow>
                        <TableCell colSpan={6} className="bg-zinc-50 p-0">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <SortableHead sortKey="label" label="Libellé" className="pl-10" currentKey={subSort.sortKey} currentDir={subSort.sortDir} onSort={subSort.toggleSort} />
                                <SortableHead sortKey="shortLabel" label="Libellé court (MVola)" currentKey={subSort.sortKey} currentDir={subSort.sortDir} onSort={subSort.toggleSort} />
                                <SortableHead sortKey="unit" label="Unité" currentKey={subSort.sortKey} currentDir={subSort.sortDir} onSort={subSort.toggleSort} />
                                <SortableHead sortKey="unitRate" label="Tarif" currentKey={subSort.sortKey} currentDir={subSort.sortDir} onSort={subSort.toggleSort} />
                                <SortableHead sortKey="site" label="Site" currentKey={subSort.sortKey} currentDir={subSort.sortDir} onSort={subSort.toggleSort} />
                                <SortableHead sortKey="validFrom" label="Depuis" currentKey={subSort.sortKey} currentDir={subSort.sortDir} onSort={subSort.toggleSort} />
                                <TableHead className="w-40">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {category.subActivities.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={7} className="pl-10 text-zinc-500">
                                    Aucune sous-activité active.
                                  </TableCell>
                                </TableRow>
                              )}
                              {sortRows(groupSubActivities(category.subActivities), subSort.sortKey, subSort.sortDir, subAccessors).map(
                                ({ representative: sub, siteOverrideCount }) => (
                                  <TableRow key={sub.groupKey}>
                                    <TableCell className="pl-10">{sub.label}</TableCell>
                                    <TableCell>{sub.shortLabel}</TableCell>
                                    <TableCell>{sub.unit?.label}</TableCell>
                                    <TableCell>{formatRate(sub.unitRate)}</TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        {siteName(sub.siteId)}
                                        {siteOverrideCount > 0 && (
                                          <Badge variant="default">
                                            +{siteOverrideCount} site
                                            {siteOverrideCount > 1 ? "s" : ""}
                                          </Badge>
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell>{formatDate(sub.validFrom)}</TableCell>
                                    <TableCell>
                                      <RowActions>
                                        <IconButton
                                          icon={Pencil}
                                          label="Modifier"
                                          variant="brand"
                                          onClick={() => openEditSub(sub)}
                                        />
                                        <IconButton
                                          icon={MapPinned}
                                          label="Gérer les tarifs par site"
                                          onClick={() => openSitesModal(sub)}
                                        />
                                        <IconButton
                                          icon={History}
                                          label="Historique des tarifs"
                                          onClick={() =>
                                            setHistory({
                                              groupKey: sub.groupKey,
                                              siteId: sub.siteId,
                                              label: sub.label,
                                            })
                                          }
                                        />
                                        <IconButton
                                          icon={Power}
                                          label="Désactiver"
                                          variant="destructive"
                                          onClick={() => deactivateSubMutation.mutate(sub)}
                                        />
                                      </RowActions>
                                    </TableCell>
                                  </TableRow>
                                ),
                              )}
                            </TableBody>
                          </Table>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <LoadMoreButton
        hasMore={!!categoriesQuery.hasNextPage}
        loading={categoriesQuery.isFetchingNextPage}
        onClick={() => void categoriesQuery.fetchNextPage()}
      />

      <RateHistoryDrawer
        groupKey={history?.groupKey ?? null}
        siteId={history?.siteId ?? null}
        label={history?.label ?? null}
        open={!!history}
        onOpenChange={(open) => {
          if (!open) setHistory(null);
        }}
      />

      <SubActivitySitesModal
        open={sitesModalOpen}
        onOpenChange={setSitesModalOpen}
        group={sitesModalGroup}
        sites={sites}
        onHistory={(siteId) => {
          if (!sitesModalGroup) return;
          setHistory({ groupKey: sitesModalGroup.groupKey, siteId, label: sitesModalGroup.label });
        }}
      />

      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Modifier la catégorie" : "Nouvelle catégorie"}
            </DialogTitle>
            <DialogDescription>
              Code officiel (ex. ACT04) et libellé — cf. CATEGORIES DES ACTIVITES MOC PAR SITE.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveCategoryMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="cat-code">Code</Label>
              <Input
                id="cat-code"
                value={categoryForm.code}
                onChange={(e) => setCategoryForm((f) => ({ ...f, code: e.target.value }))}
                maxLength={20}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-label">Libellé</Label>
              <Input
                id="cat-label"
                value={categoryForm.label}
                onChange={(e) => setCategoryForm((f) => ({ ...f, label: e.target.value }))}
                required
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCategoryDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saveCategoryMutation.isPending}>
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSub ? "Modifier la sous-activité" : "Nouvelle sous-activité"}
            </DialogTitle>
            <DialogDescription>
              Un changement de tarif crée une nouvelle version (RG-04).
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveSubActivityMutation.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="sub-label">Libellé</Label>
              <Input
                id="sub-label"
                value={subForm.label}
                onChange={(e) => {
                  const label = e.target.value;
                  setSubForm((f) => ({
                    ...f,
                    label,
                    shortLabel: shortLabelEdited ? f.shortLabel : label.toLowerCase(),
                  }));
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-short">Libellé court (grammaire MVola, 1-2 mots)</Label>
              <Input
                id="sub-short"
                value={subForm.shortLabel}
                onChange={(e) => {
                  setShortLabelEdited(true);
                  setSubForm((f) => ({ ...f, shortLabel: e.target.value }));
                }}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sub-unit">Unité</Label>
                <Combobox
                  id="sub-unit"
                  placeholder="Rechercher une unité…"
                  options={units.map((unit) => ({ value: unit.id, label: unit.label }))}
                  value={subForm.unitId}
                  onChange={(unitId) => setSubForm((f) => ({ ...f, unitId }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub-rate">Tarif (Ar)</Label>
                <Input
                  id="sub-rate"
                  type="number"
                  min="1"
                  step="1"
                  value={subForm.unitRate}
                  onChange={(e) => setSubForm((f) => ({ ...f, unitRate: e.target.value }))}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-site">Site (vide = global)</Label>
              <Combobox
                id="sub-site"
                placeholder="Rechercher un site…"
                options={[
                  { value: "", label: "Global" },
                  ...sites.map((site) => ({
                    value: site.id,
                    label: `${site.name} (${site.shortCode})`,
                  })),
                ]}
                value={subForm.siteId}
                onChange={(siteId) => setSubForm((f) => ({ ...f, siteId }))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setSubDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saveSubActivityMutation.isPending}>
                Enregistrer
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
