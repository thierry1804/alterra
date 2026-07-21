import type { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";
import { ApiError } from "./error-handler.js";

/** Guard: restrict route to the given roles. Must run after requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, "UNAUTHENTICATED", "Missing user context"));
    }
    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(403, "FORBIDDEN", "Insufficient role", {
          requiredRoles: roles,
          actualRole: req.user.role,
        }),
      );
    }
    next();
  };
}

/**
 * Site scoping helper: CHEF_SERVICE is confined to their own site.
 * ADMIN sees everything. Attaches `req.siteScope` for explicit where clauses.
 * Prisma RLS extension applies the same filter automatically on reads.
 */
export function siteScope(req: Request, _res: Response, next: NextFunction) {
  req.siteScope =
    req.user?.role === Role.ADMIN ? undefined : (req.user?.siteId ?? undefined);
  next();
}

/**
 * Team scoping helper: CHEF_EQUIPE is confined to their own team.
 * ADMIN sees everything. Attaches `req.teamScope` for explicit where clauses.
 */
export function teamScope(req: Request, _res: Response, next: NextFunction) {
  req.teamScope =
    req.user?.role === Role.CHEF_EQUIPE ? (req.user?.teamId ?? undefined) : undefined;
  next();
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      siteScope?: string;
      teamScope?: string;
    }
  }
}
