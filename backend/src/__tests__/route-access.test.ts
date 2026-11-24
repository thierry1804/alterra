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

const LEGACY_ROLES = SYSTEM_ROLES.filter((role) =>
  ["ADMIN", "CHEF_SERVICE", "CHEF_EQUIPE"].includes(role.code),
);
const ALL_ROLES = LEGACY_ROLES.map((role) => role.code);

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
  "GET /api/v1/zones": ["CHEF_EQUIPE", "CHEF_SERVICE"],
  "GET /api/v1/zones/:id": ["CHEF_EQUIPE", "CHEF_SERVICE"],
  "GET /api/v1/parcels": ["CHEF_EQUIPE", "CHEF_SERVICE"],
  "GET /api/v1/parcels/:id": ["CHEF_EQUIPE", "CHEF_SERVICE"],
};

function routeKey(route: { method: string; path: string }): string {
  return `${route.method} ${route.path}`;
}

function effectiveRoles(route: RouteAccess): string[] | null {
  const holders = (predicate: (permissions: ReadonlySet<string>, mfa: boolean) => boolean) =>
    LEGACY_ROLES.filter((role) => predicate(systemRolePermissions(role.id), role.mfaRequired)).map(
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
    const removedOnPurpose = new Set([
      "POST /api/v1/invoices/generate",
      "POST /api/v1/invoices/:id/regenerate",
      "PATCH /api/v1/payments/:id",
    ]);
    expect(
      baseline.map(routeKey).filter((key) => !current.has(key) && !removedOnPurpose.has(key)),
    ).toEqual([]);
  });

  it("only adds the access administration and technical validation routes", () => {
    const before = new Set(baseline.map(routeKey));
    const allowed = new Set([
      "GET /api/v1/pointages/synthese",
      "POST /api/v1/pointages/validate-technical",
      "GET /api/v1/bordereaux",
      "POST /api/v1/payments/:id/adjustments",
      "DELETE /api/v1/payments/adjustments/:id",
      "GET /api/v1/bordereaux/export-queue",
      "POST /api/v1/bordereaux/:id/export",
      "PATCH /api/v1/app-settings/isi",
      "GET /api/v1/bordereaux/:id",
      "GET /api/v1/bordereaux/:id/download",
      "GET /api/v1/bordereaux/:id/invoice",
      "POST /api/v1/bordereaux/:id/invoice/regenerate",
      "POST /api/v1/bordereaux/:id/validate-finance",
      "POST /api/v1/bordereaux/:id/validate-dg",
      "POST /api/v1/bordereaux/:id/return",
      "POST /api/v1/parcels/import",
      "GET /api/v1/dashboard/costs",
      "POST /api/v1/auth/mfa/enroll/setup",
      "POST /api/v1/auth/mfa/enroll/verify",
    ]);
    const added = routes.map(routeKey).filter((key) => !before.has(key));
    expect(added.filter((key) => !allowed.has(key) && !key.includes("/api/v1/access/"))).toEqual(
      [],
    );
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
