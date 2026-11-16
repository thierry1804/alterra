import { beforeAll, describe, expect, it } from "vitest";
import { basePrisma } from "../lib/prisma-base.js";
import {
  SYSTEM_GROUPS,
  SYSTEM_ROLES,
  systemRolePermissions,
  type SystemRole,
} from "../services/access/system-roles.js";

function role(code: SystemRole["code"]): SystemRole {
  return SYSTEM_ROLES.find((entry) => entry.code === code)!;
}

function permissionsOf(code: SystemRole["code"]): string[] {
  return [...systemRolePermissions(role(code).id)];
}

describe("roles of the cahier matrix", () => {
  it("defines the eight system roles with unique ids and names", () => {
    expect(SYSTEM_ROLES).toHaveLength(8);
    expect(new Set(SYSTEM_ROLES.map((entry) => entry.id)).size).toBe(8);
    expect(new Set(SYSTEM_ROLES.map((entry) => entry.name)).size).toBe(8);
  });

  it("only references groups that exist", () => {
    const known = new Set(SYSTEM_GROUPS.map((group) => group.code));
    for (const entry of SYSTEM_ROLES) {
      expect(entry.groups.filter((code) => !known.has(code))).toEqual([]);
    }
  });

  it("gives the five new roles every site and requires MFA only for the money roles", () => {
    const newRoles = [
      "RESPONSABLE_TECHNIQUE",
      "FINANCE",
      "DG",
      "TRESORERIE",
      "CONSULTATION",
    ] as const;
    for (const code of newRoles) expect(role(code).scope).toBe("TOUS");
    expect(newRoles.filter((code) => role(code).mfaRequired)).toEqual([
      "FINANCE",
      "DG",
      "TRESORERIE",
    ]);
  });

  it("keeps the responsable technique away from money", () => {
    const keys = permissionsOf("RESPONSABLE_TECHNIQUE");
    expect(keys).toContain("pointage:lecture");
    expect(
      keys.filter((key) => /^(paiement|facture|bordereau|tableau_bord|rapport):/.test(key)),
    ).toEqual([]);
    expect(keys.filter((key) => /:(ecriture|suppression|generation|saisie)$/.test(key))).toEqual(
      [],
    );
  });

  it("makes the consultation role strictly read-only", () => {
    const keys = permissionsOf("CONSULTATION");
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => !/:(lecture|analyse)$/.test(key))).toEqual([]);
  });

  it("limits the trésorerie to exporting and reading invoices", () => {
    expect(permissionsOf("TRESORERIE").sort()).toEqual(["facture:lecture", "paiement:export"]);
  });

  it("never lets one role hold both bordereau validations", () => {
    for (const entry of SYSTEM_ROLES) {
      expect(entry.groups.includes("G31") && entry.groups.includes("G32")).toBe(false);
    }
    expect(role("FINANCE").groups).toContain("G31");
    expect(role("DG").groups).toContain("G32");
  });

  it("attaches the dedicated groups future tickets will fill", () => {
    expect(role("RESPONSABLE_TECHNIQUE").groups).toEqual(expect.arrayContaining(["G05", "G06"]));
    expect(role("CONSULTATION").groups).toEqual(expect.arrayContaining(["G06", "G29"]));
    expect(role("TRESORERIE").groups).toContain("G29");
    expect(
      SYSTEM_GROUPS.filter((group) =>
        ["G05", "G06", "G29", "G31", "G32"].includes(group.code),
      ).every((group) => group.permissions.length === 0),
    ).toBe(true);
  });

  it("leaves the three original roles unchanged", () => {
    expect(role("ADMIN").groups).toHaveLength(33);
    expect(role("CHEF_SERVICE").groups).toHaveLength(13);
    expect(role("CHEF_EQUIPE").groups).toHaveLength(8);
  });
});

describe("system roles match the database", () => {
  let dbReady = false;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) return;
    try {
      await basePrisma.$queryRaw`SELECT 1`;
      dbReady = true;
    } catch {
      dbReady = false;
    }
  });

  it("has the same groups and permissions as the code", async ({ skip }) => {
    if (!dbReady) skip();
    const rows = await basePrisma.permissionGroup.findMany({
      where: { isSystem: true },
      include: { permissions: true },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    for (const group of SYSTEM_GROUPS) {
      const row = byId.get(group.id);
      expect(row?.name, group.code).toBe(group.name);
      expect(row?.permissions.map((entry) => entry.permissionKey).sort(), group.code).toEqual(
        [...group.permissions].sort(),
      );
    }
  });

  it("has the same roles, scopes, MFA flags and groups as the code", async ({ skip }) => {
    if (!dbReady) skip();
    const rows = await basePrisma.accessRole.findMany({
      where: { isSystem: true },
      include: { groups: true },
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const groupIdByCode = new Map(SYSTEM_GROUPS.map((group) => [group.code, group.id]));
    for (const entry of SYSTEM_ROLES) {
      const row = byId.get(entry.id);
      expect(row?.name, entry.code).toBe(entry.name);
      expect(row?.scope, entry.code).toBe(entry.scope);
      expect(row?.mfaRequired, entry.code).toBe(entry.mfaRequired);
      expect(row?.groups.map((link) => link.groupId).sort(), entry.code).toEqual(
        entry.groups.map((code) => groupIdByCode.get(code)!).sort(),
      );
    }
  });
});
