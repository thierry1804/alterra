import type { PrismaClient } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { getRequestContext } from "./prisma-rls.js";
import { writeAuditLog } from "../services/audit/audit.service.js";

const AUDITED_MODELS = [
  { key: "worker", entityType: "Worker" },
  { key: "pointage", entityType: "Pointage" },
  { key: "payment", entityType: "Payment" },
] as const;

type MutationArgs = {
  where?: Record<string, unknown>;
  data?: unknown;
  create?: unknown;
  update?: unknown;
};

type MutationHandler = (args: MutationArgs) => Promise<{ id: string } & Record<string, unknown>>;

function auditContext() {
  const ctx = getRequestContext();
  return {
    userId: ctx?.userId ?? null,
    ip: ctx?.ip ?? null,
    userAgent: ctx?.userAgent ?? null,
  };
}

function createHandler(
  basePrisma: PrismaClient,
  modelKey: string,
  entityType: string,
  operation: "create" | "update" | "delete" | "upsert",
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delegate = (basePrisma as any)[modelKey];

  return async ({ args, query }: { args: MutationArgs; query: MutationHandler }) => {
    let before: unknown;
    if (operation === "update" || operation === "delete" || operation === "upsert") {
      if (args.where) {
        before = await delegate.findUnique({ where: args.where });
      }
    }

    const result = await query(args);

    const action =
      operation === "create" ? "CREATE" : operation === "delete" ? "DELETE" : "UPDATE";

    await writeAuditLog({
      ...auditContext(),
      action,
      entityType,
      entityId: result?.id ?? (before as { id?: string } | null)?.id ?? null,
      before: action === "CREATE" ? undefined : before,
      after: action === "DELETE" ? undefined : result,
    });

    return result;
  };
}

/** Prisma Client extension — auto-audit CREATE/UPDATE/DELETE on sensitive models. */
export function createAuditExtension(basePrisma: PrismaClient) {
  const query: Record<string, Record<string, ReturnType<typeof createHandler>>> = {};

  for (const { key, entityType } of AUDITED_MODELS) {
    query[key] = {
      create: createHandler(basePrisma, key, entityType, "create"),
      update: createHandler(basePrisma, key, entityType, "update"),
      delete: createHandler(basePrisma, key, entityType, "delete"),
      upsert: createHandler(basePrisma, key, entityType, "upsert"),
    };
  }

  return { query };
}

const SENSITIVE_PATHS = [
  { method: "POST", pattern: /^\/workers\/?$/ },
  { method: "PATCH", pattern: /^\/workers\/[^/]+$/ },
  { method: "DELETE", pattern: /^\/workers\/[^/]+$/ },
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
 * Express middleware — documents sensitive mutation routes.
 * Actual audit writes happen via Prisma extension (createAuditExtension).
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
