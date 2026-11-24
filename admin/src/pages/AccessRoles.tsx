import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isAxiosError } from "axios";
import PageHeader from "../components/shared/PageHeader";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { Button } from "../components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { toast } from "../hooks/use-toast";
import { useAuth } from "../hooks/useAuth";
import GroupSheet from "../components/access/GroupSheet";
import GroupsTable from "../components/access/GroupsTable";
import RoleSheet from "../components/access/RoleSheet";
import { copyGroupName } from "../lib/access-groups";
import type { GroupFormValues, RoleFormValues } from "../lib/access-forms";
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
import { accessApi, type AccessRole, type PermissionGroup } from "../lib/access";

function errorMessage(err: unknown): string {
  if (!isAxiosError(err)) return "Erreur";
  // Pas de réponse : coupure réseau ou serveur injoignable. Rien n'a été enregistré.
  if (!err.response)
    return "Le serveur ne répond pas : vérifiez la connexion. Rien n'a été enregistré.";
  return String(err.response.data?.message ?? "Erreur");
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

  const [groupSheet, setGroupSheet] = useState<{ editing: PermissionGroup | null } | null>(null);
  const [roleSheet, setRoleSheet] = useState<{ editing: AccessRole | null } | null>(null);
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
    mutationFn: (values: GroupFormValues) => {
      const body = {
        name: values.name.trim(),
        description: values.description.trim() || null,
        permissions: [...values.permissions],
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
  });

  const saveRole = useMutation({
    mutationFn: (values: RoleFormValues) => {
      const body = {
        name: values.name.trim(),
        description: values.description.trim() || null,
        scope: values.scope,
        mfaRequired: values.mfaRequired,
        groupIds: [...values.groupIds],
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
  });

  const duplicateGroup = useMutation({
    mutationFn: (group: PermissionGroup) =>
      accessApi.createGroup({
        name: copyGroupName(
          group.name,
          groups.map((g) => g.name),
        ),
        description: group.description,
        permissions: group.permissions,
      }),
    onSuccess: (created) => {
      refresh();
      toast({ title: "Groupe dupliqué", description: created.name });
    },
    onError: (err) =>
      toast({
        title: "Duplication impossible",
        description: errorMessage(err),
        variant: "destructive",
      }),
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
    saveGroup.reset();
    setGroupSheet({ editing: group });
  }

  function openRole(role: AccessRole | null) {
    saveRole.reset();
    setRoleSheet({ editing: role });
  }

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
            <GroupsTable
              groups={groups}
              roles={roles}
              resources={resources}
              onOpen={openGroup}
              onDuplicate={(group) => duplicateGroup.mutate(group)}
              onDelete={(group) => setToDelete({ kind: "group", item: group })}
            />
          )}
        </TabsContent>
      </Tabs>

      {groupSheet && (
        <GroupSheet
          group={groupSheet.editing}
          groups={groups}
          roles={roles}
          resources={resources}
          held={held}
          saving={saveGroup.isPending}
          error={saveGroup.isError ? errorMessage(saveGroup.error) : null}
          onSubmit={(values) => saveGroup.mutate(values)}
          onClose={() => setGroupSheet(null)}
        />
      )}

      {roleSheet && (
        <RoleSheet
          role={roleSheet.editing}
          roles={roles}
          groups={groups}
          resources={resources}
          held={held}
          actorScope={user?.scope}
          saving={saveRole.isPending}
          error={saveRole.isError ? errorMessage(saveRole.error) : null}
          onSubmit={(values) => saveRole.mutate(values)}
          onClose={() => setRoleSheet(null)}
        />
      )}

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
