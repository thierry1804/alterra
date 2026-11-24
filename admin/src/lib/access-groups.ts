import type { AccessRole, PermissionGroup, PermissionResource } from "./access";
import { groupDomain } from "./access-matrix";

export interface GroupFilters {
  q: string;
  domain: string;
  kind: "" | "systeme" | "personnalise";
  usage: "" | "utilises" | "inutilises";
}

export const EMPTY_GROUP_FILTERS: GroupFilters = { q: "", domain: "", kind: "", usage: "" };

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function filterGroups(
  groups: readonly PermissionGroup[],
  resources: readonly PermissionResource[],
  filters: GroupFilters,
): PermissionGroup[] {
  const q = normalize(filters.q.trim());
  return groups.filter((group) => {
    if (q && !normalize(`${group.name} ${group.description ?? ""}`).includes(q)) return false;
    if (filters.domain && groupDomain(group, resources) !== filters.domain) return false;
    if (filters.kind === "systeme" && !group.isSystem) return false;
    if (filters.kind === "personnalise" && group.isSystem) return false;
    if (filters.usage === "utilises" && group.roleCount === 0) return false;
    if (filters.usage === "inutilises" && group.roleCount > 0) return false;
    return true;
  });
}

export function hasActiveGroupFilters(filters: GroupFilters): boolean {
  return Boolean(filters.q.trim() || filters.domain || filters.kind || filters.usage);
}

/** Domaines présents, dans l'ordre alphabétique : options du filtre. */
export function groupDomains(
  groups: readonly PermissionGroup[],
  resources: readonly PermissionResource[],
): string[] {
  return [...new Set(groups.map((group) => groupDomain(group, resources)))].sort((a, b) =>
    a.localeCompare(b, "fr"),
  );
}

/** Nom libre pour la copie d'un groupe. */
export function copyGroupName(name: string, existing: readonly string[]): string {
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  let candidate = `${name} (copie)`;
  for (let i = 2; taken.has(candidate.toLowerCase()); i++) candidate = `${name} (copie ${i})`;
  return candidate;
}

/** Pourquoi un groupe ne peut pas être supprimé, ou null s'il peut l'être. */
export function groupDeleteBlock(
  group: PermissionGroup,
  roles: readonly AccessRole[],
): string | null {
  if (group.isSystem) return "Groupe système : suppression impossible";
  const using = roles.filter((role) => role.groupIds.includes(group.id)).length;
  if (using > 0) return `Utilisé par ${using} rôle${using > 1 ? "s" : ""}`;
  return null;
}
