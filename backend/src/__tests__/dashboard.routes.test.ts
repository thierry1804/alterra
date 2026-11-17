import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";
import { SYSTEM_ROLE_IDS } from "../services/access/system-roles.js";

const MOCK_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";

vi.mock("../services/dashboard/dashboard.service.js", () => ({
  getDashboardSummary: vi.fn(),
}));

vi.mock("../services/dashboard/costs.service.js", () => ({
  getCostsSummary: vi.fn(),
}));

import { getDashboardSummary } from "../services/dashboard/dashboard.service.js";
import { getCostsSummary } from "../services/dashboard/costs.service.js";

function adminAuthHeader() {
  return `Bearer ${signAccessToken({
    sub: MOCK_ADMIN_ID,
    roleId: SYSTEM_ROLE_IDS.ADMIN,
    siteId: MOCK_SITE_ID,
    teamId: null,
  })}`;
}

describe("Dashboard API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getDashboardSummary).mockResolvedValue({
      kpis: {
        activeWorkers: 50,
        presenceRate: 82.5,
        pendingPointages: 4,
        pendingPaymentsCount: 2,
        pendingPaymentsAmount: 250000,
        pendingTechnicalPointages: 0,
        bordereauxToValidate: 0,
        bordereauxToExport: 0,
      },
      presenceLast7Days: [],
      workforceTrend: [],
      alerts: [],
    });
  });

  it("GET /dashboard/kpis returns summary for admin", async () => {
    const app = createApp();
    const res = await request(app)
      .get("/api/v1/dashboard/kpis")
      .set("Authorization", adminAuthHeader());

    expect(res.status).toBe(200);
    expect(res.body.kpis.activeWorkers).toBe(50);
    expect(getDashboardSummary).toHaveBeenCalled();
  });

  describe("GET /dashboard/costs", () => {
    const OTHER_SITE_ID = "00000000-0000-4000-8000-000000000011";

    function chefServiceHeader(siteId: string | null) {
      return `Bearer ${signAccessToken({
        sub: MOCK_ADMIN_ID,
        roleId: SYSTEM_ROLE_IDS.CHEF_SERVICE,
        siteId,
        teamId: null,
      })}`;
    }

    beforeEach(() => {
      vi.mocked(getCostsSummary).mockResolvedValue({} as never);
    });

    it("keeps a site-scoped user on their own site whatever the query says", async () => {
      const res = await request(createApp())
        .get("/api/v1/dashboard/costs")
        .query({ siteId: OTHER_SITE_ID })
        .set("Authorization", chefServiceHeader(MOCK_SITE_ID));

      expect(res.status).toBe(200);
      expect(getCostsSummary).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ siteId: MOCK_SITE_ID }),
      );
    });

    it("refuses a site-scoped user who has no site", async () => {
      const res = await request(createApp())
        .get("/api/v1/dashboard/costs")
        .query({ siteId: OTHER_SITE_ID })
        .set("Authorization", chefServiceHeader(null));

      expect(res.status).toBe(403);
      expect(getCostsSummary).not.toHaveBeenCalled();
    });

    it("lets an all-sites user choose the site", async () => {
      const res = await request(createApp())
        .get("/api/v1/dashboard/costs")
        .query({ siteId: OTHER_SITE_ID })
        .set("Authorization", adminAuthHeader());

      expect(res.status).toBe(200);
      expect(getCostsSummary).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ siteId: OTHER_SITE_ID }),
      );
    });

    it("rejects an inverted week range", async () => {
      const res = await request(createApp())
        .get("/api/v1/dashboard/costs")
        .query({ fromWeek: "2026-W47", toWeek: "2026-W40" })
        .set("Authorization", adminAuthHeader());

      expect(res.status).toBe(422);
    });
  });
});
