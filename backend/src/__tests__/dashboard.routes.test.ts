import { Role } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { signAccessToken } from "../lib/jwt.js";

const MOCK_ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MOCK_SITE_ID = "00000000-0000-4000-8000-000000000010";

vi.mock("../services/dashboard/dashboard.service.js", () => ({
  getDashboardSummary: vi.fn(),
}));

import { getDashboardSummary } from "../services/dashboard/dashboard.service.js";

function adminAuthHeader() {
  return `Bearer ${signAccessToken({
    sub: MOCK_ADMIN_ID,
    role: Role.ADMIN,
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
});
