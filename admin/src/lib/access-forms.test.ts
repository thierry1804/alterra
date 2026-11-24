import { describe, expect, it } from "vitest";
import type { AccessRole, PermissionGroup, PermissionResource } from "./access";
import {
  filterResources,
  groupBeyondActor,
  groupFormFrom,
  isGroupFormDirty,
  isRoleFormDirty,
  permissionsOfGroups,
  resourceState,
  roleFormFrom,
  rolesUsingGroup,
  setResourceChecked,
  validateName,
} from "./access-forms";

const resource: PermissionResource = {
  resource: "pointage",
  label: "Pointages",
  actions: [
    { action: "lecture", label: "Voir les pointages" },
    { action: "saisie", label: "Saisir des pointages" },
    { action: "correction", label: "Corriger un pointage" },
  ],
};

describe("validateName", () => {
  const existing = [
    { id: "1", name: "Finance" },
    { id: "2", name: "DG" },
  ];
  it("refuse trop court, trop long et déjà pris (casse ignorée)", () => {
    expect(validateName(" a ", existing)).toBe("Au moins 2 caractères.");
    expect(validateName("x".repeat(61), existing)).toBe("60 caractères au maximum.");
    expect(validateName("finance", existing)).toBe("Ce nom est déjà utilisé.");
  });
  it("accepte un nom libre ou le nom actuel de l'élément édité", () => {
    expect(validateName("Comptabilité", existing)).toBeNull();
    expect(validateName("Finance", existing, "1")).toBeNull();
  });
});

describe("dirty", () => {
  it("détecte une modification ou non, en ignorant les espaces autour", () => {
    const group: PermissionGroup = {
      id: "g",
      name: "A",
      description: null,
      isSystem: false,
      permissions: ["a:b"],
      roleCount: 0,
    };
    const initial = groupFormFrom(group);
    expect(isGroupFormDirty(initial, groupFormFrom(group))).toBe(false);
    expect(isGroupFormDirty(initial, { ...initial, name: " A " })).toBe(false);
    expect(isGroupFormDirty(initial, { ...initial, permissions: new Set(["a:b", "c:d"]) })).toBe(
      true,
    );

    const role: AccessRole = {
      id: "r",
      name: "R",
      description: "d",
      isSystem: false,
      scope: "SITE",
      mfaRequired: false,
      groupIds: ["g"],
      permissions: [],
      userCount: 0,
      version: "v",
    };
    const base = roleFormFrom(role);
    expect(isRoleFormDirty(base, roleFormFrom(role))).toBe(false);
    expect(isRoleFormDirty(base, { ...base, scope: "TOUS" })).toBe(true);
    expect(isRoleFormDirty(base, { ...base, groupIds: new Set() })).toBe(true);
  });
});

describe("cases par ressource", () => {
  const held = new Set(["pointage:lecture", "pointage:saisie"]);

  it("calcule l'état en ignorant les droits que l'acteur ne détient pas", () => {
    expect(resourceState(resource, new Set(), held)).toBe("none");
    expect(resourceState(resource, new Set(["pointage:lecture"]), held)).toBe("some");
    expect(resourceState(resource, new Set(["pointage:lecture", "pointage:saisie"]), held)).toBe(
      "all",
    );
  });

  it("coche tout sans dépasser les droits de l'acteur, et décoche tout", () => {
    const all = setResourceChecked(resource, new Set(), held, true);
    expect([...all].sort()).toEqual(["pointage:lecture", "pointage:saisie"]);
    expect(setResourceChecked(resource, all, held, false).size).toBe(0);
  });

  it("garde un droit déjà accordé même si l'acteur ne le détient pas, jusqu'à ce qu'on le retire", () => {
    const selected = new Set(["pointage:correction"]);
    expect(resourceState(resource, selected, held)).toBe("some");
    expect(setResourceChecked(resource, selected, held, true).has("pointage:correction")).toBe(
      true,
    );
  });
});

describe("filterResources", () => {
  it("garde la ressource entière si son libellé correspond, sinon les actions qui correspondent", () => {
    expect(filterResources([resource], "pointages")[0].actions).toHaveLength(3);
    expect(filterResources([resource], "corriger")[0].actions.map((a) => a.action)).toEqual([
      "correction",
    ]);
    expect(filterResources([resource], "zzz")).toEqual([]);
    expect(filterResources([resource], "")).toHaveLength(1);
  });
});

describe("groupes", () => {
  const groups: PermissionGroup[] = [
    {
      id: "g1",
      name: "A",
      description: null,
      isSystem: true,
      permissions: ["a:x", "a:y"],
      roleCount: 1,
    },
    {
      id: "g2",
      name: "B",
      description: null,
      isSystem: true,
      permissions: ["a:y", "b:z"],
      roleCount: 1,
    },
  ];
  it("calcule les droits obtenus sans doublon", () => {
    expect(permissionsOfGroups(groups, new Set(["g1", "g2"]))).toEqual(["a:x", "a:y", "b:z"]);
  });
  it("repère un groupe au-delà des droits de l'acteur", () => {
    expect(groupBeyondActor(groups[1], new Set(["a:y"]))).toBe(true);
    expect(groupBeyondActor(groups[0], new Set(["a:x", "a:y"]))).toBe(false);
  });
  it("liste les rôles qui utilisent un groupe", () => {
    const roles = [
      { id: "r1", groupIds: ["g1"] },
      { id: "r2", groupIds: [] },
    ] as AccessRole[];
    expect(rolesUsingGroup(roles, "g1").map((r) => r.id)).toEqual(["r1"]);
  });
});
