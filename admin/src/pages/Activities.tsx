import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { Pencil, History, Power, Plus, FolderPlus, ChevronRight, ChevronDown } from "lucide-react";
import { api } from "../lib/api";
import type { ActivityCategory, ActivitySubActivity, Site, Unit } from "../lib/referentials";
import { formatDate, formatRate } from "../lib/referentials";
import PageHeader, { LoadMoreButton } from "../components/shared/PageHeader";
import RateHistoryDrawer from "../components/activities/RateHistoryDrawer";
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

  const [history, setHistory] = useState<{ categoryId: string; label: string } | null>(null);
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

      {!isLoading && (
        <div className="rounded-lg border border-zinc-200">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-9" />
                <TableHead>Code</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Sous-activités</TableHead>
                <TableHead>Statut</TableHead>
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
              {categories.map((category) => {
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
                                <TableHead className="pl-10">Libellé</TableHead>
                                <TableHead>Libellé court (MVola)</TableHead>
                                <TableHead>Unité</TableHead>
                                <TableHead>Tarif</TableHead>
                                <TableHead>Site</TableHead>
                                <TableHead>Depuis</TableHead>
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
                              {category.subActivities.map((sub) => (
                                <TableRow key={sub.id}>
                                  <TableCell className="pl-10">{sub.label}</TableCell>
                                  <TableCell>{sub.shortLabel}</TableCell>
                                  <TableCell>{sub.unit?.label}</TableCell>
                                  <TableCell>{formatRate(sub.unitRate)}</TableCell>
                                  <TableCell>{siteName(sub.siteId)}</TableCell>
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
                                        icon={History}
                                        label="Historique des tarifs"
                                        onClick={() =>
                                          setHistory({ categoryId: category.id, label: sub.label })
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
                              ))}
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
        categoryId={history?.categoryId ?? null}
        label={history?.label ?? null}
        open={!!history}
        onOpenChange={(open) => {
          if (!open) setHistory(null);
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
