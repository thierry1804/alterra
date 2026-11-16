import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ApiError } from "./error-handler.js";
import type { PermissionKey } from "../services/access/permissions.catalog.js";

interface PermissionHolder {
  permissions: ReadonlySet<string>;
}

export type GuardedHandler = RequestHandler & {
  __permissions?: readonly PermissionKey[];
  __anyPermissions?: readonly PermissionKey[];
  __mfaRole?: true;
};

export function can(user: PermissionHolder | undefined, key: PermissionKey): boolean {
  return Boolean(user?.permissions.has(key));
}

function canAny(user: PermissionHolder | undefined, keys: readonly PermissionKey[]): boolean {
  return keys.some((key) => can(user, key));
}

export function requirePermission(...keys: PermissionKey[]): GuardedHandler {
  const guard: GuardedHandler = (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, "UNAUTHENTICATED", "Missing user context"));
    }
    const missing = keys.filter((key) => !can(req.user, key));
    if (missing.length > 0) {
      return next(
        new ApiError(403, "FORBIDDEN", "Permission insuffisante", { missingPermissions: missing }),
      );
    }
    next();
  };
  guard.__permissions = keys;
  return guard;
}

export function requireMfaRole(): GuardedHandler {
  const guard: GuardedHandler = (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, "UNAUTHENTICATED", "Missing user context"));
    }
    if (!req.user.mfaRequired) {
      return next(new ApiError(403, "FORBIDDEN", "Permission insuffisante"));
    }
    next();
  };
  guard.__mfaRole = true;
  return guard;
}

export function requireAnyPermission(...keys: PermissionKey[]): GuardedHandler {
  const guard: GuardedHandler = (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, "UNAUTHENTICATED", "Missing user context"));
    }
    if (!canAny(req.user, keys)) {
      return next(
        new ApiError(403, "FORBIDDEN", "Permission insuffisante", { anyOfPermissions: keys }),
      );
    }
    next();
  };
  guard.__anyPermissions = keys;
  return guard;
}
