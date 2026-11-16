import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/jwt.js";
import { areTokensRevoked, isUserBlocked } from "../lib/redis.js";
import { getRoleAccess } from "../services/access/access.service.js";
import type { AuthUser } from "../services/access/auth-user.js";
import { updateRequestContext } from "./prisma-rls.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ code: "UNAUTHENTICATED", message: "Missing bearer token" });
  }

  try {
    const payload = verifyAccessToken(header.slice("Bearer ".length));

    if (await isUserBlocked(payload.sub)) {
      return res
        .status(401)
        .json({ code: "USER_BLOCKED", message: "Compte utilisateur désactivé" });
    }
    if (await areTokensRevoked(payload.sub, payload.iat)) {
      return res
        .status(401)
        .json({ code: "TOKEN_REVOKED", message: "Session expirée, reconnectez-vous" });
    }

    const access = await getRoleAccess(payload.roleId);
    if (!access) {
      return res.status(401).json({ code: "ROLE_NOT_FOUND", message: "Rôle introuvable" });
    }

    req.user = {
      ...payload,
      scope: access.scope,
      permissions: access.permissions,
      roleName: access.roleName,
      mfaRequired: access.mfaRequired,
    };

    updateRequestContext({
      userId: payload.sub,
      scope: access.scope,
      siteId: payload.siteId,
      teamId: payload.teamId,
    });
    next();
  } catch {
    return res.status(401).json({ code: "INVALID_TOKEN", message: "Invalid or expired token" });
  }
}
