import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { enqueueWeeklyPdfJob, getWeeklyPdfJobStatus } from "../jobs/pdf.worker.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../middleware/error-handler.js";
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

const weeklyGenerateSchema = z.object({
  weekIso: z.string().regex(/^\d{4}-W\d{2}$/),
  siteId: z.string().uuid().optional(),
});

reportsRouter.post(
  "/reports/weekly/generate",
  requireAuth,
  requireRole(Role.CHEF_SERVICE, Role.ADMIN),
  validate(weeklyGenerateSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof weeklyGenerateSchema>;
      const siteId = body.siteId ?? req.user!.siteId;

      if (!siteId) {
        throw new ApiError(422, "SITE_REQUIRED", "siteId is required for weekly PDF generation");
      }

      if (req.user!.role === Role.CHEF_SERVICE && req.user!.siteId !== siteId) {
        throw new ApiError(403, "FORBIDDEN", "Cannot generate report for another site");
      }

      const { jobId } = await enqueueWeeklyPdfJob({
        siteId,
        weekIso: body.weekIso,
        requestedById: req.user!.sub,
      });

      res.status(202).json({ jobId, status: "queued" });
    } catch (err) {
      next(err);
    }
  },
);

reportsRouter.get(
  "/reports/weekly/jobs/:jobId",
  requireAuth,
  requireRole(Role.CHEF_SERVICE, Role.ADMIN),
  async (req, res, next) => {
    try {
      const status = await getWeeklyPdfJobStatus(req.params.jobId);
      if (!status) {
        throw new ApiError(404, "JOB_NOT_FOUND", "PDF job not found");
      }
      res.json(status);
    } catch (err) {
      next(err);
    }
  },
);

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
