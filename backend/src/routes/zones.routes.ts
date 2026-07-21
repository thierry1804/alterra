import { Router } from "express";
import { z } from "zod";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { geoPolygonSchema } from "../lib/geo-json.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { ApiError } from "../middleware/error-handler.js";
import { writeAuditLog } from "../services/audit/audit.service.js";

export const zonesRouter = Router();

const zoneIdParams = z.object({ id: z.string().uuid() });

const listZonesQuery = z.object({
  siteId: z.string().uuid().optional(),
});

const createZoneSchema = z.object({
  siteId: z.string().uuid(),
  name: z.string().min(1).max(120),
  geoPolygon: geoPolygonSchema,
});

const updateZoneSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  geoPolygon: geoPolygonSchema,
});

zonesRouter.get(
  "/zones",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(listZonesQuery, "query"),
  async (req, res, next) => {
    try {
      const { siteId } = req.query as z.infer<typeof listZonesQuery>;
      const zones = await prisma.zone.findMany({
        where: siteId ? { siteId } : {},
        include: { _count: { select: { parcelles: true } } },
        orderBy: [{ siteId: "asc" }, { name: "asc" }],
      });
      res.json({ data: zones });
    } catch (err) {
      next(err);
    }
  },
);

zonesRouter.get(
  "/zones/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(zoneIdParams, "params"),
  async (req, res, next) => {
    try {
      const zone = await prisma.zone.findUnique({
        where: { id: req.params.id },
        include: { parcelles: { orderBy: { name: "asc" } } },
      });
      if (!zone) throw new ApiError(404, "NOT_FOUND", "Zone introuvable");
      res.json(zone);
    } catch (err) {
      next(err);
    }
  },
);

zonesRouter.post(
  "/zones",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(createZoneSchema),
  async (req, res, next) => {
    try {
      const site = await prisma.site.findUnique({ where: { id: req.body.siteId } });
      if (!site) throw new ApiError(404, "NOT_FOUND", "Site introuvable");

      const zone = await prisma.zone.create({
        data: {
          siteId: req.body.siteId,
          name: req.body.name.trim(),
          geoPolygon: req.body.geoPolygon ?? undefined,
        },
      });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "CREATE",
        entityType: "Zone",
        entityId: zone.id,
        after: zone,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(201).json(zone);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return next(new ApiError(409, "DUPLICATE", "Une zone avec ce nom existe déjà sur le site"));
      }
      next(err);
    }
  },
);

zonesRouter.patch(
  "/zones/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(zoneIdParams, "params"),
  validate(updateZoneSchema),
  async (req, res, next) => {
    try {
      const before = await prisma.zone.findUnique({ where: { id: req.params.id } });
      if (!before) throw new ApiError(404, "NOT_FOUND", "Zone introuvable");

      const zone = await prisma.zone.update({
        where: { id: req.params.id },
        data: req.body,
      });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "Zone",
        entityId: zone.id,
        before,
        after: zone,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(zone);
    } catch (err) {
      next(err);
    }
  },
);

zonesRouter.delete(
  "/zones/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(zoneIdParams, "params"),
  async (req, res, next) => {
    try {
      const zone = await prisma.zone.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { parcelles: true } } },
      });
      if (!zone) throw new ApiError(404, "NOT_FOUND", "Zone introuvable");
      if (zone._count.parcelles > 0) {
        throw new ApiError(409, "ZONE_HAS_PARCELLES", "Supprimez d'abord les parcelles de la zone");
      }

      await prisma.zone.delete({ where: { id: zone.id } });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "DELETE",
        entityType: "Zone",
        entityId: zone.id,
        before: zone,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
