import type { NextFunction, Request, Response } from "express";

const SENSITIVE_PATHS = [
  { method: "POST", pattern: /^\/sites\/?$/ },
  { method: "PATCH", pattern: /^\/sites\/[^/]+$/ },
  { method: "DELETE", pattern: /^\/sites\/[^/]+$/ },
  { method: "POST", pattern: /^\/activities\/?$/ },
  { method: "PATCH", pattern: /^\/activities\/[^/]+$/ },
  { method: "DELETE", pattern: /^\/activities\/[^/]+$/ },
  { method: "POST", pattern: /^\/workers\/?$/ },
  { method: "POST", pattern: /^\/workers\/import\/?$/ },
  { method: "PATCH", pattern: /^\/workers\/[^/]+$/ },
  { method: "DELETE", pattern: /^\/workers\/[^/]+$/ },
  { method: "POST", pattern: /^\/users\/?$/ },
  { method: "PATCH", pattern: /^\/users\/[^/]+$/ },
  { method: "POST", pattern: /^\/users\/[^/]+\/(reset-password|deactivate)$/ },
  { method: "POST", pattern: /^\/pointages(\/sync)?\/?$/ },
  { method: "PATCH", pattern: /^\/pointages\/[^/]+\/(validate|reject)$/ },
  { method: "POST", pattern: /^\/payments\/?$/ },
  { method: "PATCH", pattern: /^\/payments\/[^/]+$/ },
  { method: "DELETE", pattern: /^\/payments\/[^/]+$/ },
];

function matchesSensitiveRoute(method: string, path: string): boolean {
  return SENSITIVE_PATHS.some((r) => r.method === method && r.pattern.test(path));
}

/**
 * Express middleware — marks sensitive mutation routes.
 * Entity mutations are audited exclusively by PostgreSQL triggers (defense-in-depth).
 * Explicit actions (LOGIN, EXPORT) use writeAuditLog() directly.
 */
export function auditSensitiveRoutes(req: Request, _res: Response, next: NextFunction): void {
  if (matchesSensitiveRoute(req.method, req.path)) {
    req.auditSensitive = true;
  }
  next();
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auditSensitive?: boolean;
    }
  }
}
