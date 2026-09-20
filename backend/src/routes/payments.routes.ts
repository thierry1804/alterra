import { Router } from "express";
import { PaymentCycle, PaymentStatus, Role } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { generatePayments } from "../services/payments/generate.service.js";
import { exportMvolaPayments } from "../services/payments/mvola-export.service.js";
import { reconcileMvolaReleve } from "../services/payments/mvola-reconciliation.service.js";
import { detectMvolaReleveColumns } from "../services/payments/mvola-releve-parser.service.js";
import {
  correctPaymentAmount,
  listMvolaExports,
  listPayments,
  markPaymentFailed,
} from "../services/payments/list.service.js";

export const paymentsRouter = Router();

const generateSchema = z.object({
  periodIso: z.string().min(2).max(16),
  cycle: z.nativeEnum(PaymentCycle).optional(),
  referenceYear: z.number().int().min(2000).max(2100).optional(),
});

const periodParams = z.object({
  period: z.string().min(2).max(16),
});

const exportQuerySchema = z.object({
  referenceYear: z.coerce.number().int().min(2000).max(2100).optional(),
  includeHeader: z.enum(["true", "false"]).optional(),
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
  mapping: z.record(z.string()).optional(),
  dryRun: z.boolean().optional(),
});

const failPaymentSchema = z.object({
  failureReason: z.string().trim().min(10, "Motif requis (10 caractères minimum)"),
});

const listPaymentsQuery = z.object({
  periodIso: z.string().min(2).max(16),
  status: z.nativeEnum(PaymentStatus).optional(),
  referenceYear: z.coerce.number().int().min(2000).max(2100).optional(),
});

const paymentIdParams = z.object({ id: z.string().uuid() });

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
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
      });
      res.json(payment);
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.get("/payments/exports", requireAuth, requireRole(Role.ADMIN), async (_req, res, next) => {
  try {
    res.json({ data: await listMvolaExports() });
  } catch (err) {
    next(err);
  }
});

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
      const { contentBase64, hasHeaderRow, referenceRowNumber, mapping, dryRun } = req.body as z.infer<
        typeof importStatusSchema
      >;
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
