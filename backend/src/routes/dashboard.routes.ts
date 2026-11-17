import { Router } from "express";

import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../middleware/error-handler.js";
import { getDashboardSummary } from "../services/dashboard/dashboard.service.js";
import { getCostsSummary } from "../services/dashboard/costs.service.js";

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

const WEEK_RE = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

const costsQuery = z
  .object({
    siteId: z.guid().optional(),
    categoryId: z.guid().optional(),
    fromWeek: z.string().regex(WEEK_RE).optional(),
    toWeek: z.string().regex(WEEK_RE).optional(),
  })
  .refine((query) => !query.fromWeek || !query.toWeek || query.fromWeek <= query.toWeek, {
    message: "La semaine de début doit précéder la semaine de fin",
    path: ["fromWeek"],
  });

dashboardRouter.get(
  "/dashboard/costs",
  requireAuth,
  requirePermission("tableau_bord:lecture", "pointage:voir_montants"),
  validate(costsQuery, "query"),
  async (req, res, next) => {
    try {
      const query = req.query as z.infer<typeof costsQuery>;
      let siteId = query.siteId;
      if (req.user!.scope !== "TOUS") {
        if (!req.user!.siteId) {
          throw new ApiError(403, "SITE_REQUIRED", "Aucun site n'est associé à ce compte");
        }
        siteId = req.user!.siteId;
      }
      const summary = await getCostsSummary(prisma, { ...query, siteId: siteId ?? undefined });
      res.json(summary);
    } catch (err) {
      next(err);
    }
  },
);
