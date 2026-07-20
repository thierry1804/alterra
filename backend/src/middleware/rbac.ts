import type { NextFunction, Request, Response } from "express";
import { Role } from "@prisma/client";

/** Guard: restrict route to the given roles. Must run after requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ code: "UNAUTHENTICATED", message: "Missing user context" });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ code: "FORBIDDEN", message: "Insufficient role" });
    }
    next();
  };
}

/**
 * Site scoping: CHEF_SERVICE / CHEF_EQUIPE are confined to their own site.
 * ADMIN sees everything. Attaches `req.siteScope` for services to apply as a
 * Prisma `where` filter — the second barrier alongside route guards.
 */
export function siteScope(req: Request, _res: Response, next: NextFunction) {
  req.siteScope = req.user?.role === Role.ADMIN ? undefined : req.user?.siteId ?? undefined;
  next();
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      siteScope?: string;
    }
  }
}
