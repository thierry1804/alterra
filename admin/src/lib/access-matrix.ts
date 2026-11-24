import type { PermissionGroup, PermissionResource } from "./access";

export const OTHER_DOMAIN = "Autres";

const SEPARATOR = " — ";

/**
 * Domaine d'un groupe : le préfixe de son nom (« Badges — gestion » → « Badges »), sinon le libellé
 * de sa ressource quand toutes ses permissions viennent d'une seule, sinon « Autres ».
 */
export function groupDomain(
  group: Pick<PermissionGroup, "name" | "permissions">,
  resources: readonly PermissionResource[],
): string {
  const at = group.name.indexOf(SEPARATOR);
  if (at > 0) return group.name.slice(0, at).trim();

  const keys = new Set(group.permissions.map((key) => key.split(":")[0]));
  if (keys.size === 1) {
    const [key] = [...keys];
    const label = resources.find((resource) => resource.resource === key)?.label;
    if (label) return label;
  }
  return OTHER_DOMAIN;
}

/** Nom court d'un groupe dans son domaine (« Badges — gestion » → « gestion »). */
export function groupShortName(group: Pick<PermissionGroup, "name">): string {
  const at = group.name.indexOf(SEPARATOR);
  const short = at > 0 ? group.name.slice(at + SEPARATOR.length).trim() : group.name;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

export interface MatrixSection {
  domain: string;
  groups: PermissionGroup[];
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Groupes regroupés par domaine (ordre alphabétique, « Autres » en dernier), filtrés par la recherche. */
export function buildSections(
  groups: readonly PermissionGroup[],
  resources: readonly PermissionResource[],
  query = "",
): MatrixSection[] {
  const q = normalize(query.trim());
  const byDomain = new Map<string, PermissionGroup[]>();
  for (const group of groups) {
    const domain = groupDomain(group, resources);
    if (q && !normalize(`${domain} ${group.name} ${group.description ?? ""}`).includes(q)) continue;
    byDomain.set(domain, [...(byDomain.get(domain) ?? []), group]);
  }
  return [...byDomain.entries()]
    .map(([domain, list]) => ({
      domain,
      groups: [...list].sort((a, b) => a.name.localeCompare(b.name, "fr")),
    }))
    .sort((a, b) => {
      if (a.domain === OTHER_DOMAIN) return 1;
      if (b.domain === OTHER_DOMAIN) return -1;
      return a.domain.localeCompare(b.domain, "fr");
    });
}

/** Nouvelle liste de groupes d'un rôle après avoir coché ou décoché un groupe. */
export function withGroupToggled(
  groupIds: readonly string[],
  groupId: string,
  checked: boolean,
): string[] {
  const without = groupIds.filter((id) => id !== groupId);
  return checked ? [...without, groupId] : without;
}

/** Libellés des permissions d'un groupe, pour l'infobulle (« Pointages : Voir… »). */
export function permissionLabelList(
  permissions: readonly string[],
  resources: readonly PermissionResource[],
): string[] {
  const labels = new Map<string, string>();
  for (const resource of resources) {
    for (const action of resource.actions) {
      labels.set(`${resource.resource}:${action.action}`, action.label);
    }
  }
  return permissions.map((key) => labels.get(key) ?? key);
}
