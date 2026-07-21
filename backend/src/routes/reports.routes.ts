import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { exportReport } from "../services/reports/export.service.js";
import {
  generateReport,
  resolveMonthRange,
  type ReportType,
} from "../services/reports/reports.service.js";

export const reportsRouter = Router();

const reportTypeSchema = z.enum(["pointages", "payments", "presence-by-site"]);

const reportQuerySchema = z.object({
  type: reportTypeSchema,
  month: z.string().regex(/^\d{4}-\d{2}$/),
  siteId: z.string().uuid().optional(),
});

const exportQuerySchema = reportQuerySchema.extend({
  format: z.enum(["csv", "xlsx", "pdf"]),
});

reportsRouter.get(
  "/reports/preview",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(reportQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const query = req.query as z.infer<typeof reportQuerySchema>;
      const { dateFrom, dateTo } = resolveMonthRange(query.month);
      const report = await generateReport(query.type as ReportType, {
        dateFrom,
        dateTo,
        siteId: query.siteId,
      });
      res.json(report);
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/reports/export",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(exportQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const query = req.query as z.infer<typeof exportQuerySchema>;
      const { dateFrom, dateTo } = resolveMonthRange(query.month);
      const report = await generateReport(query.type as ReportType, {
        dateFrom,
        dateTo,
        siteId: query.siteId,
      });
      const exported = await exportReport(report, query.format);

      res.setHeader("Content-Type", exported.contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${exported.filename}"`);
      res.send(exported.buffer);
    } catch (err) {
      next(err);
    }
  },
);
