import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/prisma.js", () => ({ prisma: {}, basePrisma: {} }));
vi.mock("../lib/prisma-base.js", () => ({ basePrisma: {} }));

import { createApp } from "../app.js";
import { SYSTEM_ROLES, systemRolePermissions } from "../services/access/system-roles.js";
import { collectRouteAccess, type RouteAccess } from "./helpers/route-access.js";

interface BaselineRoute {
  method: string;
  path: string;
  auth: boolean;
  roles: string[] | null;
}

const baseline: BaselineRoute[] = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "route-access.baseline.json"), "utf8"),
);

const ALL_ROLES = SYSTEM_ROLES.map((role) => role.code);

const AUTHENTICATED_WITHOUT_PERMISSION = new Set([
  "GET /api/v1/me",
  "GET /api/v1/app-settings/map-key",
  "GET /api/v1/notifications",
  "PATCH /api/v1/notifications/:id/read",
  "DELETE /api/v1/notifications/push-subscribe",
  "POST /api/v1/notifications/push-subscribe",
  "POST /api/v1/notifications/read-all",
  "GET /api/v1/notifications/unread-count",
  "GET /api/v1/notifications/vapid-public-key",
]);

const KNOWN_ROLE_GAINS: Record<string, string[]> = {
  "PATCH /api/v1/pointages/:id/photo": ["ADMIN"],
  "PATCH /api/v1/pointages/:id/resubmit": ["ADMIN"],
};

function routeKey(route: { method: string; path: string }): string {
  return `${route.method} ${route.path}`;
}

function effectiveRoles(route: RouteAccess): string[] | null {
  const holders = (predicate: (permissions: ReadonlySet<string>, mfa: boolean) => boolean) =>
    SYSTEM_ROLES.filter((role) => predicate(systemRolePermissions(role.id), role.mfaRequired)).map(
      (role) => role.code,
    );
  if (route.permissions) {
    return holders((permissions) => route.permissions!.every((key) => permissions.has(key)));
  }
  if (route.anyPermissions) {
    return holders((permissions) => route.anyPermissions!.some((key) => permissions.has(key)));
  }
  if (route.mfaRole) return holders((_permissions, mfa) => mfa);
  return null;
}

describe("route access", () => {
  const routes = collectRouteAccess(createApp());

  it("keeps every route that existed before the RBAC migration", () => {
    const current = new Set(routes.map(routeKey));
    expect(baseline.map(routeKey).filter((key) => !current.has(key))).toEqual([]);
  });

  it("only adds the access administration routes", () => {
    const before = new Set(baseline.map(routeKey));
    const added = routes.map(routeKey).filter((key) => !before.has(key));
    expect(added.every((key) => key.includes("/api/v1/access/"))).toBe(true);
  });

  it("gives the three system roles exactly the access they had", () => {
    const baselineByKey = new Map(baseline.map((route) => [routeKey(route), route]));
    const mismatches: string[] = [];

    for (const route of routes) {
      const before = baselineByKey.get(routeKey(route));
      if (!before) continue;
      const expectedRoles = new Set(before.roles ?? (before.auth ? ALL_ROLES : []));
      for (const gained of KNOWN_ROLE_GAINS[routeKey(route)] ?? []) expectedRoles.add(gained);

      const now = effectiveRoles(route);
      const actualRoles = new Set(now ?? (route.auth ? ALL_ROLES : []));

      if (route.auth !== before.auth) mismatches.push(`${routeKey(route)}: auth changed`);
      if ([...expectedRoles].sort().join() !== [...actualRoles].sort().join()) {
        mismatches.push(
          `${routeKey(route)}: expected [${[...expectedRoles].sort()}] got [${[...actualRoles].sort()}]`,
        );
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("denies by default: every authenticated route declares a permission", () => {
    const undeclared = routes
      .filter((route) => route.auth && effectiveRoles(route) === null)
      .map(routeKey)
      .filter((key) => !AUTHENTICATED_WITHOUT_PERMISSION.has(key));
    expect(undeclared).toEqual([]);
  });
});
