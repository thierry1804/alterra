import { Router } from "express";
import { PaymentCycle, PaymentStatus, Role } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { deletePaymentsBatch, generatePayments } from "../services/payments/generate.service.js";
import { exportMvolaPayments, regenerateMvolaExport } from "../services/payments/mvola-export.service.js";
import { reconcileMvolaReleve } from "../services/payments/mvola-reconciliation.service.js";
import { detectMvolaReleveColumns } from "../services/payments/mvola-releve-parser.service.js";
import {
  correctPaymentAmount,
  getMvolaExportFile,
  listMvolaExports,
  listPayments,
  markPaymentFailed,
} from "../services/payments/list.service.js";
import { getReportStream } from "../services/storage/presigned-url.service.js";
import { ApiError } from "../middleware/error-handler.js";

export const paymentsRouter = Router();

const generateSchema = z.object({
  periodIso: z.string().min(2).max(16),
  cycle: z.enum(PaymentCycle).optional(),
  referenceYear: z.number().int().min(2000).max(2100).optional(),
  force: z.boolean().optional(),
});

const periodParams = z.object({
  period: z.string().min(2).max(16),
});

const exportQuerySchema = z.object({
  referenceYear: z.coerce.number().int().min(2000).max(2100).optional(),
  includeHeader: z.enum(["true", "false"]).optional(),
  siteId: z.guid().optional(),
});

const exportsListQuery = z.object({
  periodIso: z.string().min(1).max(16).optional(),
  referenceYear: z.coerce.number().int().min(2000).max(2100).optional(),
});

const importStatusColumnsSchema = z.object({
  contentBase64: z.string().min(1),
  hasHeaderRow: z.boolean().optional(),
  referenceRowNumber: z.number().int().min(1).optional(),
});

const importStatusSchema = z.object({
  contentBase64: z.string().min(1),
  hasHeaderRow: z.boolean().optional(),
  referenceRowNumber: z.number().int().min(1).optional(),
  mapping: z.record(z.string(), z.string()).optional(),
  dryRun: z.boolean().optional(),
});

const failPaymentSchema = z.object({
  failureReason: z.string().trim().min(10, "Motif requis (10 caractères minimum)"),
});

const listPaymentsQuery = z.object({
  periodIso: z.string().min(2).max(16),
  status: z.enum(PaymentStatus).optional(),
  referenceYear: z.coerce.number().int().min(2000).max(2100).optional(),
  siteId: z.guid().optional(),
});

const paymentIdParams = z.object({ id: z.guid() });

const correctPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  correctionReason: z.string().min(10),
});

paymentsRouter.get(
  "/payments",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(listPaymentsQuery, "query"),
  async (req, res, next) => {
    try {
      const query = req.query as unknown as z.infer<typeof listPaymentsQuery>;
      const result = await listPayments(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.patch(
  "/payments/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(paymentIdParams, "params"),
  validate(correctPaymentSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof correctPaymentSchema>;
      const payment = await correctPaymentAmount(req.params.id, body);
      res.json(payment);
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.patch(
  "/payments/:id/fail",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(paymentIdParams, "params"),
  validate(failPaymentSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof failPaymentSchema>;
      const payment = await markPaymentFailed(req.params.id, {
        failureReason: body.failureReason,
        userId: req.user!.sub,
        ip: req.ip,
        userAgent:
          typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
      });
      res.json(payment);
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.get(
  "/payments/exports",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(exportsListQuery, "query"),
  async (req, res, next) => {
    try {
      const query = req.query as unknown as z.infer<typeof exportsListQuery>;
      res.json({ data: await listMvolaExports(query) });
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.get(
  "/payments/exports/:id/download",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(z.object({ id: z.guid() }), "params"),
  async (req, res, next) => {
    try {
      const file = await getMvolaExportFile(req.params.id);
      if (!file) throw new ApiError(404, "NOT_FOUND", "Export introuvable");

      const stream = await getReportStream(file.minioKey);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
      stream.pipe(res);
      stream.on("error", next);
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.post(
  "/payments/generate",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(generateSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof generateSchema>;
      const result = await generatePayments(body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.delete(
  "/payments/:period",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(periodParams, "params"),
  validate(exportQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const { period } = req.params as z.infer<typeof periodParams>;
      const query = req.query as z.infer<typeof exportQuerySchema>;
      const result = await deletePaymentsBatch({
        periodIso: period,
        referenceYear: query.referenceYear,
        siteId: query.siteId,
        userId: req.user!.sub,
        ip: req.ip,
        userAgent:
          typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.get(
  "/payments/:period/export",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(periodParams, "params"),
  validate(exportQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const { period } = req.params as z.infer<typeof periodParams>;
      const query = req.query as z.infer<typeof exportQuerySchema>;
      const result = await exportMvolaPayments(period, {
        userId: req.user!.sub,
        ip: req.ip,
        userAgent:
          typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
        referenceYear: query.referenceYear,
        includeHeader: query.includeHeader === "true",
        siteId: query.siteId,
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.setHeader("X-ALTERRA-Exported-Count", String(result.exportedCount));
      res.setHeader("X-ALTERRA-Excluded-Count", String(result.excludedCount));
      res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.post(
  "/payments/:period/regenerate-export",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(periodParams, "params"),
  validate(exportQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const { period } = req.params as z.infer<typeof periodParams>;
      const query = req.query as z.infer<typeof exportQuerySchema>;
      const result = await regenerateMvolaExport(period, {
        userId: req.user!.sub,
        ip: req.ip,
        userAgent:
          typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
        referenceYear: query.referenceYear,
        includeHeader: query.includeHeader === "true",
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.setHeader("X-ALTERRA-Exported-Count", String(result.exportedCount));
      res.setHeader("X-ALTERRA-Version", String(result.version));
      res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.post(
  "/payments/import-status/columns",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(importStatusColumnsSchema),
  async (req, res, next) => {
    try {
      const { contentBase64, hasHeaderRow, referenceRowNumber } = req.body as z.infer<
        typeof importStatusColumnsSchema
      >;
      const buffer = Buffer.from(contentBase64, "base64");
      const result = detectMvolaReleveColumns(buffer, hasHeaderRow ?? true, referenceRowNumber);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.post(
  "/payments/import-status",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(importStatusSchema),
  async (req, res, next) => {
    try {
      const { contentBase64, hasHeaderRow, referenceRowNumber, mapping, dryRun } =
        req.body as z.infer<typeof importStatusSchema>;
      const buffer = Buffer.from(contentBase64, "base64");
      const result = await reconcileMvolaReleve(buffer, {
        hasHeaderRow,
        referenceRowNumber,
        mapping,
        dryRun,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
