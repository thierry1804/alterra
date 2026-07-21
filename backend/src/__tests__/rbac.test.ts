import { Role } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import {
  getModelScopeFilter,
  getSiteFilter,
  getTeamFilter,
  IMPOSSIBLE_SCOPE_FILTER,
  RlsScopeError,
  runWithRequestContext,
  validateDirectFieldsInScope,
  validateRelatedIdsInScope,
} from "../middleware/prisma-rls.js";
import { writeAuditLog } from "../services/audit/audit.service.js";

const MOCK_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_CDS_ID = "00000000-0000-4000-8000-000000000002";
const MOCK_CDE_ID = "00000000-0000-4000-8000-000000000003";
const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";
const MOCK_TEAM_ID = "00000000-0000-4000-8000-000000000020";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
  basePrisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("../lib/prisma-base.js", () => ({
  basePrisma: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "../lib/prisma.js";
import { basePrisma } from "../lib/prisma-base.js";

function adminAuthHeader() {
  return `Bearer ${signAccessToken({
    sub: MOCK_ADMIN_ID,
    role: Role.ADMIN,
    siteId: MOCK_SITE_ID,
    teamId: null,
  })}`;
}

function cdeAuthHeader() {
  return `Bearer ${signAccessToken({
    sub: MOCK_CDE_ID,
    role: Role.CHEF_EQUIPE,
    siteId: MOCK_SITE_ID,
    teamId: MOCK_TEAM_ID,
  })}`;
}

describe("RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({
      id: MOCK_ADMIN_ID,
      email: "admin@alterra.mg",
      role: Role.ADMIN,
      siteId: MOCK_SITE_ID,
      teamId: null,
    } as never);
  });

  describe("requireRole", () => {
    it("allows ADMIN on admin-only route", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/v1/auth/mfa/setup")
        .set("Authorization", adminAuthHeader());

      expect(res.status).not.toBe(403);
    });

    it("returns 403 FORBIDDEN with details when CDE hits admin-only route", async () => {
      const app = createApp();
      const res = await request(app)
        .post("/api/v1/auth/mfa/setup")
        .set("Authorization", cdeAuthHeader());

      expect(res.status).toBe(403);
      expect(res.body.code).toBe("FORBIDDEN");
      expect(res.body.details).toEqual({
        requiredRoles: [Role.ADMIN],
        actualRole: Role.CHEF_EQUIPE,
      });
    });
  });

  describe("scope filter helpers", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("getSiteFilter returns siteId for CHEF_SERVICE", () => {
      runWithRequestContext(
        { role: Role.CHEF_SERVICE, siteId: MOCK_SITE_ID, teamId: null },
        () => {
          expect(getSiteFilter()).toEqual({ siteId: MOCK_SITE_ID });
        },
      );
    });

    it("getSiteFilter returns empty for ADMIN", () => {
      runWithRequestContext({ role: Role.ADMIN, siteId: MOCK_SITE_ID, teamId: null }, () => {
        expect(getSiteFilter()).toEqual({});
      });
    });

    it("getTeamFilter returns teamId for CHEF_EQUIPE", () => {
      runWithRequestContext(
        { role: Role.CHEF_EQUIPE, siteId: MOCK_SITE_ID, teamId: MOCK_TEAM_ID },
        () => {
          expect(getTeamFilter()).toEqual({ teamId: MOCK_TEAM_ID });
        },
      );
    });

    it("getTeamFilter returns empty for CHEF_SERVICE", () => {
      runWithRequestContext(
        { role: Role.CHEF_SERVICE, siteId: MOCK_SITE_ID, teamId: MOCK_TEAM_ID },
        () => {
          expect(getTeamFilter()).toEqual({});
        },
      );
    });

    it("getSiteFilter returns impossible filter when CHEF_SERVICE has no siteId", () => {
      runWithRequestContext({ role: Role.CHEF_SERVICE, siteId: null, teamId: null }, () => {
        expect(getSiteFilter()).toEqual(IMPOSSIBLE_SCOPE_FILTER);
      });
    });

    it("getTeamFilter returns impossible filter when CHEF_EQUIPE has no teamId", () => {
      runWithRequestContext({ role: Role.CHEF_EQUIPE, siteId: MOCK_SITE_ID, teamId: null }, () => {
        expect(getTeamFilter()).toEqual(IMPOSSIBLE_SCOPE_FILTER);
      });
    });
  });

  describe("getModelScopeFilter fail-closed", () => {
    it("returns impossible filter when CHEF_SERVICE has no siteId", () => {
      runWithRequestContext({ role: Role.CHEF_SERVICE, siteId: null, teamId: null }, () => {
        expect(getModelScopeFilter("Worker")).toEqual(IMPOSSIBLE_SCOPE_FILTER);
        expect(getModelScopeFilter("Pointage")).toEqual(IMPOSSIBLE_SCOPE_FILTER);
      });
    });

    it("returns impossible filter when CHEF_EQUIPE has no teamId", () => {
      runWithRequestContext({ role: Role.CHEF_EQUIPE, siteId: MOCK_SITE_ID, teamId: null }, () => {
        expect(getModelScopeFilter("Worker")).toEqual(IMPOSSIBLE_SCOPE_FILTER);
        expect(getModelScopeFilter("Team")).toEqual(IMPOSSIBLE_SCOPE_FILTER);
      });
    });

    it("returns null for ADMIN (no filter)", () => {
      runWithRequestContext({ role: Role.ADMIN, siteId: MOCK_SITE_ID, teamId: null }, () => {
        expect(getModelScopeFilter("Worker")).toBeNull();
      });
    });

    it("returns impossible filter when no request context", () => {
      expect(getModelScopeFilter("Worker")).toEqual(IMPOSSIBLE_SCOPE_FILTER);
    });
  });

  describe("validateDirectFieldsInScope", () => {
    it("accepts Worker create data matching CHEF_SERVICE siteId", () => {
      runWithRequestContext(
        { role: Role.CHEF_SERVICE, siteId: MOCK_SITE_ID, teamId: null },
        () => {
          expect(() =>
            validateDirectFieldsInScope("Worker", { siteId: MOCK_SITE_ID, firstName: "A" }),
          ).not.toThrow();
        },
      );
    });

    it("rejects Worker create data with wrong siteId", () => {
      runWithRequestContext(
        { role: Role.CHEF_SERVICE, siteId: MOCK_SITE_ID, teamId: null },
        () => {
          expect(() =>
            validateDirectFieldsInScope("Worker", {
              siteId: "00000000-0000-4000-8000-000000000099",
            }),
          ).toThrow(RlsScopeError);
        },
      );
    });

    it("rejects Worker create when CHEF_SERVICE has no siteId (fail-closed)", () => {
      runWithRequestContext({ role: Role.CHEF_SERVICE, siteId: null, teamId: null }, () => {
        expect(() => validateDirectFieldsInScope("Worker", { siteId: MOCK_SITE_ID })).toThrow(
          RlsScopeError,
        );
      });
    });

    it("rejects Pointage create without workerId at relation validation layer", () => {
      runWithRequestContext(
        { role: Role.CHEF_EQUIPE, siteId: MOCK_SITE_ID, teamId: MOCK_TEAM_ID },
        () => {
          expect(() => validateDirectFieldsInScope("Pointage", { quantity: 1 })).not.toThrow();
        },
      );
    });

    it("requires workerId on Pointage create", async () => {
      await runWithRequestContext(
        { role: Role.CHEF_SERVICE, siteId: MOCK_SITE_ID, teamId: null },
        async () => {
          await expect(
            validateRelatedIdsInScope(basePrisma as never, "Pointage", { quantity: 1 }),
          ).rejects.toThrow(RlsScopeError);
        },
      );
    });

    it("allows Pointage update without workerId in patch data", async () => {
      await runWithRequestContext(
        { role: Role.CHEF_SERVICE, siteId: MOCK_SITE_ID, teamId: null },
        async () => {
          await expect(
            validateRelatedIdsInScope(
              basePrisma as never,
              "Pointage",
              { status: "VALIDATED", validatedById: MOCK_CDS_ID },
              { requireWorkerId: false },
            ),
          ).resolves.toBeUndefined();
        },
      );
    });

    it("rejects Team create for CHEF_EQUIPE", () => {
      runWithRequestContext(
        { role: Role.CHEF_EQUIPE, siteId: MOCK_SITE_ID, teamId: MOCK_TEAM_ID },
        () => {
          expect(() =>
            validateDirectFieldsInScope("Team", { siteId: MOCK_SITE_ID, name: "Equipe B" }),
          ).toThrow(RlsScopeError);
        },
      );
    });

    it("rejects User create without siteId for CHEF_SERVICE", () => {
      runWithRequestContext(
        { role: Role.CHEF_SERVICE, siteId: MOCK_SITE_ID, teamId: null },
        () => {
          expect(() =>
            validateDirectFieldsInScope("User", { email: "x@test.mg", role: Role.CHEF_EQUIPE }),
          ).toThrow(RlsScopeError);
        },
      );
    });
  });

  describe("writeAuditLog", () => {
    it("persists audit entry with expected shape", async () => {
      vi.mocked(basePrisma.auditLog.create).mockResolvedValue({
        id: BigInt(1),
        userId: MOCK_CDS_ID,
        action: "CREATE",
        entityType: "Worker",
        entityId: "worker-1",
        before: null,
        after: { id: "worker-1" },
        ip: "127.0.0.1",
        userAgent: "vitest",
        createdAt: new Date(),
      });

      await writeAuditLog({
        userId: MOCK_CDS_ID,
        action: "CREATE",
        entityType: "Worker",
        entityId: "worker-1",
        after: { id: "worker-1", matricule: "W001" },
        ip: "127.0.0.1",
        userAgent: "vitest",
      });

      expect(basePrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: MOCK_CDS_ID,
          action: "CREATE",
          entityType: "Worker",
          entityId: "worker-1",
          before: undefined,
          after: { id: "worker-1", matricule: "W001" },
          ip: "127.0.0.1",
          userAgent: "vitest",
        },
      });
    });
  });
});
