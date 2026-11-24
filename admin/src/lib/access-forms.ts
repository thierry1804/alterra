import type { AccessRole, AccessScope, PermissionGroup, PermissionResource } from "./access";

/** Nom valide (2 à 60 caractères) et pas déjà pris, sans tenir compte de la casse. */
export function validateName(
  name: string,
  existing: readonly { id: string; name: string }[],
  currentId?: string,
): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2) return "Au moins 2 caractères.";
  if (trimmed.length > 60) return "60 caractères au maximum.";
  const taken = existing.some(
    (item) => item.id !== currentId && item.name.trim().toLowerCase() === trimmed.toLowerCase(),
  );
  return taken ? "Ce nom est déjà utilisé." : null;
}

export function sameSet<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  return a.size === b.size && [...a].every((item) => b.has(item));
}

export interface GroupFormValues {
  name: string;
  description: string;
  permissions: Set<string>;
}

export interface RoleFormValues {
  name: string;
  description: string;
  scope: AccessScope;
  mfaRequired: boolean;
  groupIds: Set<string>;
}

export const EMPTY_GROUP_FORM: GroupFormValues = {
  name: "",
  description: "",
  permissions: new Set(),
};
export const EMPTY_ROLE_FORM: RoleFormValues = {
  name: "",
  description: "",
  scope: "EQUIPE",
  mfaRequired: false,
  groupIds: new Set(),
};

export function groupFormFrom(group: PermissionGroup | null): GroupFormValues {
  return group
    ? {
        name: group.name,
        description: group.description ?? "",
        permissions: new Set(group.permissions),
      }
    : { ...EMPTY_GROUP_FORM, permissions: new Set() };
}

export function roleFormFrom(role: AccessRole | null): RoleFormValues {
  return role
    ? {
        name: role.name,
        description: role.description ?? "",
        scope: role.scope,
        mfaRequired: role.mfaRequired,
        groupIds: new Set(role.groupIds),
      }
    : { ...EMPTY_ROLE_FORM, groupIds: new Set() };
}

export function isGroupFormDirty(initial: GroupFormValues, current: GroupFormValues): boolean {
  return (
    initial.name.trim() !== current.name.trim() ||
    initial.description.trim() !== current.description.trim() ||
    !sameSet(initial.permissions, current.permissions)
  );
}

export function isRoleFormDirty(initial: RoleFormValues, current: RoleFormValues): boolean {
  return (
    initial.name.trim() !== current.name.trim() ||
    initial.description.trim() !== current.description.trim() ||
    initial.scope !== current.scope ||
    initial.mfaRequired !== current.mfaRequired ||
    !sameSet(initial.groupIds, current.groupIds)
  );
}

export type CheckState = "all" | "some" | "none";

export function resourceKeys(resource: PermissionResource): string[] {
  return resource.actions.map((action) => `${resource.resource}:${action.action}`);
}

/** État de la case « tout » d'une ressource, en ne comptant que ce que l'acteur a le droit de choisir. */
export function resourceState(
  resource: PermissionResource,
  selected: ReadonlySet<string>,
  held: ReadonlySet<string>,
): CheckState {
  const keys = resourceKeys(resource).filter((key) => held.has(key) || selected.has(key));
  const count = keys.filter((key) => selected.has(key)).length;
  if (count === 0) return "none";
  return count === keys.length ? "all" : "some";
}

/** Coche ou décoche toute une ressource, sans jamais accorder un droit que l'acteur ne détient pas. */
export function setResourceChecked(
  resource: PermissionResource,
  selected: ReadonlySet<string>,
  held: ReadonlySet<string>,
  checked: boolean,
): Set<string> {
  const next = new Set(selected);
  for (const key of resourceKeys(resource)) {
    if (checked && held.has(key)) next.add(key);
    if (!checked) next.delete(key);
  }
  return next;
}

/** Ressources dont le libellé ou une action correspond à la recherche (sans accents ni casse). */
export function filterResources(
  resources: readonly PermissionResource[],
  query: string,
): PermissionResource[] {
  const normalize = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = normalize(query.trim());
  if (!q) return [...resources];
  return resources
    .map((resource) =>
      normalize(resource.label).includes(q)
        ? resource
        : {
            ...resource,
            actions: resource.actions.filter((action) => normalize(action.label).includes(q)),
          },
    )
    .filter((resource) => resource.actions.length > 0);
}

/** Groupes qui contiennent un droit que l'acteur n'a pas : il ne peut pas les attribuer. */
export function groupBeyondActor(
  group: Pick<PermissionGroup, "permissions">,
  held: ReadonlySet<string>,
): boolean {
  return group.permissions.some((key) => !held.has(key));
}

/** Permissions obtenues par un rôle à partir des groupes choisis. */
export function permissionsOfGroups(
  groups: readonly PermissionGroup[],
  groupIds: ReadonlySet<string>,
): string[] {
  const all = new Set<string>();
  for (const group of groups) {
    if (groupIds.has(group.id)) group.permissions.forEach((key) => all.add(key));
  }
  return [...all].sort();
}

/** Rôles qui utilisent un groupe. */
export function rolesUsingGroup(roles: readonly AccessRole[], groupId: string): AccessRole[] {
  return roles.filter((role) => role.groupIds.includes(groupId));
}
