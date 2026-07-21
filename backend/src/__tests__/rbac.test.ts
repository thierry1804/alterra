import { Role } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import {
  getSiteFilter,
  getTeamFilter,
  runWithRequestContext,
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
