import { Router } from "express";
import { z } from "zod";
import archiver from "archiver";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { ApiError } from "../middleware/error-handler.js";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  generateInvoicesForPeriod,
  listInvoices,
  listInvoicesForZip,
  regenerateInvoice,
} from "../services/payments/activity-invoices.service.js";
import { getReportStream } from "../services/storage/presigned-url.service.js";
import { writeAuditLog } from "../services/audit/audit.service.js";

export const invoicesRouter = Router();

const listInvoicesQuery = z.object({
  periodIso: z.string().min(1).max(16).optional(),
  referenceYear: z.coerce.number().int().min(2000).max(2100).optional(),
});

// periodIso obligatoire ici : sans filtre, l'archive téléchargerait toutes les factures jamais générées.
const downloadAllQuery = z.object({
  periodIso: z.string().min(1).max(16),
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

invoicesRouter.get(
  "/invoices/download-all",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(downloadAllQuery, "query"),
  async (req, res, next) => {
    try {
      const query = req.query as unknown as z.infer<typeof downloadAllQuery>;
      const invoices = await listInvoicesForZip(query);
      if (invoices.length === 0) {
        throw new ApiError(404, "NOT_FOUND", "Aucune facture pour cette période");
      }

      await writeAuditLog({
        userId: req.user!.sub,
        action: "DOWNLOAD",
        entityType: "Invoice",
        entityId: "bulk",
        after: { periodIso: query.periodIso, referenceYear: query.referenceYear, count: invoices.length },
        ip: req.ip,
        userAgent:
          typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
      });

      const periodLabel = invoices[0].periodIso;
      res.setHeader("Content-Type", "application/zip");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="factures_${periodLabel}.zip"`,
      );

      const archive = archiver("zip", { zlib: { level: 9 } });
      archive.on("error", next);
      archive.pipe(res);

      const usedNames = new Set<string>();
      for (const invoice of invoices) {
        const base = `${invoice.activityLabel}_${invoice.siteShortCode}`
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-zA-Z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "");
        let name = `facture_${base}.pdf`;
        if (usedNames.has(name)) name = `facture_${base}_${invoice.id.slice(0, 8)}.pdf`;
        usedNames.add(name);

        const stream = await getReportStream(invoice.fileKey);
        archive.append(stream, { name });
      }

      await archive.finalize();
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
