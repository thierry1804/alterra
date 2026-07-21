import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { prisma } from "../lib/prisma.js";
import { getDashboardSummary } from "../services/dashboard/dashboard.service.js";

export const dashboardRouter = Router();

const dashboardQuery = z.object({
  siteId: z.string().uuid().optional(),
});

dashboardRouter.get(
  "/dashboard/kpis",
  requireAuth,
  requireRole(Role.ADMIN, Role.CHEF_SERVICE),
  validate(dashboardQuery, "query"),
  async (req, res, next) => {
    try {
      const query = req.query as z.infer<typeof dashboardQuery>;
      const scopedSiteId =
        req.user!.role === Role.CHEF_SERVICE ? req.user!.siteId ?? query.siteId : query.siteId;

      const summary = await getDashboardSummary(prisma, scopedSiteId ?? undefined);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  },
);
