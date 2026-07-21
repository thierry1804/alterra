import { Router } from "express";
import { PaymentCycle, PaymentStatus, Role } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { generatePayments } from "../services/payments/generate.service.js";
import { exportMvolaPayments } from "../services/payments/mvola-export.service.js";
import { importMvolaStatus } from "../services/payments/mvola-import.service.js";
import { correctPaymentAmount, listPayments } from "../services/payments/list.service.js";

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
});

const importStatusSchema = z.object({
  periodIso: z.string().min(2).max(16),
  contentBase64: z.string().min(1),
  referenceYear: z.number().int().min(2000).max(2100).optional(),
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
      const query = req.query as z.infer<typeof listPaymentsQuery>;
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
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
        referenceYear: query.referenceYear,
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
  "/payments/import-status",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(importStatusSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof importStatusSchema>;
      const buffer = Buffer.from(body.contentBase64, "base64");
      const result = await importMvolaStatus(buffer, body.periodIso, body.referenceYear);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
