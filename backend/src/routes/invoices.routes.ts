import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { ApiError } from "../middleware/error-handler.js";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  generateInvoicesForPeriod,
  listInvoices,
  regenerateInvoice,
} from "../services/payments/activity-invoices.service.js";
import { getReportStream } from "../services/storage/presigned-url.service.js";
import { writeAuditLog } from "../services/audit/audit.service.js";

export const invoicesRouter = Router();

const listInvoicesQuery = z.object({
  periodIso: z.string().min(1).max(16).optional(),
  referenceYear: z.coerce.number().int().min(2000).max(2100).optional(),
});

const invoiceIdParams = z.object({ id: z.string().uuid() });

const generateInvoicesSchema = z.object({
  periodIso: z.string().min(2).max(16),
  referenceYear: z.number().int().min(2000).max(2100).optional(),
});

invoicesRouter.get(
  "/invoices",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(listInvoicesQuery, "query"),
  async (req, res, next) => {
    try {
      const query = req.query as z.infer<typeof listInvoicesQuery>;
      const data = await listInvoices(query);
      res.json({ data });
    } catch (err) {
      next(err);
    }
  },
);

invoicesRouter.post(
  "/invoices/generate",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(generateInvoicesSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof generateInvoicesSchema>;
      const created = await generateInvoicesForPeriod(
        body.periodIso,
        body.referenceYear,
        req.user!.sub,
        {
          ip: req.ip,
          userAgent:
            typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
        },
      );
      res.status(201).json({ created });
    } catch (err) {
      next(err);
    }
  },
);

invoicesRouter.post(
  "/invoices/:id/regenerate",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(invoiceIdParams, "params"),
  async (req, res, next) => {
    try {
      const updated = await regenerateInvoice(req.params.id, req.user!.sub, {
        ip: req.ip,
        userAgent:
          typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  },
);

invoicesRouter.get(
  "/invoices/:id/download",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(invoiceIdParams, "params"),
  async (req, res, next) => {
    try {
      const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
      if (!invoice) throw new ApiError(404, "NOT_FOUND", "Facture introuvable");

      await writeAuditLog({
        userId: req.user!.sub,
        action: "DOWNLOAD",
        entityType: "Invoice",
        entityId: invoice.id,
        after: { periodIso: invoice.periodIso, referenceYear: invoice.referenceYear },
        ip: req.ip,
        userAgent:
          typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
      });

      const stream = await getReportStream(invoice.fileKey);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="facture_${invoice.periodIso}_${invoice.id.slice(0, 8)}.pdf"`,
      );
      stream.pipe(res);
      stream.on("error", next);
    } catch (err) {
      next(err);
    }
  },
);
