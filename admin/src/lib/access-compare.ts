import type { AccessRole, AccessScope, PermissionGroup, PermissionResource } from "./access";
import { buildSections } from "./access-matrix";

export interface CompareRow {
  group: PermissionGroup;
  inA: boolean;
  inB: boolean;
}

export interface CompareSection {
  domain: string;
  rows: CompareRow[];
}

export interface RoleComparison {
  scope: { a: AccessScope; b: AccessScope; same: boolean };
  mfa: { a: boolean; b: boolean; same: boolean };
  common: number;
  onlyA: number;
  onlyB: number;
  sections: CompareSection[];
}

/** Compare les groupes, la portée et le MFA de deux rôles ; `onlyDifferences` ne garde que ce qui diffère. */
export function compareRoles(
  a: AccessRole,
  b: AccessRole,
  groups: readonly PermissionGroup[],
  resources: readonly PermissionResource[],
  onlyDifferences = false,
): RoleComparison {
  const inA = new Set(a.groupIds);
  const inB = new Set(b.groupIds);

  let common = 0;
  let onlyA = 0;
  let onlyB = 0;
  const sections: CompareSection[] = [];

  for (const section of buildSections(groups, resources)) {
    const rows = section.groups
      .map((group) => ({ group, inA: inA.has(group.id), inB: inB.has(group.id) }))
      .filter((row) => row.inA || row.inB);
    for (const row of rows) {
      if (row.inA && row.inB) common++;
      else if (row.inA) onlyA++;
      else onlyB++;
    }
    const kept = onlyDifferences ? rows.filter((row) => row.inA !== row.inB) : rows;
    if (kept.length > 0) sections.push({ domain: section.domain, rows: kept });
  }

  return {
    scope: { a: a.scope, b: b.scope, same: a.scope === b.scope },
    mfa: { a: a.mfaRequired, b: b.mfaRequired, same: a.mfaRequired === b.mfaRequired },
    common,
    onlyA,
    onlyB,
    sections,
  };
}
