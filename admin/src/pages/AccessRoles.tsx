import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import { Pencil, Trash2 } from "lucide-react";
import PageHeader from "../components/shared/PageHeader";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { IconButton, RowActions } from "../components/ui/IconButton";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import { Switch } from "../components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "../hooks/use-toast";
import { useAuth } from "../hooks/useAuth";
import CompareRolesDialog from "../components/access/CompareRolesDialog";
import RolesMatrix from "../components/access/RolesMatrix";
import { AccessPageSkeleton } from "../components/access/AccessSkeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { QueryError } from "../components/ui/QueryError";
import RolesTable from "../components/access/RolesTable";
import { withGroupToggled } from "../lib/access-matrix";
import { useSearchParams } from "react-router-dom";
import { cn } from "../lib/utils";
import {
  applyPatch,
  changedFields,
  countChanges,
  editDraft,
  inverseChanges,
  toChanges,
  type RoleField,
  type RolesDraft,
} from "../lib/access-draft";
import { copyName, type RolePatch } from "../lib/access-roles";
import ReviewChangesDialog from "../components/access/ReviewChangesDialog";
import SaveBar from "../components/access/SaveBar";
import { useUnsavedChangesGuard } from "../hooks/useUnsavedChangesGuard";
import {
  SCOPE_LABELS,
  accessApi,
  type AccessRole,
  type AccessScope,
  type PermissionGroup,
  type PermissionResource,
} from "../lib/access";

function errorMessage(err: unknown): string {
  if (!isAxiosError(err)) return "Erreur";
  // Pas de réponse : coupure réseau ou serveur injoignable. Rien n'a été enregistré.
  if (!err.response)
    return "Le serveur ne répond pas : vérifiez la connexion. Rien n'a été enregistré.";
  return String(err.response.data?.message ?? "Erreur");
}

function permissionLabels(resources: PermissionResource[]): Map<string, string> {
  const labels = new Map<string, string>();
  for (const resource of resources) {
    for (const action of resource.actions) {
      labels.set(`${resource.resource}:${action.action}`, `${resource.label} — ${action.label}`);
    }
  }
  return labels;
}

interface GroupForm {
  name: string;
  description: string;
  permissions: Set<string>;
}

interface RoleForm {
  name: string;
  description: string;
  scope: AccessScope;
  mfaRequired: boolean;
  groupIds: Set<string>;
}

const emptyGroupForm: GroupForm = { name: "", description: "", permissions: new Set() };
const emptyRoleForm: RoleForm = {
  name: "",
  description: "",
  scope: "EQUIPE",
  mfaRequired: false,
  groupIds: new Set(),
};

function toggled<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export default function AccessRolesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("vue") === "matrice" ? "matrice" : "liste";
  const setView = (next: "liste" | "matrice") =>
    setSearchParams(
      (params) => {
        const copy = new URLSearchParams(params);
        if (next === "matrice") copy.set("vue", "matrice");
        else copy.delete("vue");
        return copy;
      },
      { replace: true },
    );
  const { user } = useAuth();
  const held = useMemo(() => new Set(user?.permissions ?? []), [user]);

  const catalogQuery = useQuery({ queryKey: ["access", "catalog"], queryFn: accessApi.catalog });
  const groupsQuery = useQuery({ queryKey: ["access", "groups"], queryFn: accessApi.groups });
  const rolesQuery = useQuery({ queryKey: ["access", "roles"], queryFn: accessApi.roles });

  const resources = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);
  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);
  const queries = [catalogQuery, groupsQuery, rolesQuery];
  const loading = queries.some((query) => query.isLoading);
  const failed = !loading && queries.some((query) => query.isError);
  const retryAll = () => queries.forEach((query) => void query.refetch());
  const labels = useMemo(() => permissionLabels(resources), [resources]);

  const [groupSheet, setGroupSheet] = useState<{ editing: PermissionGroup | null } | null>(null);
  const [groupForm, setGroupForm] = useState<GroupForm>(emptyGroupForm);
  const [roleSheet, setRoleSheet] = useState<{ editing: AccessRole | null } | null>(null);
  const [roleForm, setRoleForm] = useState<RoleForm>(emptyRoleForm);
  // Modifications faites dans le tableau ou la matrice, gardées en local jusqu'à « Enregistrer ».
  const [draft, setDraft] = useState<RolesDraft>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [compare, setCompare] = useState<{ leftId: string | null } | null>(null);
  const [toDelete, setToDelete] = useState<
    { kind: "group"; item: PermissionGroup } | { kind: "role"; item: AccessRole } | null
  >(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["access"] });
    void queryClient.invalidateQueries({ queryKey: ["users"] });
  }

  const saveGroup = useMutation({
    mutationFn: () => {
      const body = {
        name: groupForm.name.trim(),
        description: groupForm.description.trim() || null,
        permissions: [...groupForm.permissions],
      };
      return groupSheet?.editing
        ? accessApi.updateGroup(groupSheet.editing.id, body)
        : accessApi.createGroup(body);
    },
    onSuccess: () => {
      refresh();
      setGroupSheet(null);
      toast({ title: groupSheet?.editing ? "Groupe mis à jour" : "Groupe créé" });
    },
    onError: (err) =>
      toast({ title: "Échec", description: errorMessage(err), variant: "destructive" }),
  });

  const saveRole = useMutation({
    mutationFn: () => {
      const body = {
        name: roleForm.name.trim(),
        description: roleForm.description.trim() || null,
        scope: roleForm.scope,
        mfaRequired: roleForm.mfaRequired,
        groupIds: [...roleForm.groupIds],
      };
      return roleSheet?.editing
        ? accessApi.updateRole(roleSheet.editing.id, body)
        : accessApi.createRole(body);
    },
    onSuccess: () => {
      refresh();
      setRoleSheet(null);
      toast({ title: roleSheet?.editing ? "Rôle mis à jour" : "Rôle créé" });
    },
    onError: (err) =>
      toast({ title: "Échec", description: errorMessage(err), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: () =>
      toDelete?.kind === "group"
        ? accessApi.deleteGroup(toDelete.item.id)
        : accessApi.deleteRole(toDelete!.item.id),
    onSuccess: () => {
      refresh();
      setToDelete(null);
      toast({ title: "Supprimé" });
    },
    onError: (err) => {
      setToDelete(null);
      toast({
        title: "Suppression impossible",
        description: errorMessage(err),
        variant: "destructive",
      });
    },
  });

  // Seuls les rôles qui existent encore comptent : un rôle supprimé entre-temps ne bloque pas l'envoi.
  const activeDraft = useMemo(() => {
    const ids = new Set(roles.map((role) => role.id));
    return Object.fromEntries(Object.entries(draft).filter(([id]) => ids.has(id))) as RolesDraft;
  }, [draft, roles]);
  const viewRoles = useMemo(
    () =>
      roles.map((role) =>
        activeDraft[role.id] ? applyPatch(role, activeDraft[role.id].patch, groups) : role,
      ),
    [roles, groups, activeDraft],
  );
  const dirtyFields = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(activeDraft).map(([id, entry]) => [id, changedFields(entry.patch)]),
      ) as Record<string, Set<RoleField>>,
    [activeDraft],
  );
  const changeCount = useMemo(() => countChanges(activeDraft, roles), [activeDraft, roles]);
  useUnsavedChangesGuard(changeCount > 0);

  function editRole(roleId: string, patch: RolePatch) {
    setDraft((current) => {
      const base = roles.find((role) => role.id === roleId);
      return base ? editDraft(current, base, patch) : current;
    });
  }

  function toggleGroup(roleId: string, groupId: string, checked: boolean) {
    setDraft((current) => {
      const base = roles.find((role) => role.id === roleId);
      if (!base) return current;
      return editDraft(current, base, (role) => ({
        groupIds: withGroupToggled(role.groupIds, groupId, checked),
      }));
    });
  }

  // Annule la dernière sauvegarde : renvoie les valeurs d'avant, en vérifiant que rien n'a bougé depuis.
  const undoSave = useMutation({
    mutationFn: (saved: { before: AccessRole[]; data: AccessRole[] }) =>
      accessApi.bulkUpdateRoles(inverseChanges(saved.before, saved.data)),
    onSuccess: () => {
      refresh();
      toast({ title: "Modifications annulées" });
    },
    onError: (err) =>
      toast({
        title: "Annulation impossible",
        description: errorMessage(err),
        variant: "destructive",
      }),
  });

  // Une seule requête, tout ou rien : le serveur revérifie droits, verrou Administrateur et versions.
  const saveDraft = useMutation({
    mutationFn: () => accessApi.bulkUpdateRoles(toChanges(activeDraft)),
    onSuccess: (saved) => {
      setDraft({});
      setReviewOpen(false);
      refresh();
      toast({
        title: "Modifications enregistrées",
        description: `${saved.data.length} rôle${saved.data.length > 1 ? "s" : ""} mis à jour`,
        duration: 10_000,
        action: { label: "Annuler", onClick: () => undoSave.mutate(saved) },
      });
    },
    onError: (err) => {
      setReviewOpen(false);
      toast({
        title: "Enregistrement refusé : rien n'a été modifié",
        description: errorMessage(err),
        variant: "destructive",
      });
    },
  });

  const duplicateRole = useMutation({
    mutationFn: (role: AccessRole) =>
      accessApi.createRole({
        name: copyName(
          role.name,
          roles.map((r) => r.name),
        ),
        description: role.description,
        scope: role.scope,
        mfaRequired: role.mfaRequired,
        groupIds: role.groupIds,
      }),
    onSuccess: (created) => {
      refresh();
      toast({ title: "Rôle dupliqué", description: created.name });
    },
    onError: (err) =>
      toast({
        title: "Duplication impossible",
        description: errorMessage(err),
        variant: "destructive",
      }),
  });

  function openGroup(group: PermissionGroup | null) {
    setGroupForm(
      group
        ? {
            name: group.name,
            description: group.description ?? "",
            permissions: new Set(group.permissions),
          }
        : emptyGroupForm,
    );
    setGroupSheet({ editing: group });
  }

  function openRole(role: AccessRole | null) {
    setRoleForm(
      role
        ? {
            name: role.name,
            description: role.description ?? "",
            scope: role.scope,
            mfaRequired: role.mfaRequired,
            groupIds: new Set(role.groupIds),
          }
        : emptyRoleForm,
    );
    setRoleSheet({ editing: role });
  }

  const roleFormPermissions = useMemo(() => {
    const all = new Set<string>();
    for (const group of groups) {
      if (roleForm.groupIds.has(group.id)) group.permissions.forEach((key) => all.add(key));
    }
    return [...all].sort();
  }, [groups, roleForm.groupIds]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Rôles et groupes"
        description="Des groupes de permissions, assemblés en rôles : un utilisateur a un seul rôle."
      />

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">Rôles</TabsTrigger>
          <TabsTrigger value="groups">Groupes de permissions</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              role="group"
              aria-label="Affichage des rôles"
              className="inline-flex rounded-md border border-zinc-300 p-0.5"
            >
              {(
                [
                  ["liste", "Liste"],
                  ["matrice", "Matrice"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  onClick={() => setView(value)}
                  className={cn(
                    "alterra-focus min-h-8 rounded px-3 text-sm font-medium transition-colors",
                    view === value ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={roles.length < 2}
                onClick={() => setCompare({ leftId: null })}
              >
                Comparer
              </Button>
              <Button type="button" onClick={() => openRole(null)}>
                Nouveau rôle
              </Button>
            </div>
          </div>
          {failed ? (
            <QueryError what="les rôles et les groupes" onRetry={retryAll} />
          ) : loading ? (
            <AccessPageSkeleton />
          ) : roles.length === 0 ? (
            <EmptyState
              title="Aucun rôle pour l'instant"
              hint="Créez un rôle en lui attribuant des groupes de permissions."
              action={<Button onClick={() => openRole(null)}>Nouveau rôle</Button>}
            />
          ) : view === "liste" ? (
            <RolesTable
              roles={viewRoles}
              dirtyFields={dirtyFields}
              resources={resources}
              onOpenDetail={openRole}
              onPatch={(role, patch) => editRole(role.id, patch)}
              onDuplicate={(role) => duplicateRole.mutate(role)}
              onCompare={(role) => setCompare({ leftId: role.id })}
              onDelete={(role) => setToDelete({ kind: "role", item: role })}
            />
          ) : (
            <RolesMatrix
              roles={viewRoles}
              baseline={roles}
              groups={groups}
              resources={resources}
              onToggle={(role, group, checked) => toggleGroup(role.id, group.id, checked)}
            />
          )}
        </TabsContent>

        <TabsContent value="groups" className="space-y-3">
          <div className="flex justify-end">
            <Button type="button" onClick={() => openGroup(null)}>
              Nouveau groupe
            </Button>
          </div>
          {failed ? (
            <QueryError what="les groupes de permissions" onRetry={retryAll} />
          ) : loading ? (
            <AccessPageSkeleton />
          ) : (
            <div className="rounded-lg border border-zinc-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Groupe</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead>Utilisé par</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => (
                    <TableRow key={group.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{group.name}</span>
                          {group.isSystem && <Badge>Système</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>{group.permissions.length}</TableCell>
                      <TableCell>{group.roleCount} rôle(s)</TableCell>
                      <TableCell>
                        <RowActions>
                          <IconButton
                            icon={Pencil}
                            label={`Modifier ${group.name}`}
                            onClick={() => openGroup(group)}
                          />
                          {!group.isSystem && (
                            <IconButton
                              icon={Trash2}
                              variant="destructive"
                              label={`Supprimer ${group.name}`}
                              onClick={() => setToDelete({ kind: "group", item: group })}
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
        </TabsContent>
      </Tabs>

      <Sheet open={groupSheet !== null} onOpenChange={(open) => !open && setGroupSheet(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{groupSheet?.editing ? "Modifier le groupe" : "Nouveau groupe"}</SheetTitle>
            <SheetDescription>
              {groupSheet?.editing && groupSheet.editing.roleCount > 0
                ? `Utilisé par ${groupSheet.editing.roleCount} rôle(s) : la modification s'applique à tous.`
                : "Cochez les actions autorisées pour chaque ressource."}
            </SheetDescription>
          </SheetHeader>
          <form
            className="contents"
            onSubmit={(e) => {
              e.preventDefault();
              saveGroup.mutate();
            }}
          >
            <SheetBody className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="g-name">Nom</Label>
                <Input
                  id="g-name"
                  value={groupForm.name}
                  onChange={(e) => setGroupForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  minLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="g-description">Description</Label>
                <Input
                  id="g-description"
                  value={groupForm.description}
                  onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-zinc-900">Permissions</legend>
                {resources.map((resource) => (
                  <div key={resource.resource} className="rounded-md border border-zinc-200 p-3">
                    <p className="mb-2 text-sm font-semibold text-zinc-900">{resource.label}</p>
                    <div className="grid gap-1.5">
                      {resource.actions.map((action) => {
                        const key = `${resource.resource}:${action.action}`;
                        const allowed = held.has(key);
                        return (
                          <label
                            key={key}
                            className="flex items-center gap-2 text-sm text-zinc-700"
                            title={allowed ? undefined : "Vous ne détenez pas ce droit"}
                          >
                            <Checkbox
                              checked={groupForm.permissions.has(key)}
                              disabled={!allowed && !groupForm.permissions.has(key)}
                              onChange={() =>
                                setGroupForm((f) => ({
                                  ...f,
                                  permissions: toggled(f.permissions, key),
                                }))
                              }
                            />
                            {action.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </fieldset>
            </SheetBody>
            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setGroupSheet(null)}
              >
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={saveGroup.isPending}>
                Enregistrer
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={roleSheet !== null} onOpenChange={(open) => !open && setRoleSheet(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{roleSheet?.editing ? "Modifier le rôle" : "Nouveau rôle"}</SheetTitle>
            <SheetDescription>
              Un rôle regroupe des groupes de permissions et fixe la portée des données visibles.
            </SheetDescription>
          </SheetHeader>
          <form
            className="contents"
            onSubmit={(e) => {
              e.preventDefault();
              saveRole.mutate();
            }}
          >
            <SheetBody className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="r-name">Nom</Label>
                <Input
                  id="r-name"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm((f) => ({ ...f, name: e.target.value }))}
                  required
                  minLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="r-description">Description</Label>
                <Input
                  id="r-description"
                  value={roleForm.description}
                  onChange={(e) => setRoleForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="r-scope">Portée des données</Label>
                <select
                  id="r-scope"
                  className="flex h-8 w-full rounded-md border border-zinc-300 bg-white px-2.5 text-sm"
                  value={roleForm.scope}
                  onChange={(e) =>
                    setRoleForm((f) => ({ ...f, scope: e.target.value as AccessScope }))
                  }
                >
                  {(Object.keys(SCOPE_LABELS) as AccessScope[]).map((scope) => (
                    <option key={scope} value={scope}>
                      {SCOPE_LABELS[scope]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 p-3">
                <div>
                  <Label id="r-mfa-label" htmlFor="r-mfa">
                    Authentification à deux facteurs
                  </Label>
                  <p className="text-xs text-muted">
                    Le code est demandé à la connexion une fois activé.
                  </p>
                </div>
                <Switch
                  id="r-mfa"
                  aria-labelledby="r-mfa-label"
                  checked={roleForm.mfaRequired}
                  onCheckedChange={(checked) =>
                    setRoleForm((f) => ({ ...f, mfaRequired: checked }))
                  }
                />
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-zinc-900">
                  Groupes de permissions
                </legend>
                {groups.map((group) => {
                  const beyond = group.permissions.some((key) => !held.has(key));
                  const selected = roleForm.groupIds.has(group.id);
                  return (
                    <label
                      key={group.id}
                      className="flex items-center gap-2 text-sm text-zinc-700"
                      title={
                        beyond ? "Ce groupe contient des droits que vous ne détenez pas" : undefined
                      }
                    >
                      <Checkbox
                        checked={selected}
                        disabled={beyond && !selected}
                        onChange={() =>
                          setRoleForm((f) => ({ ...f, groupIds: toggled(f.groupIds, group.id) }))
                        }
                      />
                      {group.name}
                      <span className="text-xs text-muted">({group.permissions.length})</span>
                    </label>
                  );
                })}
              </fieldset>
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-zinc-900">
                  Droits obtenus ({roleFormPermissions.length})
                </p>
                {roleFormPermissions.length === 0 ? (
                  <p className="text-xs text-muted">Aucun groupe sélectionné.</p>
                ) : (
                  <ul className="max-h-48 space-y-0.5 overflow-y-auto text-xs text-zinc-600">
                    {roleFormPermissions.map((key) => (
                      <li key={key}>{labels.get(key) ?? key}</li>
                    ))}
                  </ul>
                )}
              </div>
            </SheetBody>
            <SheetFooter>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setRoleSheet(null)}
              >
                Annuler
              </Button>
              <Button type="submit" className="flex-1" disabled={saveRole.isPending}>
                Enregistrer
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={toDelete !== null}
        title={toDelete?.kind === "group" ? "Supprimer ce groupe ?" : "Supprimer ce rôle ?"}
        description={`« ${toDelete?.item.name ?? ""} » sera supprimé définitivement.`}
        confirmLabel="Supprimer"
        destructive
        busy={remove.isPending}
        onConfirm={() => remove.mutate()}
        onOpenChange={(open) => !open && setToDelete(null)}
      />

      <CompareRolesDialog
        open={compare !== null}
        onOpenChange={(open) => !open && setCompare(null)}
        roles={roles}
        groups={groups}
        resources={resources}
        initialLeftId={compare?.leftId}
      />

      <SaveBar
        count={changeCount}
        busy={saveDraft.isPending}
        onSave={() => setReviewOpen(true)}
        onCancel={() => setDraft({})}
      />

      <ReviewChangesDialog
        open={reviewOpen}
        roles={roles}
        groups={groups}
        draft={activeDraft}
        busy={saveDraft.isPending}
        onConfirm={() => saveDraft.mutate()}
        onOpenChange={setReviewOpen}
      />
    </div>
  );
}
