import type { RoleAccess } from "./access.service.js";

interface SessionUserRow {
  id: string;
  email: string | null;
  firstName: string;
  lastName: string;
  siteId: string | null;
  teamId: string | null;
}

export function buildSessionUser(user: SessionUserRow, access: RoleAccess) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    siteId: user.siteId,
    teamId: user.teamId,
    roleId: access.roleId,
    roleName: access.roleName,
    scope: access.scope,
    permissions: [...access.permissions].sort(),
  };
}
