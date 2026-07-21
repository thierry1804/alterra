import { AsyncLocalStorage } from "node:async_hooks";
import { Role } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";

export interface RequestContext {
  userId?: string;
  role?: Role;
  siteId?: string | null;
  teamId?: string | null;
  ip?: string;
  userAgent?: string;
}

const requestContextStorage = new AsyncLocalStorage<RequestContext>();

const SCOPED_MODELS = ["Worker", "Pointage", "Payment", "Team", "User"] as const;
type ScopedModel = (typeof SCOPED_MODELS)[number];

const READ_OPERATIONS = [
  "findMany",
  "findFirst",
  "findUnique",
  "findUniqueOrThrow",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
] as const;

const MUTATION_OPERATIONS = [
  "create",
  "update",
  "delete",
  "upsert",
  "updateMany",
  "deleteMany",
] as const;

export const IMPOSSIBLE_SCOPE_ID = "00000000-0000-0000-0000-000000000000";
export const IMPOSSIBLE_SCOPE_FILTER: Record<string, string> = { id: IMPOSSIBLE_SCOPE_ID };

export class RlsScopeError extends Error {
  constructor(message = "Row-level scope violation") {
    super(message);
    this.name = "RlsScopeError";
  }
}

export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

export function updateRequestContext(partial: Partial<RequestContext>): void {
  const store = requestContextStorage.getStore();
  if (store) {
    Object.assign(store, partial);
  }
}

export function runWithRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return requestContextStorage.run(ctx, fn);
}

/** Initialise AsyncLocalStorage per request (ip, userAgent). Auth middleware enriches user fields. */
export function requestContext(req: Request, _res: Response, next: NextFunction): void {
  runWithRequestContext(
    {
      ip: req.ip,
      userAgent:
        typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
    },
    () => next(),
  );
}

export function getSiteFilter(): Record<string, string> {
  const ctx = getRequestContext();
  if (!ctx?.role || ctx.role === Role.ADMIN) return {};
  if (ctx.role === Role.CHEF_SERVICE) {
    if (!ctx.siteId) return IMPOSSIBLE_SCOPE_FILTER;
    return { siteId: ctx.siteId };
  }
  return {};
}

export function getTeamFilter(): Record<string, string> {
  const ctx = getRequestContext();
  if (!ctx?.role || ctx.role === Role.ADMIN) return {};
  if (ctx.role === Role.CHEF_EQUIPE) {
    if (!ctx.teamId) return IMPOSSIBLE_SCOPE_FILTER;
    return { teamId: ctx.teamId };
  }
  return {};
}

function mergeWhere(
  existing: Record<string, unknown> | undefined,
  scope: Record<string, unknown>,
): Record<string, unknown> {
  if (!existing || Object.keys(existing).length === 0) return scope;
  return { AND: [existing, scope] };
}

function isImpossibleScope(scope: Record<string, unknown>): boolean {
  return scope.id === IMPOSSIBLE_SCOPE_ID;
}

/** Returns null for ADMIN (no filter), scope filter for scoped roles, or impossible filter when scope/context is missing. */
export function getModelScopeFilter(model: ScopedModel): Record<string, unknown> | null {
  const ctx = getRequestContext();
  if (!ctx?.role) return IMPOSSIBLE_SCOPE_FILTER;
  if (ctx.role === Role.ADMIN) return null;

  switch (model) {
    case "Worker":
      if (ctx.role === Role.CHEF_SERVICE) {
        if (!ctx.siteId) return IMPOSSIBLE_SCOPE_FILTER;
        return { siteId: ctx.siteId };
      }
      if (ctx.role === Role.CHEF_EQUIPE) {
        if (!ctx.teamId) return IMPOSSIBLE_SCOPE_FILTER;
        return { teamId: ctx.teamId };
      }
      break;
    case "Pointage":
    case "Payment":
      if (ctx.role === Role.CHEF_SERVICE) {
        if (!ctx.siteId) return IMPOSSIBLE_SCOPE_FILTER;
        return { worker: { siteId: ctx.siteId } };
      }
      if (ctx.role === Role.CHEF_EQUIPE) {
        if (!ctx.teamId) return IMPOSSIBLE_SCOPE_FILTER;
        return { worker: { teamId: ctx.teamId } };
      }
      break;
    case "Team":
      if (ctx.role === Role.CHEF_SERVICE) {
        if (!ctx.siteId) return IMPOSSIBLE_SCOPE_FILTER;
        return { siteId: ctx.siteId };
      }
      if (ctx.role === Role.CHEF_EQUIPE) {
        if (!ctx.teamId) return IMPOSSIBLE_SCOPE_FILTER;
        return { id: ctx.teamId };
      }
      break;
    case "User":
      if (ctx.role === Role.CHEF_SERVICE) {
        if (!ctx.siteId) return IMPOSSIBLE_SCOPE_FILTER;
        return { siteId: ctx.siteId };
      }
      if (ctx.role === Role.CHEF_EQUIPE) {
        if (!ctx.teamId) return IMPOSSIBLE_SCOPE_FILTER;
        return { teamId: ctx.teamId };
      }
      break;
  }

  return IMPOSSIBLE_SCOPE_FILTER;
}

function extractField(data: Record<string, unknown>, field: string): string | undefined {
  const direct = data[field];
  if (typeof direct === "string") return direct;

  const relationKey = field.endsWith("Id") ? field.slice(0, -2) : field;
  const relation = data[relationKey];
  if (relation && typeof relation === "object" && relation !== null) {
    const connect = (relation as Record<string, unknown>).connect;
    if (connect && typeof connect === "object" && connect !== null) {
      const id = (connect as Record<string, unknown>).id;
      if (typeof id === "string") return id;
    }
  }

  return undefined;
}

function assertNotImpossibleScope(model: ScopedModel): Record<string, unknown> | null {
  const scope = getModelScopeFilter(model);
  if (scope && isImpossibleScope(scope)) {
    throw new RlsScopeError(`Missing scope context for ${model} mutation`);
  }
  return scope;
}

/** Synchronous validation of direct scope fields on create/update data. Exported for unit tests. */
export function validateDirectFieldsInScope(model: ScopedModel, data: Record<string, unknown>): void {
  const scope = assertNotImpossibleScope(model);
  if (!scope) return;

  switch (model) {
    case "Worker": {
      const siteId = extractField(data, "siteId");
      const teamId = extractField(data, "teamId");
      if ("siteId" in scope) {
        if (siteId === undefined) {
          throw new RlsScopeError("Worker requires scoped siteId");
        }
        if (siteId !== scope.siteId) {
          throw new RlsScopeError("Worker siteId out of scope");
        }
      }
      if ("teamId" in scope) {
        if (teamId === undefined) {
          throw new RlsScopeError("Worker requires scoped teamId");
        }
        if (teamId !== scope.teamId) {
          throw new RlsScopeError("Worker teamId out of scope");
        }
      }
      break;
    }
    case "Team": {
      if ("id" in scope) {
        throw new RlsScopeError("CHEF_EQUIPE cannot create or modify teams");
      }
      const siteId = extractField(data, "siteId");
      if ("siteId" in scope) {
        if (siteId === undefined) {
          throw new RlsScopeError("Team requires scoped siteId");
        }
        if (siteId !== scope.siteId) {
          throw new RlsScopeError("Team siteId out of scope");
        }
      }
      break;
    }
    case "User": {
      const siteId = extractField(data, "siteId");
      const teamId = extractField(data, "teamId");
      if ("siteId" in scope) {
        if (siteId === undefined) {
          throw new RlsScopeError("User requires scoped siteId");
        }
        if (siteId !== scope.siteId) {
          throw new RlsScopeError("User siteId out of scope");
        }
      }
      if ("teamId" in scope) {
        if (teamId === undefined) {
          throw new RlsScopeError("User requires scoped teamId");
        }
        if (teamId !== scope.teamId) {
          throw new RlsScopeError("User teamId out of scope");
        }
      }
      break;
    }
    case "Pointage":
    case "Payment":
      break;
  }
}

async function assertWorkerIdInScope(basePrisma: PrismaClient, workerId: string): Promise<void> {
  const workerScope = getModelScopeFilter("Worker");
  if (!workerScope) return;
  if (isImpossibleScope(workerScope)) {
    throw new RlsScopeError("Missing scope context for worker relation");
  }

  const found = await basePrisma.worker.findFirst({
    where: { id: workerId, ...workerScope },
    select: { id: true },
  });
  if (!found) {
    throw new RlsScopeError("Worker out of scope");
  }
}

export async function validateRelatedIdsInScope(
  basePrisma: PrismaClient,
  model: ScopedModel,
  data: Record<string, unknown>,
  options?: { requireWorkerId?: boolean },
): Promise<void> {
  assertNotImpossibleScope(model);
  validateDirectFieldsInScope(model, data);

  if (model === "Pointage" || model === "Payment") {
    const workerId = extractField(data, "workerId");
    if (workerId) {
      await assertWorkerIdInScope(basePrisma, workerId);
    } else if (options?.requireWorkerId !== false) {
      throw new RlsScopeError(`${model} requires workerId in scope`);
    }
  }
}

function modelKey(model: ScopedModel): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

type QueryArgs = {
  where?: Record<string, unknown>;
  data?: Record<string, unknown>;
  create?: Record<string, unknown>;
  update?: Record<string, unknown>;
};
type QueryHandler = (args: QueryArgs) => Promise<unknown>;

function scopedReadHandler(model: ScopedModel) {
  return async ({ args, query }: { args: QueryArgs; query: QueryHandler }) => {
    const ctx = getRequestContext();
    // Unauthenticated routes (login, refresh) must read users without RLS scope.
    if (!ctx?.role) {
      return query(args);
    }
    const scope = getModelScopeFilter(model);
    if (scope) {
      args = { ...args, where: mergeWhere(args.where, scope) };
    }
    return query(args);
  };
}

function scopedWriteHandler(basePrisma: PrismaClient, model: ScopedModel, operation: string) {
  return async ({ args, query }: { args: QueryArgs; query: QueryHandler }) => {
    const scope = getModelScopeFilter(model);

    if (operation === "create") {
      await validateRelatedIdsInScope(basePrisma, model, args.data ?? {}, { requireWorkerId: true });
      return query(args);
    }

    if (operation === "update" || operation === "delete") {
      if (scope) {
        args = { ...args, where: mergeWhere(args.where, scope) };
      }
      if (args.data) {
        await validateRelatedIdsInScope(basePrisma, model, args.data, { requireWorkerId: false });
      }
      return query(args);
    }

    if (operation === "updateMany" || operation === "deleteMany") {
      if (scope) {
        args = { ...args, where: mergeWhere(args.where, scope) };
      }
      if (args.data) {
        await validateRelatedIdsInScope(basePrisma, model, args.data, { requireWorkerId: false });
      }
      return query(args);
    }

    if (operation === "upsert") {
      if (scope) {
        args = { ...args, where: mergeWhere(args.where, scope) };
      }
      await validateRelatedIdsInScope(basePrisma, model, args.create ?? {}, { requireWorkerId: true });
      if (args.update) {
        await validateRelatedIdsInScope(basePrisma, model, args.update, { requireWorkerId: false });
      }
      return query(args);
    }

    return query(args);
  };
}

/** Prisma Client extension — automatic row-level filtering on read and mutation operations. */
export function createRlsExtension(basePrisma: PrismaClient) {
  const query: Record<string, Record<string, ReturnType<typeof scopedReadHandler>>> = {};

  for (const model of SCOPED_MODELS) {
    const key = modelKey(model);
    query[key] = {};
    for (const op of READ_OPERATIONS) {
      query[key][op] = scopedReadHandler(model);
    }
    for (const op of MUTATION_OPERATIONS) {
      query[key][op] = scopedWriteHandler(basePrisma, model, op);
    }
  }

  return { query };
}
