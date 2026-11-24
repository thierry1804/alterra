import { describe, expect, it } from "vitest";
import type { PermissionGroup, PermissionResource } from "./access";
import {
  OTHER_DOMAIN,
  buildSections,
  groupDomain,
  groupShortName,
  permissionLabelList,
  withGroupToggled,
} from "./access-matrix";

const resources: PermissionResource[] = [
  { resource: "pointage", label: "Pointages", actions: [{ action: "lecture", label: "Voir" }] },
  { resource: "audit", label: "Journal d'audit", actions: [{ action: "lecture", label: "Lire" }] },
];

function group(
  name: string,
  permissions: string[],
  description: string | null = null,
): PermissionGroup {
  return { id: name, name, description, isSystem: true, permissions, roleCount: 0 };
}

describe("groupDomain", () => {
  it("prend le préfixe du nom", () => {
    expect(groupDomain(group("Badges — gestion", ["badge:ecriture"]), resources)).toBe("Badges");
  });

  it("retombe sur le libellé de la ressource unique", () => {
    expect(groupDomain(group("Audit", ["audit:lecture"]), resources)).toBe("Journal d'audit");
    expect(groupDomain(group("Synthèses", ["pointage:lecture"]), resources)).toBe("Pointages");
  });

  it("classe le reste dans Autres", () => {
    expect(groupDomain(group("Présence terrain", ["presence:x", "biometrie:y"]), resources)).toBe(
      OTHER_DOMAIN,
    );
    expect(groupDomain(group("Vide", []), resources)).toBe(OTHER_DOMAIN);
  });
});

describe("buildSections", () => {
  const groups = [
    group("Pointages — validation", ["pointage:lecture"]),
    group("Badges — gestion", ["badge:x"]),
    group("Pointages — consultation", ["pointage:lecture"]),
    group("Présence terrain", ["presence:x", "biometrie:y"]),
  ];

  it("regroupe par domaine, trie, et place Autres en dernier", () => {
    const sections = buildSections(groups, resources);
    expect(sections.map((s) => s.domain)).toEqual(["Badges", "Pointages", OTHER_DOMAIN]);
    expect(sections[1].groups.map((g) => g.name)).toEqual([
      "Pointages — consultation",
      "Pointages — validation",
    ]);
  });

  it("filtre par recherche sans accents ni casse, sur le domaine ou le nom", () => {
    expect(buildSections(groups, resources, "POINTAGE").map((s) => s.domain)).toEqual([
      "Pointages",
    ]);
    expect(
      buildSections(groups, resources, "presence").flatMap((s) => s.groups.map((g) => g.name)),
    ).toEqual(["Présence terrain"]);
    expect(buildSections(groups, resources, "zzz")).toEqual([]);
  });
});

describe("helpers", () => {
  it("coche et décoche sans doublon", () => {
    expect(withGroupToggled(["a"], "b", true)).toEqual(["a", "b"]);
    expect(withGroupToggled(["a", "b"], "b", true)).toEqual(["a", "b"]);
    expect(withGroupToggled(["a", "b"], "a", false)).toEqual(["b"]);
  });

  it("donne un nom court et les libellés de permissions", () => {
    expect(groupShortName({ name: "Badges — gestion" })).toBe("Gestion");
    expect(groupShortName({ name: "Audit" })).toBe("Audit");
    expect(permissionLabelList(["pointage:lecture", "x:y"], resources)).toEqual(["Voir", "x:y"]);
  });
});
