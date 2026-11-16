import type { AccessScope } from "@prisma/client";

export interface RoleAccess {
  roleId: string;
  roleName: string;
  scope: AccessScope;
  mfaRequired: boolean;
  permissions: ReadonlySet<string>;
}

export type RoleAccessLoader = (roleId: string) => Promise<RoleAccess | null>;

const CACHE_TTL_MS = 30_000;

const cache = new Map<string, { value: RoleAccess | null; expiresAt: number }>();

async function loadRoleAccessFromDb(roleId: string): Promise<RoleAccess | null> {
  const { basePrisma } = await import("../../lib/prisma-base.js");
  const role = await basePrisma.accessRole.findUnique({
    where: { id: roleId },
    include: { groups: { include: { group: { include: { permissions: true } } } } },
  });
  if (!role) return null;
  const permissions = new Set<string>();
  for (const link of role.groups) {
    for (const permission of link.group.permissions) permissions.add(permission.permissionKey);
  }
  return {
    roleId: role.id,
    roleName: role.name,
    scope: role.scope,
    mfaRequired: role.mfaRequired,
    permissions,
  };
}

let loader: RoleAccessLoader = loadRoleAccessFromDb;

export function setRoleAccessLoader(next?: RoleAccessLoader): void {
  loader = next ?? loadRoleAccessFromDb;
  cache.clear();
}

export function invalidateRoleAccess(roleId?: string): void {
  if (roleId) cache.delete(roleId);
  else cache.clear();
}

export async function getRoleAccess(roleId: string): Promise<RoleAccess | null> {
  const hit = cache.get(roleId);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await loader(roleId);
  cache.set(roleId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}
