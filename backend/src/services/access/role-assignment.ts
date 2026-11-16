import type { AccessScope } from "@prisma/client";
import { ApiError } from "../../middleware/error-handler.js";
import { can } from "../../middleware/rbac.js";
import { getRoleAccess } from "./access.service.js";
import type { AuthUser } from "./auth-user.js";

const SCOPE_RANK: Record<AccessScope, number> = { EQUIPE: 0, SITE: 1, TOUS: 2 };

export function assertNotBeyondActor(
  actor: AuthUser,
  permissions: Iterable<string>,
  scope?: AccessScope,
): void {
  const excess = [...permissions].filter((permission) => !actor.permissions.has(permission));
  if (excess.length > 0) {
    throw new ApiError(403, "ROLE_ESCALATION", "Ces droits dépassent les vôtres", {
      excessPermissions: excess,
    });
  }
  if (scope && SCOPE_RANK[scope] > SCOPE_RANK[actor.scope]) {
    throw new ApiError(403, "ROLE_SCOPE_ESCALATION", "Cette portée dépasse la vôtre");
  }
}

export async function assertCanManageUser(
  actor: AuthUser,
  target: { id: string; accessRoleId: string },
): Promise<void> {
  if (target.id === actor.sub) return;
  const access = await getRoleAccess(target.accessRoleId);
  if (!access) throw new ApiError(422, "ROLE_NOT_FOUND", "Rôle introuvable");
  const excess = [...access.permissions].filter((permission) => !actor.permissions.has(permission));
  if (excess.length > 0 || SCOPE_RANK[access.scope] > SCOPE_RANK[actor.scope]) {
    throw new ApiError(
      403,
      "USER_ABOVE_RIGHTS",
      "Cet utilisateur a des droits supérieurs aux vôtres",
    );
  }
}

export async function assertCanAssignRole(actor: AuthUser, roleId: string): Promise<void> {
  if (!can(actor, "utilisateur:affecter_role")) {
    throw new ApiError(403, "FORBIDDEN", "Permission insuffisante", {
      missingPermissions: ["utilisateur:affecter_role"],
    });
  }
  const target = await getRoleAccess(roleId);
  if (!target) throw new ApiError(422, "ROLE_NOT_FOUND", "Rôle introuvable");
  assertNotBeyondActor(actor, target.permissions, target.scope);
}
