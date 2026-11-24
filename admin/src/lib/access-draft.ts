import type { AccessRole, PermissionGroup } from "./access";
import { SCOPE_LABELS } from "./access";
import { confirmationFor, type RolePatch } from "./access-roles";

/** Champs d'un rôle modifiables depuis l'écran. */
export type RoleField = "name" | "description" | "scope" | "mfaRequired" | "groupIds";

/** Modification en attente pour un rôle, avec la version du rôle au moment de la première édition. */
export interface DraftEntry {
  patch: RolePatch;
  version: string;
}

export type RolesDraft = Record<string, DraftEntry>;

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((item) => set.has(item));
}

/** Retire de `patch` tout champ qui redonne la valeur d'origine : annuler à la main efface la modification. */
export function normalizePatch(base: AccessRole, patch: RolePatch): RolePatch {
  const next: RolePatch = {};
  if (patch.name !== undefined && patch.name !== base.name) next.name = patch.name;
  if (
    patch.description !== undefined &&
    (patch.description ?? null) !== (base.description ?? null)
  ) {
    next.description = patch.description;
  }
  if (patch.scope !== undefined && patch.scope !== base.scope) next.scope = patch.scope;
  if (patch.mfaRequired !== undefined && patch.mfaRequired !== base.mfaRequired) {
    next.mfaRequired = patch.mfaRequired;
  }
  if (patch.groupIds !== undefined && !sameSet(patch.groupIds, base.groupIds)) {
    next.groupIds = patch.groupIds;
  }
  return next;
}

export function isEmptyPatch(patch: RolePatch): boolean {
  return Object.keys(patch).length === 0;
}

/** Ajoute une édition au brouillon ; une édition qui revient à l'état d'origine retire l'entrée. */
export function editDraft(
  draft: RolesDraft,
  base: AccessRole,
  edit: RolePatch | ((current: AccessRole) => RolePatch),
): RolesDraft {
  const previous = draft[base.id];
  const current = applyPatch(base, previous?.patch ?? {});
  const change = typeof edit === "function" ? edit(current) : edit;
  const merged = normalizePatch(base, { ...(previous?.patch ?? {}), ...change });
  const next = { ...draft };
  if (isEmptyPatch(merged)) delete next[base.id];
  else next[base.id] = { patch: merged, version: previous?.version ?? base.version };
  return next;
}

/** Rôle tel qu'il serait une fois `patch` appliqué (permissions recalculées si les groupes changent). */
export function applyPatch(
  role: AccessRole,
  patch: RolePatch,
  groups: readonly PermissionGroup[] = [],
): AccessRole {
  if (isEmptyPatch(patch)) return role;
  const next: AccessRole = {
    ...role,
    ...patch,
    description: patch.description ?? role.description,
  };
  if (patch.description === null) next.description = null;
  if (patch.groupIds && groups.length > 0) {
    const chosen = new Set(patch.groupIds);
    const permissions = new Set<string>();
    for (const group of groups) {
      if (chosen.has(group.id)) group.permissions.forEach((key) => permissions.add(key));
    }
    next.permissions = [...permissions].sort();
  }
  return next;
}

/** Nombre de modifications unitaires : un champ = 1, un groupe ajouté ou retiré = 1. */
export function countChanges(draft: RolesDraft, roles: readonly AccessRole[]): number {
  let total = 0;
  for (const role of roles) {
    const entry = draft[role.id];
    if (!entry) continue;
    const { patch } = entry;
    total += (["name", "description", "scope", "mfaRequired"] as const).filter(
      (field) => patch[field] !== undefined,
    ).length;
    if (patch.groupIds) {
      const before = new Set(role.groupIds);
      const after = new Set(patch.groupIds);
      total += [...after].filter((id) => !before.has(id)).length;
      total += [...before].filter((id) => !after.has(id)).length;
    }
  }
  return total;
}

export function changedFields(patch: RolePatch | undefined): Set<RoleField> {
  return new Set((patch ? Object.keys(patch) : []) as RoleField[]);
}

export interface ChangeLine {
  kind: "field" | "added" | "removed";
  text: string;
}

const quote = (text: string | null | undefined) => (text ? `« ${text} »` : "vide");

/** Lignes lisibles du diff d'un rôle, pour le résumé avant enregistrement. */
export function describeChanges(
  role: AccessRole,
  patch: RolePatch,
  groups: readonly PermissionGroup[],
): ChangeLine[] {
  const lines: ChangeLine[] = [];
  if (patch.name !== undefined) {
    lines.push({ kind: "field", text: `Nom : ${quote(role.name)} → ${quote(patch.name)}` });
  }
  if (patch.description !== undefined) {
    lines.push({
      kind: "field",
      text: `Description : ${quote(role.description)} → ${quote(patch.description)}`,
    });
  }
  if (patch.scope !== undefined) {
    lines.push({
      kind: "field",
      text: `Portée : ${SCOPE_LABELS[role.scope]} → ${SCOPE_LABELS[patch.scope]}`,
    });
  }
  if (patch.mfaRequired !== undefined) {
    lines.push({
      kind: "field",
      text: `MFA : ${role.mfaRequired ? "exigée" : "non exigée"} → ${patch.mfaRequired ? "exigée" : "non exigée"}`,
    });
  }
  if (patch.groupIds) {
    const before = new Set(role.groupIds);
    const after = new Set(patch.groupIds);
    const name = (id: string) => groups.find((group) => group.id === id)?.name ?? id;
    for (const id of patch.groupIds.filter((groupId) => !before.has(groupId))) {
      lines.push({ kind: "added", text: name(id) });
    }
    for (const id of role.groupIds.filter((groupId) => !after.has(groupId))) {
      lines.push({ kind: "removed", text: name(id) });
    }
  }
  return lines;
}

/** Vrai si l'enregistrement de ce rôle demande une confirmation explicite (rôle système, MFA retirée). */
export function needsExplicitConfirmation(role: AccessRole, patch: RolePatch): boolean {
  return confirmationFor(role, patch) !== null && (role.isSystem || patch.mfaRequired === false);
}

/** Corps de la requête de sauvegarde groupée. */
export function toChanges(draft: RolesDraft) {
  return Object.entries(draft).map(([roleId, entry]) => ({
    roleId,
    expectedVersion: entry.version,
    ...entry.patch,
  }));
}

/** Modifications qui remettent les rôles dans l'état précédent, pour « Annuler » après l'enregistrement. */
export function inverseChanges(before: readonly AccessRole[], after: readonly AccessRole[]) {
  return before.map((previous, index) => {
    const current = after[index];
    const change: { roleId: string; expectedVersion: string } & RolePatch = {
      roleId: previous.id,
      expectedVersion: current.version,
    };
    if (previous.name !== current.name) change.name = previous.name;
    if ((previous.description ?? null) !== (current.description ?? null)) {
      change.description = previous.description;
    }
    if (previous.scope !== current.scope) change.scope = previous.scope;
    if (previous.mfaRequired !== current.mfaRequired) change.mfaRequired = previous.mfaRequired;
    if (!sameSet(previous.groupIds, current.groupIds)) change.groupIds = previous.groupIds;
    return change;
  });
}
