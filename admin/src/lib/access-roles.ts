import type { AccessRole, AccessScope, PermissionResource } from "./access";
import { SCOPE_LABELS } from "./access";

/** Résumé des accès d'un rôle pour un domaine (ressource du catalogue : Pointages, Badges…). */
export interface DomainSummary {
  resource: string;
  label: string;
  /** Libellés des actions accordées dans ce domaine. */
  actions: string[];
}

/** Domaines couverts par les permissions d'un rôle, dans l'ordre du catalogue. */
export function summarizeAccess(
  permissions: readonly string[],
  resources: readonly PermissionResource[],
): DomainSummary[] {
  const held = new Set(permissions);
  const summary: DomainSummary[] = [];
  for (const resource of resources) {
    const actions = resource.actions
      .filter((action) => held.has(`${resource.resource}:${action.action}`))
      .map((action) => action.label);
    if (actions.length > 0) {
      summary.push({ resource: resource.resource, label: resource.label, actions });
    }
  }
  return summary;
}

export interface RoleFilters {
  q: string;
  scope: AccessScope | "";
  mfa: "" | "avec" | "sans";
  usage: "" | "utilises" | "inutilises";
}

export const EMPTY_ROLE_FILTERS: RoleFilters = { q: "", scope: "", mfa: "", usage: "" };

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function filterRoles(roles: readonly AccessRole[], filters: RoleFilters): AccessRole[] {
  const q = normalize(filters.q.trim());
  return roles.filter((role) => {
    if (q && !normalize(`${role.name} ${role.description ?? ""}`).includes(q)) return false;
    if (filters.scope && role.scope !== filters.scope) return false;
    if (filters.mfa === "avec" && !role.mfaRequired) return false;
    if (filters.mfa === "sans" && role.mfaRequired) return false;
    if (filters.usage === "utilises" && role.userCount === 0) return false;
    if (filters.usage === "inutilises" && role.userCount > 0) return false;
    return true;
  });
}

export function hasActiveFilters(filters: RoleFilters): boolean {
  return Boolean(filters.q.trim() || filters.scope || filters.mfa || filters.usage);
}

export interface RolePatch {
  name?: string;
  description?: string | null;
  scope?: AccessScope;
  mfaRequired?: boolean;
}

/**
 * Message de confirmation à afficher avant d'appliquer une modification, ou null si elle peut partir
 * directement : tout changement d'un rôle système, et tout retrait de l'exigence MFA, demandent un accord.
 */
export function confirmationFor(role: AccessRole, patch: RolePatch): string | null {
  const parts: string[] = [];
  if (patch.mfaRequired === false && role.mfaRequired) {
    parts.push("La double authentification ne sera plus exigée pour ce rôle.");
  }
  if (patch.scope !== undefined && patch.scope !== role.scope) {
    parts.push(
      `La portée passera de « ${SCOPE_LABELS[role.scope]} » à « ${SCOPE_LABELS[patch.scope]} ».`,
    );
  }
  if (role.isSystem) {
    if (parts.length === 0) parts.push("Vous modifiez les informations d'un rôle système.");
    parts.push("C'est un rôle système, utilisé par défaut dans l'application.");
  }
  if (parts.length === 0) return null;
  if (role.userCount > 0) {
    parts.push(
      `${role.userCount} utilisateur${role.userCount > 1 ? "s" : ""} concerné${role.userCount > 1 ? "s" : ""}.`,
    );
  }
  return parts.join(" ");
}

/** Nom libre pour une copie : « X (copie) », puis « X (copie 2) »… */
export function copyName(name: string, existing: readonly string[]): string {
  const taken = new Set(existing.map((n) => n.toLowerCase()));
  let candidate = `${name} (copie)`;
  for (let i = 2; taken.has(candidate.toLowerCase()); i++) candidate = `${name} (copie ${i})`;
  return candidate;
}
