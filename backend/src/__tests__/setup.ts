import { setRoleAccessLoader } from "../services/access/access.service.js";
import { SYSTEM_ROLES, systemRolePermissions } from "../services/access/system-roles.js";

setRoleAccessLoader(async (roleId) => {
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
