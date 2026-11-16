import { Router } from "express";

import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { prisma } from "../lib/prisma.js";
import { getDashboardSummary } from "../services/dashboard/dashboard.service.js";

export const dashboardRouter = Router();

const dashboardQuery = z.object({
  siteId: z.guid().optional(),
});

dashboardRouter.get(
  "/dashboard/kpis",
  requireAuth,
  requirePermission("tableau_bord:lecture"),
  validate(dashboardQuery, "query"),
  async (req, res, next) => {
    try {
      const query = req.query as z.infer<typeof dashboardQuery>;
      const scopedSiteId =
        req.user!.scope !== "TOUS" ? (req.user!.siteId ?? query.siteId) : query.siteId;

      const summary = await getDashboardSummary(prisma, scopedSiteId ?? undefined);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  },
);
