import { Prisma } from "@prisma/client";
import type { AccessScope, PrismaClient } from "@prisma/client";
import { ApiError } from "../../middleware/error-handler.js";
import { isPermissionKey, type PermissionKey } from "./permissions.catalog.js";
import { assertNotBeyondActor } from "./role-assignment.js";
import type { AuthUser } from "./auth-user.js";
import { SYSTEM_ROLE_IDS } from "./system-roles.js";

type Db = PrismaClient | Prisma.TransactionClient;

const ADMIN_REQUIRED_PERMISSIONS: readonly PermissionKey[] = [
  "role:gerer",
  "utilisateur:affecter_role",
];

const GROUP_INCLUDE = {
  permissions: true,
  _count: { select: { roles: true } },
} satisfies Prisma.PermissionGroupInclude;

const ROLE_INCLUDE = {
  groups: { include: { group: { include: { permissions: true } } } },
  _count: { select: { users: true } },
} satisfies Prisma.AccessRoleInclude;

type GroupRow = Prisma.PermissionGroupGetPayload<{ include: typeof GROUP_INCLUDE }>;
type RoleRow = Prisma.AccessRoleGetPayload<{ include: typeof ROLE_INCLUDE }>;

export interface GroupInput {
  name: string;
  description?: string | null;
  permissions: string[];
}

export interface RoleInput {
  name: string;
  description?: string | null;
  scope: AccessScope;
  mfaRequired?: boolean;
  groupIds: string[];
}

function assertKnownPermissions(keys: readonly string[]): PermissionKey[] {
  const unknown = keys.filter((key) => !isPermissionKey(key));
  if (unknown.length > 0) {
    throw new ApiError(422, "UNKNOWN_PERMISSION", "Permission inconnue", { unknown });
  }
  return [...new Set(keys)] as PermissionKey[];
}

function groupPermissions(group: { permissions: { permissionKey: string }[] }): string[] {
  return group.permissions.map((permission) => permission.permissionKey).sort();
}

function rolePermissions(role: RoleRow): string[] {
  const all = new Set<string>();
  for (const link of role.groups) groupPermissions(link.group).forEach((key) => all.add(key));
  return [...all].sort();
}

function serializeGroup(group: GroupRow) {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    isSystem: group.isSystem,
    permissions: groupPermissions(group),
    roleCount: group._count.roles,
  };
}

function serializeRole(role: RoleRow) {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    scope: role.scope,
    mfaRequired: role.mfaRequired,
    groupIds: role.groups.map((link) => link.groupId),
    permissions: rolePermissions(role),
    userCount: role._count.users,
  };
}

async function withUniqueName<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ApiError(409, "NAME_TAKEN", "Ce nom est déjà utilisé");
    }
    throw err;
  }
}

async function assertAdminRoleKeepsAccess(db: Db): Promise<void> {
  const role = await db.accessRole.findUnique({
    where: { id: SYSTEM_ROLE_IDS.ADMIN },
    include: ROLE_INCLUDE,
  });
  const permissions = new Set(role ? rolePermissions(role) : []);
  const missing = ADMIN_REQUIRED_PERMISSIONS.filter((key) => !permissions.has(key));
  if (!role || role.scope !== "TOUS" || missing.length > 0) {
    throw new ApiError(
      422,
      "ADMIN_LOCKOUT",
      "Le rôle Administrateur doit garder la portée « tous les sites » et la gestion des rôles",
      { missing },
    );
  }
}

async function loadGroups(db: Db, groupIds: readonly string[]) {
  const ids = [...new Set(groupIds)];
  const groups = await db.permissionGroup.findMany({
    where: { id: { in: ids } },
    include: { permissions: true },
  });
  if (groups.length !== ids.length) {
    throw new ApiError(422, "GROUP_NOT_FOUND", "Groupe introuvable");
  }
  return { ids, groups };
}

export async function listGroups(db: Db) {
  const groups = await db.permissionGroup.findMany({
    include: GROUP_INCLUDE,
    orderBy: { name: "asc" },
  });
  return groups.map(serializeGroup);
}

export async function listRoles(db: Db) {
  const roles = await db.accessRole.findMany({ include: ROLE_INCLUDE, orderBy: { name: "asc" } });
  return roles.map(serializeRole);
}

export async function listRoleOptions(db: Db) {
  return db.accessRole.findMany({
    select: { id: true, name: true, description: true, scope: true, isSystem: true },
    orderBy: { name: "asc" },
  });
}

export async function createGroup(db: Db, actor: AuthUser, input: GroupInput) {
  const permissions = assertKnownPermissions(input.permissions);
  assertNotBeyondActor(actor, permissions);
  const group = await withUniqueName(() =>
    db.permissionGroup.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        permissions: { create: permissions.map((permissionKey) => ({ permissionKey })) },
      },
      include: GROUP_INCLUDE,
    }),
  );
  return serializeGroup(group);
}

export async function updateGroup(db: Db, actor: AuthUser, id: string, input: Partial<GroupInput>) {
  const before = await db.permissionGroup.findUnique({ where: { id }, include: GROUP_INCLUDE });
  if (!before) throw new ApiError(404, "NOT_FOUND", "Groupe introuvable");

  const next = input.permissions ? assertKnownPermissions(input.permissions) : undefined;
  assertNotBeyondActor(actor, [...groupPermissions(before), ...(next ?? [])]);
  const linkedRoles = await db.accessRole.findMany({
    where: { groups: { some: { groupId: id } } },
    select: { scope: true },
  });
  for (const linked of linkedRoles) assertNotBeyondActor(actor, [], linked.scope);

  const after = await withUniqueName(() =>
    db.permissionGroup.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(next
          ? {
              permissions: {
                deleteMany: {},
                create: next.map((permissionKey) => ({ permissionKey })),
              },
            }
          : {}),
      },
      include: GROUP_INCLUDE,
    }),
  );
  await assertAdminRoleKeepsAccess(db);
  return { before: serializeGroup(before), after: serializeGroup(after) };
}

export async function deleteGroup(db: Db, actor: AuthUser, id: string) {
  const before = await db.permissionGroup.findUnique({ where: { id }, include: GROUP_INCLUDE });
  if (!before) throw new ApiError(404, "NOT_FOUND", "Groupe introuvable");
  assertNotBeyondActor(actor, groupPermissions(before));
  if (before.isSystem) {
    throw new ApiError(403, "SYSTEM_GROUP", "Un groupe système ne peut pas être supprimé");
  }
  if (before._count.roles > 0) {
    throw new ApiError(409, "GROUP_IN_USE", "Ce groupe est utilisé par des rôles", {
      roleCount: before._count.roles,
    });
  }
  await db.permissionGroup.delete({ where: { id } });
  return serializeGroup(before);
}

export async function createRole(db: Db, actor: AuthUser, input: RoleInput) {
  const { ids, groups } = await loadGroups(db, input.groupIds);
  const permissions = groups.flatMap(groupPermissions);
  assertNotBeyondActor(actor, permissions, input.scope);

  const role = await withUniqueName(() =>
    db.accessRole.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        scope: input.scope,
        mfaRequired: input.mfaRequired ?? false,
        groups: { create: ids.map((groupId) => ({ groupId })) },
      },
      include: ROLE_INCLUDE,
    }),
  );
  return serializeRole(role);
}

export async function updateRole(db: Db, actor: AuthUser, id: string, input: Partial<RoleInput>) {
  const before = await db.accessRole.findUnique({ where: { id }, include: ROLE_INCLUDE });
  if (!before) throw new ApiError(404, "NOT_FOUND", "Rôle introuvable");

  const next = input.groupIds ? await loadGroups(db, input.groupIds) : undefined;
  const nextPermissions = next ? next.groups.flatMap(groupPermissions) : [];
  assertNotBeyondActor(actor, [...rolePermissions(before), ...nextPermissions], before.scope);
  if (input.scope) assertNotBeyondActor(actor, [], input.scope);

  const after = await withUniqueName(() =>
    db.accessRole.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.scope !== undefined ? { scope: input.scope } : {}),
        ...(input.mfaRequired !== undefined ? { mfaRequired: input.mfaRequired } : {}),
        ...(next
          ? { groups: { deleteMany: {}, create: next.ids.map((groupId) => ({ groupId })) } }
          : {}),
      },
      include: ROLE_INCLUDE,
    }),
  );
  await assertAdminRoleKeepsAccess(db);
  return { before: serializeRole(before), after: serializeRole(after) };
}

export async function deleteRole(db: Db, actor: AuthUser, id: string) {
  const before = await db.accessRole.findUnique({ where: { id }, include: ROLE_INCLUDE });
  if (!before) throw new ApiError(404, "NOT_FOUND", "Rôle introuvable");
  assertNotBeyondActor(actor, rolePermissions(before), before.scope);
  if (before.isSystem) {
    throw new ApiError(403, "SYSTEM_ROLE", "Un rôle système ne peut pas être supprimé");
  }
  if (before._count.users > 0) {
    throw new ApiError(409, "ROLE_IN_USE", "Ce rôle est attribué à des utilisateurs", {
      userCount: before._count.users,
    });
  }
  await db.accessRole.delete({ where: { id } });
  return serializeRole(before);
}
