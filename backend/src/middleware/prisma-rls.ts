import { AsyncLocalStorage } from "node:async_hooks";
import { Role } from "@prisma/client";
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
  if (!ctx?.role || ctx.role === Role.ADMIN || !ctx.siteId) return {};
  if (ctx.role === Role.CHEF_SERVICE) return { siteId: ctx.siteId };
  return {};
}

export function getTeamFilter(): Record<string, string> {
  const ctx = getRequestContext();
  if (!ctx?.role || ctx.role === Role.ADMIN || !ctx.teamId) return {};
  if (ctx.role === Role.CHEF_EQUIPE) return { teamId: ctx.teamId };
  return {};
}

function mergeWhere(
  existing: Record<string, unknown> | undefined,
  scope: Record<string, unknown>,
): Record<string, unknown> {
  if (!existing || Object.keys(existing).length === 0) return scope;
  return { AND: [existing, scope] };
}

function getModelScopeFilter(model: ScopedModel): Record<string, unknown> | null {
  const ctx = getRequestContext();
  if (!ctx?.role || ctx.role === Role.ADMIN) return null;

  switch (model) {
    case "Worker":
      if (ctx.role === Role.CHEF_SERVICE && ctx.siteId) return { siteId: ctx.siteId };
      if (ctx.role === Role.CHEF_EQUIPE && ctx.teamId) return { teamId: ctx.teamId };
      break;
    case "Pointage":
    case "Payment":
      if (ctx.role === Role.CHEF_SERVICE && ctx.siteId) return { worker: { siteId: ctx.siteId } };
      if (ctx.role === Role.CHEF_EQUIPE && ctx.teamId) return { worker: { teamId: ctx.teamId } };
      break;
    case "Team":
      if (ctx.role === Role.CHEF_SERVICE && ctx.siteId) return { siteId: ctx.siteId };
      if (ctx.role === Role.CHEF_EQUIPE && ctx.teamId) return { id: ctx.teamId };
      break;
    case "User":
      if (ctx.role === Role.CHEF_SERVICE && ctx.siteId) return { siteId: ctx.siteId };
      if (ctx.role === Role.CHEF_EQUIPE && ctx.teamId) return { teamId: ctx.teamId };
      break;
  }

  return null;
}

function modelKey(model: ScopedModel): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

type QueryArgs = { where?: Record<string, unknown> };
type QueryHandler = (args: QueryArgs) => Promise<unknown>;

function scopedReadHandler(model: ScopedModel) {
  return async ({ args, query }: { args: QueryArgs; query: QueryHandler }) => {
    const scope = getModelScopeFilter(model);
    if (scope) {
      args = { ...args, where: mergeWhere(args.where, scope) };
    }
    return query(args);
  };
}

/** Prisma Client extension — automatic row-level filtering on read operations. */
export function createRlsExtension() {
  const query: Record<string, Record<string, ReturnType<typeof scopedReadHandler>>> = {};

  for (const model of SCOPED_MODELS) {
    const key = modelKey(model);
    query[key] = {};
    for (const op of READ_OPERATIONS) {
      query[key][op] = scopedReadHandler(model);
    }
  }

  return { query };
}
