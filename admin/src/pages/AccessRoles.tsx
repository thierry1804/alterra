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
import RolesTable from "../components/access/RolesTable";
import { confirmationFor, copyName, type RolePatch } from "../lib/access-roles";
import {
  SCOPE_LABELS,
  accessApi,
  type AccessRole,
  type AccessScope,
  type PermissionGroup,
  type PermissionResource,
} from "../lib/access";

function errorMessage(err: unknown): string {
  return isAxiosError(err) ? String(err.response?.data?.message ?? "Erreur") : "Erreur";
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
  const { user } = useAuth();
  const held = useMemo(() => new Set(user?.permissions ?? []), [user]);

  const catalogQuery = useQuery({ queryKey: ["access", "catalog"], queryFn: accessApi.catalog });
  const groupsQuery = useQuery({ queryKey: ["access", "groups"], queryFn: accessApi.groups });
  const rolesQuery = useQuery({ queryKey: ["access", "roles"], queryFn: accessApi.roles });

  const resources = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const groups = useMemo(() => groupsQuery.data ?? [], [groupsQuery.data]);
  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data]);
  const labels = useMemo(() => permissionLabels(resources), [resources]);

  const [groupSheet, setGroupSheet] = useState<{ editing: PermissionGroup | null } | null>(null);
  const [groupForm, setGroupForm] = useState<GroupForm>(emptyGroupForm);
  const [roleSheet, setRoleSheet] = useState<{ editing: AccessRole | null } | null>(null);
  const [roleForm, setRoleForm] = useState<RoleForm>(emptyRoleForm);
  const [pendingPatch, setPendingPatch] = useState<{
    role: AccessRole;
    patch: RolePatch;
    message: string;
  } | null>(null);
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

  // Modification en place depuis le tableau : mise à jour optimiste, annulée si le serveur refuse.
  const patchRole = useMutation({
    mutationFn: ({ role, patch }: { role: AccessRole; patch: RolePatch }) =>
      accessApi.updateRole(role.id, patch),
    onMutate: async ({ role, patch }) => {
      await queryClient.cancelQueries({ queryKey: ["access", "roles"] });
      const previous = queryClient.getQueryData<AccessRole[]>(["access", "roles"]);
      queryClient.setQueryData<AccessRole[]>(["access", "roles"], (rows) =>
        rows?.map((row) => (row.id === role.id ? { ...row, ...patch } : row)),
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      queryClient.setQueryData(["access", "roles"], context?.previous);
      toast({ title: "Échec", description: errorMessage(err), variant: "destructive" });
    },
    onSuccess: () => toast({ title: "Rôle mis à jour" }),
    onSettled: refresh,
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

  function requestRolePatch(role: AccessRole, patch: RolePatch) {
    const message = confirmationFor(role, patch);
    if (message) setPendingPatch({ role, patch, message });
    else patchRole.mutate({ role, patch });
  }

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
          <div className="flex justify-end">
            <Button type="button" onClick={() => openRole(null)}>
              Nouveau rôle
            </Button>
          </div>
          <RolesTable
            roles={roles}
            resources={resources}
            onOpenDetail={openRole}
            onPatch={requestRolePatch}
            onDuplicate={(role) => duplicateRole.mutate(role)}
            onDelete={(role) => setToDelete({ kind: "role", item: role })}
          />
        </TabsContent>

        <TabsContent value="groups" className="space-y-3">
          <div className="flex justify-end">
            <Button type="button" onClick={() => openGroup(null)}>
              Nouveau groupe
            </Button>
          </div>
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

      <ConfirmDialog
        open={pendingPatch !== null}
        title={`Modifier le rôle « ${pendingPatch?.role.name ?? ""} » ?`}
        description={pendingPatch?.message ?? ""}
        confirmLabel="Appliquer"
        onConfirm={() => {
          if (pendingPatch)
            patchRole.mutate({ role: pendingPatch.role, patch: pendingPatch.patch });
          setPendingPatch(null);
        }}
        onOpenChange={(open) => !open && setPendingPatch(null)}
      />
    </div>
  );
}
