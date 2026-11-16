import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { resetRedisForTests, areTokensRevoked } from "../lib/redis.js";
import {
  getRoleAccess,
  setRoleAccessLoader,
  type RoleAccess,
} from "../services/access/access.service.js";
import {
  SYSTEM_ROLES,
  SYSTEM_ROLE_IDS,
  systemRolePermissions,
} from "../services/access/system-roles.js";

const MOCK_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_CDS_ID = "00000000-0000-4000-8000-000000000002";
const MOCK_USER_ID = "00000000-0000-4000-8000-000000000050";
const MOCK_GROUP_ID = "00000000-0000-4000-8000-0000000000a1";
const MOCK_ROLE_ID = "00000000-0000-4000-8000-0000000000b1";
const LIMITED_MANAGER_ROLE_ID = "00000000-0000-4000-8000-0000000000aa";

vi.mock("../lib/prisma.js", () => {
  const db = {
    permissionGroup: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    accessRole: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: { findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    activityRequest: { findMany: vi.fn(), findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));
  return { prisma: db, basePrisma: db };
});

vi.mock("../lib/prisma-base.js", () => ({ basePrisma: { auditLog: { create: vi.fn() } } }));

import { basePrisma } from "../lib/prisma.js";
import { basePrisma as auditClient } from "../lib/prisma-base.js";

function token(sub: string, roleId: string, siteId: string | null = null) {
  return `Bearer ${signAccessToken({ sub, roleId, siteId, teamId: null })}`;
}

const adminHeader = () => token(MOCK_ADMIN_ID, SYSTEM_ROLE_IDS.ADMIN);
const cdsHeader = () => token(MOCK_CDS_ID, SYSTEM_ROLE_IDS.CHEF_SERVICE);
const managerHeader = () => token("00000000-0000-4000-8000-000000000003", LIMITED_MANAGER_ROLE_ID);

function groupRow(overrides: Record<string, unknown> = {}) {
  return {
    id: MOCK_GROUP_ID,
    name: "Groupe test",
    description: null,
    isSystem: false,
    permissions: [{ permissionKey: "pointage:lecture" }],
    _count: { roles: 0 },
    ...overrides,
  };
}

function roleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: MOCK_ROLE_ID,
    name: "Rôle test",
    description: null,
    isSystem: false,
    scope: "SITE",
    mfaRequired: false,
    groups: [{ groupId: MOCK_GROUP_ID, group: groupRow() }],
    _count: { users: 0 },
    ...overrides,
  };
}

function adminRoleRow(permissionKeys: string[], scope = "TOUS") {
  return roleRow({
    id: SYSTEM_ROLE_IDS.ADMIN,
    isSystem: true,
    scope,
    groups: [
      {
        groupId: MOCK_GROUP_ID,
        group: groupRow({
          permissions: permissionKeys.map((permissionKey) => ({ permissionKey })),
        }),
      },
    ],
  });
}

function limitedManagerAccess(): RoleAccess {
  return {
    roleId: LIMITED_MANAGER_ROLE_ID,
    roleName: "Gestionnaire limité",
    scope: "SITE",
    mfaRequired: false,
    permissions: new Set(["role:gerer", "utilisateur:affecter_role", "pointage:lecture"]),
  };
}

function useSystemRolesAnd(extra: RoleAccess) {
  setRoleAccessLoader(async (roleId) => {
    if (roleId === extra.roleId) return extra;
    const role = SYSTEM_ROLES.find((entry) => entry.id === roleId);
    if (!role) return null;
    return {
      roleId,
      roleName: role.name,
      scope: role.scope,
      mfaRequired: role.mfaRequired,
      permissions: systemRolePermissions(roleId),
    };
  });
}

describe("access administration", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await resetRedisForTests();
    useSystemRolesAnd(limitedManagerAccess());
    vi.mocked(basePrisma.accessRole.findMany).mockResolvedValue([] as never);
    vi.mocked(basePrisma.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) =>
      fn(basePrisma)) as never);
  });

  afterEach(async () => {
    await resetRedisForTests();
  });

  describe("permission guards", () => {
    it("refuses the groups list to a role without role:gerer and names the missing permission", async () => {
      const res = await request(createApp())
        .get("/api/v1/access/groups")
        .set("Authorization", cdsHeader());

      expect(res.status).toBe(403);
      expect(res.body.details).toEqual({ missingPermissions: ["role:gerer"] });
    });

    it("lets a role with any of the required permissions list the role options", async () => {
      vi.mocked(basePrisma.accessRole.findMany).mockResolvedValue([] as never);
      const withRead = await request(createApp())
        .get("/api/v1/access/role-options")
        .set("Authorization", adminHeader());
      const without = await request(createApp())
        .get("/api/v1/access/role-options")
        .set("Authorization", cdsHeader());

      expect(withRead.status).toBe(200);
      expect(without.status).toBe(403);
      expect(without.body.details).toEqual({
        anyOfPermissions: ["utilisateur:lecture", "role:gerer"],
      });
    });
  });

  describe("groups", () => {
    it("creates a group from catalog permissions and audits it", async () => {
      vi.mocked(basePrisma.permissionGroup.create).mockResolvedValue(groupRow() as never);

      const res = await request(createApp())
        .post("/api/v1/access/groups")
        .set("Authorization", adminHeader())
        .send({ name: "Groupe test", permissions: ["pointage:lecture"] });

      expect(res.status).toBe(201);
      expect(res.body.permissions).toEqual(["pointage:lecture"]);
      expect(auditClient.auditLog.create).toHaveBeenCalled();
    });

    it("rejects a permission that is not in the catalog", async () => {
      const res = await request(createApp())
        .post("/api/v1/access/groups")
        .set("Authorization", adminHeader())
        .send({ name: "Groupe test", permissions: ["pointage:inconnue"] });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("UNKNOWN_PERMISSION");
      expect(basePrisma.permissionGroup.create).not.toHaveBeenCalled();
    });

    it("refuses to grant a permission the actor does not hold", async () => {
      const res = await request(createApp())
        .post("/api/v1/access/groups")
        .set("Authorization", managerHeader())
        .send({ name: "Groupe test", permissions: ["pointage:lecture", "paiement:export"] });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ROLE_ESCALATION");
      expect(res.body.details).toEqual({ excessPermissions: ["paiement:export"] });
      expect(basePrisma.permissionGroup.create).not.toHaveBeenCalled();
    });

    it("refuses to edit a group holding permissions the actor does not have", async () => {
      vi.mocked(basePrisma.permissionGroup.findUnique).mockResolvedValue(
        groupRow({ permissions: [{ permissionKey: "paiement:export" }] }) as never,
      );

      const res = await request(createApp())
        .patch(`/api/v1/access/groups/${MOCK_GROUP_ID}`)
        .set("Authorization", managerHeader())
        .send({ name: "Renommé" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ROLE_ESCALATION");
    });

    it("refuses a change that would strip role management from the Administrateur role", async () => {
      vi.mocked(basePrisma.permissionGroup.findUnique).mockResolvedValue(
        groupRow({ permissions: [{ permissionKey: "role:gerer" }] }) as never,
      );
      vi.mocked(basePrisma.permissionGroup.update).mockResolvedValue(groupRow() as never);
      vi.mocked(basePrisma.accessRole.findUnique).mockResolvedValue(
        adminRoleRow(["pointage:lecture"]) as never,
      );

      const res = await request(createApp())
        .patch(`/api/v1/access/groups/${MOCK_GROUP_ID}`)
        .set("Authorization", adminHeader())
        .send({ permissions: ["pointage:lecture"] });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("ADMIN_LOCKOUT");
    });

    it("keeps system groups and groups in use", async () => {
      vi.mocked(basePrisma.permissionGroup.findUnique).mockResolvedValueOnce(
        groupRow({ isSystem: true }) as never,
      );
      const system = await request(createApp())
        .delete(`/api/v1/access/groups/${MOCK_GROUP_ID}`)
        .set("Authorization", adminHeader());

      vi.mocked(basePrisma.permissionGroup.findUnique).mockResolvedValueOnce(
        groupRow({ _count: { roles: 2 } }) as never,
      );
      const inUse = await request(createApp())
        .delete(`/api/v1/access/groups/${MOCK_GROUP_ID}`)
        .set("Authorization", adminHeader());

      expect(system.status).toBe(403);
      expect(system.body.code).toBe("SYSTEM_GROUP");
      expect(inUse.status).toBe(409);
      expect(inUse.body.code).toBe("GROUP_IN_USE");
      expect(basePrisma.permissionGroup.delete).not.toHaveBeenCalled();
    });
  });

  describe("roles", () => {
    it("creates a role from existing groups", async () => {
      vi.mocked(basePrisma.permissionGroup.findMany).mockResolvedValue([groupRow()] as never);
      vi.mocked(basePrisma.accessRole.create).mockResolvedValue(roleRow() as never);

      const res = await request(createApp())
        .post("/api/v1/access/roles")
        .set("Authorization", adminHeader())
        .send({ name: "Rôle test", scope: "SITE", groupIds: [MOCK_GROUP_ID] });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ scope: "SITE", groupIds: [MOCK_GROUP_ID] });
    });

    it("rejects an unknown group", async () => {
      vi.mocked(basePrisma.permissionGroup.findMany).mockResolvedValue([] as never);

      const res = await request(createApp())
        .post("/api/v1/access/roles")
        .set("Authorization", adminHeader())
        .send({ name: "Rôle test", scope: "SITE", groupIds: [MOCK_GROUP_ID] });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("GROUP_NOT_FOUND");
    });

    it("refuses a role whose scope is wider than the actor's", async () => {
      vi.mocked(basePrisma.permissionGroup.findMany).mockResolvedValue([groupRow()] as never);

      const res = await request(createApp())
        .post("/api/v1/access/roles")
        .set("Authorization", managerHeader())
        .send({ name: "Rôle test", scope: "TOUS", groupIds: [MOCK_GROUP_ID] });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ROLE_SCOPE_ESCALATION");
    });

    it("refuses to move the Administrateur role away from the all-sites scope", async () => {
      const keys = ["role:gerer", "utilisateur:affecter_role"];
      vi.mocked(basePrisma.accessRole.findUnique)
        .mockResolvedValueOnce(adminRoleRow(keys) as never)
        .mockResolvedValue(adminRoleRow(keys, "SITE") as never);
      vi.mocked(basePrisma.accessRole.update).mockResolvedValue(
        adminRoleRow(keys, "SITE") as never,
      );

      const res = await request(createApp())
        .patch(`/api/v1/access/roles/${SYSTEM_ROLE_IDS.ADMIN}`)
        .set("Authorization", adminHeader())
        .send({ scope: "SITE" });

      expect(res.status).toBe(422);
      expect(res.body.code).toBe("ADMIN_LOCKOUT");
    });

    it("keeps system roles and roles assigned to users", async () => {
      vi.mocked(basePrisma.accessRole.findUnique).mockResolvedValueOnce(
        roleRow({ isSystem: true }) as never,
      );
      const system = await request(createApp())
        .delete(`/api/v1/access/roles/${MOCK_ROLE_ID}`)
        .set("Authorization", adminHeader());

      vi.mocked(basePrisma.accessRole.findUnique).mockResolvedValueOnce(
        roleRow({ _count: { users: 3 } }) as never,
      );
      const inUse = await request(createApp())
        .delete(`/api/v1/access/roles/${MOCK_ROLE_ID}`)
        .set("Authorization", adminHeader());

      expect(system.body.code).toBe("SYSTEM_ROLE");
      expect(inUse.body.code).toBe("ROLE_IN_USE");
      expect(basePrisma.accessRole.delete).not.toHaveBeenCalled();
    });

    it("applies a change to permissions immediately by dropping the cached role", async () => {
      let permissions = new Set(["pointage:lecture"]);
      setRoleAccessLoader(async (roleId) => ({
        roleId,
        roleName: "Test",
        scope: "SITE",
        mfaRequired: false,
        permissions,
      }));
      expect((await getRoleAccess(MOCK_ROLE_ID))?.permissions.has("pointage:saisie")).toBe(false);

      permissions = new Set(["pointage:lecture", "pointage:saisie"]);
      expect((await getRoleAccess(MOCK_ROLE_ID))?.permissions.has("pointage:saisie")).toBe(false);

      const { invalidateRoleAccess } = await import("../services/access/access.service.js");
      invalidateRoleAccess(MOCK_ROLE_ID);
      expect((await getRoleAccess(MOCK_ROLE_ID))?.permissions.has("pointage:saisie")).toBe(true);
    });
  });

  describe("shared groups and deletions respect the actor's scope and rights", () => {
    it("refuses to edit a group that a wider-scoped role uses", async () => {
      vi.mocked(basePrisma.permissionGroup.findUnique).mockResolvedValue(groupRow() as never);
      vi.mocked(basePrisma.accessRole.findMany).mockResolvedValue([{ scope: "TOUS" }] as never);

      const res = await request(createApp())
        .patch(`/api/v1/access/groups/${MOCK_GROUP_ID}`)
        .set("Authorization", managerHeader())
        .send({ name: "Renommé" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ROLE_SCOPE_ESCALATION");
      expect(basePrisma.permissionGroup.update).not.toHaveBeenCalled();
    });

    it("refuses to delete a role wider than the actor's scope", async () => {
      vi.mocked(basePrisma.accessRole.findUnique).mockResolvedValue(
        roleRow({ scope: "TOUS" }) as never,
      );

      const res = await request(createApp())
        .delete(`/api/v1/access/roles/${MOCK_ROLE_ID}`)
        .set("Authorization", managerHeader());

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ROLE_SCOPE_ESCALATION");
      expect(basePrisma.accessRole.delete).not.toHaveBeenCalled();
    });

    it("refuses to delete a group holding rights the actor lacks", async () => {
      vi.mocked(basePrisma.permissionGroup.findUnique).mockResolvedValue(
        groupRow({ permissions: [{ permissionKey: "paiement:export" }] }) as never,
      );

      const res = await request(createApp())
        .delete(`/api/v1/access/groups/${MOCK_GROUP_ID}`)
        .set("Authorization", managerHeader());

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ROLE_ESCALATION");
      expect(basePrisma.permissionGroup.delete).not.toHaveBeenCalled();
    });
  });

  describe("assigning a role to a user", () => {
    function patchUser(header: string, userId: string, body: Record<string, unknown>) {
      return request(createApp())
        .patch(`/api/v1/users/${userId}`)
        .set("Authorization", header)
        .send(body);
    }

    beforeEach(() => {
      vi.mocked(basePrisma.user.findFirst).mockResolvedValue({
        id: MOCK_USER_ID,
        active: true,
        accessRoleId: LIMITED_MANAGER_ROLE_ID,
      } as never);
      vi.mocked(basePrisma.user.update).mockResolvedValue({
        id: MOCK_USER_ID,
        active: true,
        email: null,
        phone: null,
        accessRoleId: SYSTEM_ROLE_IDS.CHEF_SERVICE,
        accessRole: { name: "Chef de service" },
        firstName: "A",
        lastName: "B",
        siteId: null,
        teamId: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
    });

    it("changes the role and revokes the user's older tokens", async () => {
      vi.mocked(basePrisma.user.findFirst).mockResolvedValue({
        id: MOCK_USER_ID,
        active: true,
        accessRoleId: SYSTEM_ROLE_IDS.CHEF_EQUIPE,
      } as never);
      const res = await patchUser(adminHeader(), MOCK_USER_ID, {
        roleId: SYSTEM_ROLE_IDS.CHEF_SERVICE,
      });

      expect(res.status).toBe(200);
      expect(res.body.roleId).toBe(SYSTEM_ROLE_IDS.CHEF_SERVICE);
      expect(res.body.roleName).toBe("Chef de service");
      expect(await areTokensRevoked(MOCK_USER_ID, 1)).toBe(true);
    });

    it("does not revoke tokens when the role is unchanged", async () => {
      vi.mocked(basePrisma.user.findFirst).mockResolvedValue({
        id: MOCK_USER_ID,
        active: true,
        accessRoleId: SYSTEM_ROLE_IDS.CHEF_EQUIPE,
      } as never);
      const res = await patchUser(adminHeader(), MOCK_USER_ID, {
        roleId: SYSTEM_ROLE_IDS.CHEF_EQUIPE,
        firstName: "Autre",
      });

      expect(res.status).toBe(200);
      expect(await areTokensRevoked(MOCK_USER_ID, 1)).toBe(false);
    });

    it("forbids changing one's own role", async () => {
      vi.mocked(basePrisma.user.findFirst).mockResolvedValue({
        id: MOCK_ADMIN_ID,
        active: true,
        accessRoleId: SYSTEM_ROLE_IDS.ADMIN,
      } as never);

      const res = await patchUser(adminHeader(), MOCK_ADMIN_ID, {
        roleId: SYSTEM_ROLE_IDS.CHEF_SERVICE,
      });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("SELF_ROLE_CHANGE");
    });

    it("forbids assigning a role that exceeds the actor's rights", async () => {
      useSystemRolesAnd({
        ...limitedManagerAccess(),
        permissions: new Set([
          "utilisateur:ecriture",
          "utilisateur:affecter_role",
          "pointage:lecture",
        ]),
      });

      const res = await patchUser(managerHeader(), MOCK_USER_ID, {
        roleId: SYSTEM_ROLE_IDS.ADMIN,
      });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("ROLE_ESCALATION");
      expect(basePrisma.user.update).not.toHaveBeenCalled();
    });

    it("forbids assigning any role without utilisateur:affecter_role", async () => {
      useSystemRolesAnd({
        ...limitedManagerAccess(),
        permissions: new Set(["utilisateur:ecriture", "pointage:lecture"]),
      });

      const res = await patchUser(managerHeader(), MOCK_USER_ID, {
        roleId: SYSTEM_ROLE_IDS.CHEF_SERVICE,
      });

      expect(res.status).toBe(403);
      expect(res.body.details).toEqual({ missingPermissions: ["utilisateur:affecter_role"] });
    });

    it("requires a role when creating a user", async () => {
      const res = await request(createApp())
        .post("/api/v1/users")
        .set("Authorization", adminHeader())
        .send({ firstName: "A", lastName: "B", email: "a@b.mg" });

      expect(res.status).toBe(422);
    });
  });

  describe("acting on a user with higher rights", () => {
    const managerWithUserWrite = () =>
      useSystemRolesAnd({
        ...limitedManagerAccess(),
        permissions: new Set(["utilisateur:ecriture", "pointage:lecture"]),
      });

    beforeEach(() => {
      vi.mocked(basePrisma.user.findFirst).mockResolvedValue({
        id: MOCK_USER_ID,
        active: true,
        accessRoleId: SYSTEM_ROLE_IDS.ADMIN,
      } as never);
    });

    it.each([
      ["resets the password of", "post", "reset-password", {}],
      ["deactivates", "post", "deactivate", undefined],
    ] as const)("refuses to %s a more privileged user", async (_label, _method, action, body) => {
      managerWithUserWrite();
      const res = await request(createApp())
        .post(`/api/v1/users/${MOCK_USER_ID}/${action}`)
        .set("Authorization", managerHeader())
        .send(body);

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("USER_ABOVE_RIGHTS");
      expect(basePrisma.user.update).not.toHaveBeenCalled();
    });

    it("refuses to edit a more privileged user, even without touching the role", async () => {
      managerWithUserWrite();
      const res = await request(createApp())
        .patch(`/api/v1/users/${MOCK_USER_ID}`)
        .set("Authorization", managerHeader())
        .send({ email: "attacker@example.com" });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("USER_ABOVE_RIGHTS");
      expect(basePrisma.user.update).not.toHaveBeenCalled();
    });

    it("reports each refused user in a bulk deactivation", async () => {
      managerWithUserWrite();
      const res = await request(createApp())
        .post("/api/v1/users/bulk-deactivate")
        .set("Authorization", managerHeader())
        .send({ ids: [MOCK_USER_ID] });

      expect(res.status).toBe(200);
      expect(res.body.results[0].status).toBe("error");
    });

    it("lets a user manage someone with the same or lower rights", async () => {
      managerWithUserWrite();
      vi.mocked(basePrisma.user.findFirst).mockResolvedValue({
        id: MOCK_USER_ID,
        active: true,
        accessRoleId: LIMITED_MANAGER_ROLE_ID,
      } as never);
      vi.mocked(basePrisma.user.update).mockResolvedValue({
        id: MOCK_USER_ID,
        active: true,
        email: "ok@example.com",
        phone: null,
        accessRoleId: LIMITED_MANAGER_ROLE_ID,
        accessRole: { name: "Gestionnaire limité" },
        firstName: "A",
        lastName: "B",
        siteId: null,
        teamId: null,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const res = await request(createApp())
        .patch(`/api/v1/users/${MOCK_USER_ID}`)
        .set("Authorization", managerHeader())
        .send({ email: "ok@example.com" });

      expect(res.status).toBe(200);
    });
  });

  describe("request decisions follow the data scope", () => {
    const SITE_ID = "00000000-0000-4000-8000-000000000010";
    const siteDecider = (): RoleAccess => ({
      roleId: LIMITED_MANAGER_ROLE_ID,
      roleName: "Décideur site",
      scope: "SITE",
      mfaRequired: false,
      permissions: new Set(["demande:lecture", "demande:decider"]),
    });

    it("limits a site-scoped decider to their site and their own requests", async () => {
      useSystemRolesAnd(siteDecider());
      vi.mocked(basePrisma.activityRequest.findMany).mockResolvedValue([] as never);

      const res = await request(createApp())
        .get("/api/v1/activity-requests")
        .set("Authorization", token(MOCK_CDS_ID, LIMITED_MANAGER_ROLE_ID, SITE_ID));

      expect(res.status).toBe(200);
      expect(basePrisma.activityRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: [{ requestedById: MOCK_CDS_ID }, { siteId: SITE_ID }] },
        }),
      );
    });

    it("does not limit a decider whose scope is all sites", async () => {
      vi.mocked(basePrisma.activityRequest.findMany).mockResolvedValue([] as never);

      await request(createApp())
        .get("/api/v1/activity-requests")
        .set("Authorization", adminHeader());

      expect(basePrisma.activityRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it("answers 404 when a site-scoped decider targets another site's request", async () => {
      useSystemRolesAnd(siteDecider());
      vi.mocked(basePrisma.activityRequest.findFirst).mockResolvedValue(null as never);

      const res = await request(createApp())
        .patch(`/api/v1/activity-requests/${MOCK_GROUP_ID}/decision`)
        .set("Authorization", token(MOCK_CDS_ID, LIMITED_MANAGER_ROLE_ID, SITE_ID))
        .send({ decision: "REJECTED", decisionReason: "Hors site" });

      expect(res.status).toBe(404);
      expect(basePrisma.activityRequest.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: MOCK_GROUP_ID, OR: [{ requestedById: MOCK_CDS_ID }, { siteId: SITE_ID }] },
        }),
      );
    });
  });
});
