import { Router } from "express";
import { PaymentCycle, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireAnyPermission, requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { deletePaymentsBatch, generatePayments } from "../services/payments/generate.service.js";
import {
  exportBordereau,
  exportMvolaPayments,
  regenerateMvolaExport,
} from "../services/payments/mvola-export.service.js";
import { reconcileMvolaReleve } from "../services/payments/mvola-reconciliation.service.js";
import { detectMvolaReleveColumns } from "../services/payments/mvola-releve-parser.service.js";
import {
  getMvolaExportFile,
  listMvolaExports,
  listPayments,
  markPaymentFailed,
} from "../services/payments/list.service.js";
import { getReportStream } from "../services/storage/presigned-url.service.js";
import { ApiError } from "../middleware/error-handler.js";
import type { AuthUser } from "../services/access/auth-user.js";
import { listBordereaux, listExportQueue } from "../services/payments/bordereaux.service.js";
import { openInvoice, regenerateInvoice } from "../services/payments/bordereau-invoice.service.js";
import {
  addAdjustment,
  removeAdjustment,
} from "../services/payments/payment-adjustment.service.js";
import {
  buildBordereauWorkbook,
  getBordereauDetail,
  returnBordereau,
  validateDg,
  validateFinance,
} from "../services/payments/bordereau-workflow.service.js";

export const paymentsRouter = Router();

function resolveSiteForUser(user: AuthUser, requested?: string): string | undefined {
  if (user.scope === "TOUS") return requested;
  if (!user.siteId || (requested && requested !== user.siteId)) {
    throw new ApiError(403, "FORBIDDEN_SITE", "Ce site est hors de votre périmètre");
  }
  return user.siteId;
}

const generateSchema = z.object({
  siteId: z.guid().optional(),
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

const listBordereauxQuery = z.object({
  periodIso: z.string().min(2).max(16).optional(),
  referenceYear: z.coerce.number().int().min(2000).max(2100).optional(),
  siteId: z.guid().optional(),
  group: z.enum(["TO_VALIDATE", "TO_EXPORT", "EXPORTED", "ALL"]).optional(),
  cursor: z.guid().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});

const paymentIdParams = z.object({ id: z.guid() });

const adjustmentSchema = z.object({
  amount: z
    .number()
    .finite()
    .refine((value) => value !== 0, "Le montant ne peut pas être nul")
    .refine((value) => Math.abs(value) <= 1_000_000_000, "Montant trop élevé"),
  reason: z.string().trim().min(10, "Motif requis (10 caractères minimum)").max(500),
});

paymentsRouter.get(
  "/payments",
  requireAuth,
  requirePermission("paiement:lecture"),
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

paymentsRouter.post(
  "/payments/:id/adjustments",
  requireAuth,
  requirePermission("paiement:correction"),
  validate(paymentIdParams, "params"),
  validate(adjustmentSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof adjustmentSchema>;
      const adjustment = await addAdjustment(req.params.id as string, req.user!, body);
      res.status(201).json({ id: adjustment.id });
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.delete(
  "/payments/adjustments/:id",
  requireAuth,
  requirePermission("paiement:correction"),
  validate(paymentIdParams, "params"),
  async (req, res, next) => {
    try {
      await removeAdjustment(req.params.id as string, req.user!);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.patch(
  "/payments/:id/fail",
  requireAuth,
  requirePermission("paiement:correction"),
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
  requirePermission("paiement:lecture"),
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
  requirePermission("paiement:export"),
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
  requirePermission("bordereau:generation"),
  validate(generateSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof generateSchema>;
      const result = await generatePayments({
        ...body,
        siteId: resolveSiteForUser(req.user!, body.siteId),
        userId: req.user!.sub,
        ip: req.ip,
        userAgent:
          typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.get(
  "/bordereaux",
  requireAuth,
  requirePermission("bordereau:lecture"),
  validate(listBordereauxQuery, "query"),
  async (req, res, next) => {
    try {
      const query = req.query as unknown as z.infer<typeof listBordereauxQuery>;
      res.json(
        await listBordereaux({
          periodIso: query.periodIso,
          referenceYear: query.referenceYear,
          siteId: resolveSiteForUser(req.user!, query.siteId),
          group: query.group,
          cursor: query.cursor,
          take: query.take,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

const bordereauIdParams = z.object({ id: z.guid() });
const exportQueueQuery = z.object({
  periodIso: z.string().min(2).max(16).optional(),
  referenceYear: z.coerce.number().int().min(2000).max(2100).optional(),
  group: z.enum(["TO_EXPORT", "EXPORTED", "ALL"]).optional(),
  cursor: z.guid().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});
const returnBordereauSchema = z.object({ reason: z.string().trim().min(10).max(500) });

paymentsRouter.get(
  "/bordereaux/export-queue",
  requireAuth,
  requirePermission("paiement:export"),
  validate(exportQueueQuery, "query"),
  async (req, res, next) => {
    try {
      res.json(
        await listExportQueue(req.user!, req.query as unknown as z.infer<typeof exportQueueQuery>),
      );
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.post(
  "/bordereaux/:id/export",
  requireAuth,
  requirePermission("paiement:export"),
  validate(bordereauIdParams, "params"),
  validate(exportQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const query = req.query as z.infer<typeof exportQuerySchema>;
      const result = await exportBordereau(req.params.id as string, {
        userId: req.user!.sub,
        actor: req.user!,
        ip: req.ip,
        userAgent:
          typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
        includeHeader: query.includeHeader === "true",
      });
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.setHeader("X-ALTERRA-Exported-Count", String(result.exportedCount));
      res.setHeader("X-ALTERRA-Exported-Total", result.totalAmount);
      res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.get(
  "/bordereaux/:id",
  requireAuth,
  requirePermission("bordereau:lecture"),
  validate(bordereauIdParams, "params"),
  async (req, res, next) => {
    try {
      res.json(await getBordereauDetail(req.params.id as string, req.user!));
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.get(
  "/bordereaux/:id/download",
  requireAuth,
  requirePermission("bordereau:lecture"),
  validate(bordereauIdParams, "params"),
  async (req, res, next) => {
    try {
      const { buffer, filename } = await buildBordereauWorkbook(req.params.id as string, req.user!);
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.get(
  "/bordereaux/:id/invoice",
  requireAuth,
  requirePermission("facture:lecture"),
  validate(bordereauIdParams, "params"),
  async (req, res, next) => {
    try {
      const { stream, filename } = await openInvoice(req.params.id as string, req.user!);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
      stream.pipe(res);
      stream.on("error", next);
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.post(
  "/bordereaux/:id/invoice/regenerate",
  requireAuth,
  requirePermission("facture:generation"),
  validate(bordereauIdParams, "params"),
  async (req, res, next) => {
    try {
      await regenerateInvoice(req.params.id as string, req.user!);
      res.json({ regenerated: true });
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.post(
  "/bordereaux/:id/validate-finance",
  requireAuth,
  requirePermission("bordereau:valider_finance"),
  validate(bordereauIdParams, "params"),
  async (req, res, next) => {
    try {
      await validateFinance(req.params.id as string, req.user!);
      res.json({ status: "FINANCE_VALIDATED" });
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.post(
  "/bordereaux/:id/validate-dg",
  requireAuth,
  requirePermission("bordereau:valider_dg"),
  validate(bordereauIdParams, "params"),
  async (req, res, next) => {
    try {
      await validateDg(req.params.id as string, req.user!);
      res.json({ status: "DG_VALIDATED" });
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.post(
  "/bordereaux/:id/return",
  requireAuth,
  requireAnyPermission("bordereau:valider_finance", "bordereau:valider_dg"),
  validate(bordereauIdParams, "params"),
  validate(returnBordereauSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof returnBordereauSchema>;
      await returnBordereau(req.params.id as string, req.user!, body.reason);
      res.json({ status: "GENERATED" });
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.delete(
  "/payments/:period",
  requireAuth,
  requirePermission("paiement:suppression"),
  validate(periodParams, "params"),
  validate(exportQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const { period } = req.params as z.infer<typeof periodParams>;
      const query = req.query as z.infer<typeof exportQuerySchema>;
      const result = await deletePaymentsBatch({
        periodIso: period,
        referenceYear: query.referenceYear,
        siteId: resolveSiteForUser(req.user!, query.siteId),
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
  requirePermission("paiement:export"),
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
      res.setHeader("X-ALTERRA-Exported-Total", result.totalAmount);
      res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.post(
  "/payments/:period/regenerate-export",
  requireAuth,
  requirePermission("paiement:export"),
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
        siteId: resolveSiteForUser(req.user!, query.siteId),
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
      res.setHeader("X-ALTERRA-Exported-Count", String(result.exportedCount));
      res.setHeader("X-ALTERRA-Version", String(result.version));
      res.setHeader("X-ALTERRA-Exported-Total", result.totalAmount);
      res.send(result.buffer);
    } catch (err) {
      next(err);
    }
  },
);

paymentsRouter.post(
  "/payments/import-status/columns",
  requireAuth,
  requirePermission("paiement:import_statut"),
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
  requirePermission("paiement:import_statut"),
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
