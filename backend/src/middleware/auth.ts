import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken, type AccessTokenPayload } from "../lib/jwt.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessTokenPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ code: "UNAUTHENTICATED", message: "Missing bearer token" });
  }

  try {
    req.user = verifyAccessToken(header.slice("Bearer ".length));
    next();
  } catch {
    return res.status(401).json({ code: "INVALID_TOKEN", message: "Invalid or expired token" });
  }
}
