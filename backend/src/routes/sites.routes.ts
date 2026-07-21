import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { ApiError } from "../middleware/error-handler.js";
import { writeAuditLog } from "../services/audit/audit.service.js";

export const sitesRouter = Router();

const siteIdParams = z.object({ id: z.string().uuid() });

const createSiteSchema = z.object({
  name: z.string().min(2),
  shortCode: z.string().min(2).max(10),
  location: z.string().optional(),
  geoLat: z.number().optional(),
  geoLng: z.number().optional(),
  active: z.boolean().optional(),
});

const updateSiteSchema = z.object({
  name: z.string().min(2).optional(),
  location: z.string().nullable().optional(),
  geoLat: z.number().nullable().optional(),
  geoLng: z.number().nullable().optional(),
  active: z.boolean().optional(),
});

sitesRouter.get("/sites", requireAuth, async (req, res, next) => {
  try {
    const where = req.user!.role === Role.ADMIN ? {} : { id: req.user!.siteId ?? "__none__" };
    const sites = await prisma.site.findMany({ where, orderBy: { name: "asc" } });
    res.json({ data: sites });
  } catch (err) {
    next(err);
  }
});

sitesRouter.get(
  "/sites/:id",
  requireAuth,
  validate(siteIdParams, "params"),
  async (req, res, next) => {
    try {
      const where =
        req.user!.role === Role.ADMIN
          ? { id: req.params.id }
          : { id: req.user!.siteId ?? "__none__" };

      const site = await prisma.site.findFirst({ where });
      if (!site) throw new ApiError(404, "NOT_FOUND", "Site introuvable");
      res.json(site);
    } catch (err) {
      next(err);
    }
  },
);

sitesRouter.post(
  "/sites",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(createSiteSchema),
  async (req, res, next) => {
    try {
      const site = await prisma.site.create({ data: req.body });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "CREATE",
        entityType: "Site",
        entityId: site.id,
        after: site,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(201).json(site);
    } catch (err) {
      next(err);
    }
  },
);

sitesRouter.patch(
  "/sites/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(siteIdParams, "params"),
  validate(updateSiteSchema),
  async (req, res, next) => {
    try {
      const before = await prisma.site.findUnique({ where: { id: req.params.id } });
      if (!before) throw new ApiError(404, "NOT_FOUND", "Site introuvable");

      const site = await prisma.site.update({ where: { id: req.params.id }, data: req.body });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "Site",
        entityId: site.id,
        before,
        after: site,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(site);
    } catch (err) {
      next(err);
    }
  },
);

sitesRouter.delete(
  "/sites/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(siteIdParams, "params"),
  async (req, res, next) => {
    try {
      const before = await prisma.site.findUnique({ where: { id: req.params.id } });
      if (!before) throw new ApiError(404, "NOT_FOUND", "Site introuvable");

      const site = await prisma.site.update({
        where: { id: req.params.id },
        data: { active: false },
      });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "DEACTIVATE",
        entityType: "Site",
        entityId: site.id,
        before,
        after: site,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(site);
    } catch (err) {
      next(err);
    }
  },
);
