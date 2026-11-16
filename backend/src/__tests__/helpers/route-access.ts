import type { Express } from "express";
import { requireAuth } from "../../middleware/auth.js";

type Handler = ((...args: unknown[]) => unknown) & {
  __roles?: string[];
  __permissions?: string[];
  __anyPermissions?: string[];
  __mfaRole?: boolean;
};

interface Layer {
  name: string;
  handle: Handler & { stack?: Layer[] };
  regexp: RegExp;
  route?: { path: string; methods: Record<string, boolean>; stack: Layer[] };
}

export interface RouteAccess {
  method: string;
  path: string;
  auth: boolean;
  roles: string[] | null;
  permissions: string[] | null;
  anyPermissions: string[] | null;
  mfaRole: boolean;
}

function mountPath(layer: Layer): string {
  return layer.regexp.source
    .replace(/^\^/, "")
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, "")
    .replace(/\\\//g, "/");
}

interface Inherited {
  auth: boolean;
  roles: string[] | null;
  permissions: string[] | null;
  anyPermissions: string[] | null;
  mfaRole: boolean;
}

function apply(state: Inherited, handle: Handler): Inherited {
  const next = { ...state };
  if (handle === (requireAuth as unknown as Handler)) next.auth = true;
  if (handle.__roles) next.roles = handle.__roles;
  if (handle.__permissions) next.permissions = handle.__permissions;
  if (handle.__anyPermissions) next.anyPermissions = handle.__anyPermissions;
  if (handle.__mfaRole) next.mfaRole = true;
  return next;
}

function walk(stack: Layer[], prefix: string, inherited: Inherited, out: RouteAccess[]): void {
  let state = inherited;
  for (const layer of stack) {
    if (layer.route) {
      let routeState = state;
      for (const routeLayer of layer.route.stack) routeState = apply(routeState, routeLayer.handle);
      const methods = Object.keys(layer.route.methods).filter((m) => layer.route!.methods[m]);
      for (const method of methods) {
        out.push({
          method: method.toUpperCase(),
          path: `${prefix}${layer.route.path === "/" ? "" : layer.route.path}` || "/",
          auth: routeState.auth,
          roles: routeState.roles,
          permissions: routeState.permissions,
          anyPermissions: routeState.anyPermissions,
          mfaRole: routeState.mfaRole,
        });
      }
    } else if (layer.name === "router" && layer.handle.stack) {
      walk(layer.handle.stack, `${prefix}${mountPath(layer)}`, state, out);
    } else {
      state = apply(state, layer.handle);
    }
  }
}

export function collectRouteAccess(app: Express): RouteAccess[] {
  const stack = (app as unknown as { _router: { stack: Layer[] } })._router.stack;
  const out: RouteAccess[] = [];
  walk(
    stack,
    "",
    { auth: false, roles: null, permissions: null, anyPermissions: null, mfaRole: false },
    out,
  );
  return out
    .filter((route) => route.path.startsWith("/api/v1"))
    .sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));
}
