import { describe, expect, it } from "vitest";
import type { AccessRole, PermissionGroup } from "./access";
import { compareRoles } from "./access-compare";
import { lacksMfaOnSensitive, sensitiveLabels, sensitivePermissionsOf } from "./access-sensitive";

function group(id: string, name: string): PermissionGroup {
  return { id, name, description: null, isSystem: true, permissions: [], roleCount: 0 };
}
const groups = [
  group("g1", "Badges — gestion"),
  group("g2", "Pointages — lecture"),
  group("g3", "Pointages — correction"),
  group("g4", "Audit"),
];

function role(overrides: Partial<AccessRole>): AccessRole {
  return {
    id: "r",
    name: "R",
    description: null,
    isSystem: false,
    scope: "SITE",
    mfaRequired: false,
    groupIds: [],
    permissions: [],
    userCount: 0,
    version: "v1",
    ...overrides,
  };
}

describe("compareRoles", () => {
  const a = role({ id: "a", groupIds: ["g1", "g2"], scope: "SITE" });
  const b = role({ id: "b", groupIds: ["g2", "g3"], scope: "TOUS", mfaRequired: true });

  it("compte les groupes communs et propres à chaque rôle", () => {
    const result = compareRoles(a, b, groups, []);
    expect(result).toMatchObject({ common: 1, onlyA: 1, onlyB: 1 });
    expect(result.scope).toEqual({ a: "SITE", b: "TOUS", same: false });
    expect(result.mfa.same).toBe(false);
  });

  it("ignore les groupes qu'aucun des deux rôles n'a", () => {
    const rows = compareRoles(a, b, groups, []).sections.flatMap((s) =>
      s.rows.map((r) => r.group.id),
    );
    expect(rows.sort()).toEqual(["g1", "g2", "g3"]);
  });

  it("ne garde que les différences à la demande, et retire les domaines sans différence", () => {
    const result = compareRoles(a, b, groups, [], true);
    expect(result.sections.map((s) => s.domain)).toEqual(["Badges", "Pointages"]);
    expect(result.sections.flatMap((s) => s.rows.map((r) => r.group.id)).sort()).toEqual([
      "g1",
      "g3",
    ]);
  });

  it("signale deux rôles identiques", () => {
    const result = compareRoles(a, a, groups, [], true);
    expect(result.sections).toEqual([]);
    expect(result).toMatchObject({ onlyA: 0, onlyB: 0, common: 2 });
  });
});

describe("droits sensibles sans MFA", () => {
  const resources = [
    {
      resource: "paiement",
      label: "Paiements",
      actions: [{ action: "export", label: "Exporter vers MVola" }],
    },
  ];

  it("repère un rôle qui valide ou paie sans exiger la MFA", () => {
    const r = role({ permissions: ["pointage:lecture", "paiement:export"] });
    expect(sensitivePermissionsOf(r)).toEqual(["paiement:export"]);
    expect(lacksMfaOnSensitive(r)).toBe(true);
    expect(sensitiveLabels(r, resources)).toEqual(["Exporter vers MVola"]);
  });

  it("ne dit rien si la MFA est exigée ou si le rôle n'a aucun droit sensible", () => {
    expect(lacksMfaOnSensitive(role({ permissions: ["paiement:export"], mfaRequired: true }))).toBe(
      false,
    );
    expect(lacksMfaOnSensitive(role({ permissions: ["pointage:lecture"] }))).toBe(false);
  });
});
