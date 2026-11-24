import { describe, expect, it } from "vitest";
import type { AccessRole, PermissionResource } from "./access";
import {
  EMPTY_ROLE_FILTERS,
  confirmationFor,
  copyName,
  filterRoles,
  hasActiveFilters,
  summarizeAccess,
} from "./access-roles";

const resources: PermissionResource[] = [
  {
    resource: "pointage",
    label: "Pointages",
    actions: [
      { action: "lecture", label: "Voir" },
      { action: "saisie", label: "Saisir" },
    ],
  },
  { resource: "badge", label: "Badges", actions: [{ action: "lecture", label: "Voir" }] },
];

function role(overrides: Partial<AccessRole> = {}): AccessRole {
  return {
    id: "r1",
    name: "Chef de service",
    description: "Valide les pointages du site",
    isSystem: false,
    scope: "SITE",
    mfaRequired: false,
    groupIds: [],
    permissions: [],
    userCount: 0,
    ...overrides,
  };
}

describe("summarizeAccess", () => {
  it("regroupe par domaine dans l'ordre du catalogue", () => {
    const summary = summarizeAccess(["badge:lecture", "pointage:saisie"], resources);
    expect(summary.map((d) => d.label)).toEqual(["Pointages", "Badges"]);
    expect(summary[0].actions).toEqual(["Saisir"]);
  });

  it("ignore les domaines sans permission et les clés inconnues", () => {
    expect(summarizeAccess(["inconnu:x"], resources)).toEqual([]);
  });
});

describe("filterRoles", () => {
  const roles = [
    role({ id: "a", name: "Administrateur", scope: "TOUS", mfaRequired: true, userCount: 1 }),
    role({ id: "b", name: "Consultation", scope: "TOUS", userCount: 0 }),
    role({ id: "c", name: "Chef d'équipe", scope: "EQUIPE", userCount: 15 }),
  ];

  it("filtre sur le texte sans tenir compte des accents ni de la casse", () => {
    expect(filterRoles(roles, { ...EMPTY_ROLE_FILTERS, q: "EQUIPE" }).map((r) => r.id)).toEqual([
      "c",
    ]);
    expect(filterRoles(roles, { ...EMPTY_ROLE_FILTERS, q: "équipe" }).map((r) => r.id)).toEqual([
      "c",
    ]);
  });

  it("combine portée, MFA et usage", () => {
    expect(
      filterRoles(roles, { ...EMPTY_ROLE_FILTERS, scope: "TOUS", mfa: "sans" }).map((r) => r.id),
    ).toEqual(["b"]);
    expect(
      filterRoles(roles, { ...EMPTY_ROLE_FILTERS, usage: "inutilises" }).map((r) => r.id),
    ).toEqual(["b"]);
    expect(filterRoles(roles, { ...EMPTY_ROLE_FILTERS, mfa: "avec" }).map((r) => r.id)).toEqual([
      "a",
    ]);
  });

  it("détecte les filtres actifs", () => {
    expect(hasActiveFilters(EMPTY_ROLE_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_ROLE_FILTERS, q: " x " })).toBe(true);
  });
});

describe("confirmationFor", () => {
  it("ne demande rien pour un rôle personnalisé sans impact sensible", () => {
    expect(confirmationFor(role(), { name: "Autre" })).toBeNull();
    expect(confirmationFor(role(), { mfaRequired: true })).toBeNull();
  });

  it("demande confirmation au retrait du MFA, avec l'impact", () => {
    const message = confirmationFor(role({ mfaRequired: true, userCount: 6 }), {
      mfaRequired: false,
    });
    expect(message).toContain("plus exigée");
    expect(message).toContain("6 utilisateurs concernés");
  });

  it("demande confirmation pour tout changement d'un rôle système", () => {
    expect(confirmationFor(role({ isSystem: true }), { description: "x" })).toContain(
      "rôle système",
    );
    expect(confirmationFor(role({ isSystem: true, scope: "SITE" }), { scope: "TOUS" })).toContain(
      "« Son site » à « Tous les sites »",
    );
  });
});

describe("copyName", () => {
  it("trouve un nom libre", () => {
    expect(copyName("Finance", ["Finance"])).toBe("Finance (copie)");
    expect(copyName("Finance", ["Finance", "Finance (copie)"])).toBe("Finance (copie 2)");
  });
});
