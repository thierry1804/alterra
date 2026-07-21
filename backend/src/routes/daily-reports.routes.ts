import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import {
  enqueueDailyPdfJob,
  getDailyPdfJobStatus,
} from "../jobs/pdf.worker.js";
import { requireAuth } from "../middleware/auth.js";
import { ApiError } from "../middleware/error-handler.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { writeAuditLog } from "../services/audit/audit.service.js";
import {
  getDailyClosePreview,
  parseDailyDate,
} from "../services/reports/daily-data.service.js";

export const dailyReportsRouter = Router();

const dailyDateQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  siteId: z.string().uuid().optional(),
});

const dailyGenerateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  siteId: z.string().uuid().optional(),
  signatureText: z.string().min(3),
  confirmPending: z.boolean().optional(),
});

dailyReportsRouter.get(
  "/reports/daily/preview",
  requireAuth,
  requireRole(Role.CHEF_SERVICE, Role.ADMIN),
  validate(dailyDateQuery, "query"),
  async (req, res, next) => {
    try {
      const query = req.query as z.infer<typeof dailyDateQuery>;
      const siteId = query.siteId ?? req.user!.siteId;
      if (!siteId) {
        throw new ApiError(422, "SITE_REQUIRED", "siteId is required");
      }
      if (req.user!.role === Role.CHEF_SERVICE && req.user!.siteId !== siteId) {
        throw new ApiError(403, "FORBIDDEN", "Site hors périmètre");
      }

      parseDailyDate(query.date);
      const preview = await getDailyClosePreview(siteId, query.date);
      res.json(preview);
    } catch (err) {
      next(err);
    }
  },
);

dailyReportsRouter.post(
  "/reports/daily",
  requireAuth,
  requireRole(Role.CHEF_SERVICE, Role.ADMIN),
  validate(dailyGenerateSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof dailyGenerateSchema>;
      const siteId = body.siteId ?? req.user!.siteId;
      if (!siteId) {
        throw new ApiError(422, "SITE_REQUIRED", "siteId is required");
      }
      if (req.user!.role === Role.CHEF_SERVICE && req.user!.siteId !== siteId) {
        throw new ApiError(403, "FORBIDDEN", "Site hors périmètre");
      }

      parseDailyDate(body.date);
      const preview = await getDailyClosePreview(siteId, body.date);
      if (preview.requiresConfirm && !body.confirmPending) {
        throw new ApiError(
          422,
          "CONFIRM_REQUIRED",
          "Des pointages sont encore en attente ou en précisions — confirmez la clôture",
        );
      }

      const { jobId } = await enqueueDailyPdfJob({
        siteId,
        date: body.date,
        requestedById: req.user!.sub,
        signatureText: body.signatureText.trim(),
      });

      await writeAuditLog({
        userId: req.user!.sub,
        action: "DAILY_CLOSE",
        entityType: "DailyReport",
        entityId: `${siteId}:${body.date}`,
        after: {
          siteId,
          date: body.date,
          jobId,
          signatureText: body.signatureText.trim(),
          confirmPending: body.confirmPending ?? false,
        },
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(202).json({ jobId, status: "queued" });
    } catch (err) {
      next(err);
    }
  },
);

dailyReportsRouter.get(
  "/reports/daily/jobs/:jobId",
  requireAuth,
  requireRole(Role.CHEF_SERVICE, Role.ADMIN),
  async (req, res, next) => {
    try {
      const status = await getDailyPdfJobStatus(req.params.jobId);
      if (!status) {
        throw new ApiError(404, "JOB_NOT_FOUND", "PDF job not found");
      }
      res.json(status);
    } catch (err) {
      next(err);
    }
  },
);
