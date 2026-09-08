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

export const parcelsRouter = Router();

const parcelIdParams = z.object({ id: z.string().uuid() });

const listParcelsQuery = z.object({
  zoneId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
});

const parcelCodeSchema = z.string().trim().min(1).max(20).transform((v) => v.toUpperCase()).nullable();

const createParcelSchema = z.object({
  zoneId: z.string().uuid(),
  name: z.string().min(1).max(120),
  code: parcelCodeSchema.optional(),
  surfaceHa: z.number().positive().optional(),
  geoPolygon: geoPolygonSchema,
});

const updateParcelSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  code: parcelCodeSchema.optional(),
  surfaceHa: z.number().positive().nullable().optional(),
  geoPolygon: geoPolygonSchema,
});

parcelsRouter.get(
  "/parcels",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(listParcelsQuery, "query"),
  async (req, res, next) => {
    try {
      const { zoneId, siteId } = req.query as z.infer<typeof listParcelsQuery>;
      const where: Prisma.ParcelleWhereInput = {};
      if (zoneId) where.zoneId = zoneId;
      if (siteId) where.zone = { siteId };

      const parcelles = await prisma.parcelle.findMany({
        where,
        include: { zone: { select: { id: true, name: true, siteId: true } } },
        orderBy: [{ zoneId: "asc" }, { name: "asc" }],
      });
      res.json({ data: parcelles });
    } catch (err) {
      next(err);
    }
  },
);

parcelsRouter.get(
  "/parcels/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(parcelIdParams, "params"),
  async (req, res, next) => {
    try {
      const parcelle = await prisma.parcelle.findUnique({
        where: { id: req.params.id },
        include: { zone: true },
      });
      if (!parcelle) throw new ApiError(404, "NOT_FOUND", "Parcelle introuvable");
      res.json(parcelle);
    } catch (err) {
      next(err);
    }
  },
);

parcelsRouter.post(
  "/parcels",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(createParcelSchema),
  async (req, res, next) => {
    try {
      const zone = await prisma.zone.findUnique({ where: { id: req.body.zoneId } });
      if (!zone) throw new ApiError(404, "NOT_FOUND", "Zone introuvable");

      const parcelle = await prisma.parcelle.create({
        data: {
          zoneId: req.body.zoneId,
          name: req.body.name.trim(),
          code: req.body.code ?? undefined,
          surfaceHa: req.body.surfaceHa,
          geoPolygon: req.body.geoPolygon ?? undefined,
        },
      });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "CREATE",
        entityType: "Parcelle",
        entityId: parcelle.id,
        after: parcelle,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(201).json(parcelle);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return next(
          new ApiError(
            409,
            "DUPLICATE",
            "Une parcelle avec ce nom ou ce code existe déjà dans la zone",
          ),
        );
      }
      next(err);
    }
  },
);

parcelsRouter.patch(
  "/parcels/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(parcelIdParams, "params"),
  validate(updateParcelSchema),
  async (req, res, next) => {
    try {
      const before = await prisma.parcelle.findUnique({ where: { id: req.params.id } });
      if (!before) throw new ApiError(404, "NOT_FOUND", "Parcelle introuvable");

      const parcelle = await prisma.parcelle.update({
        where: { id: req.params.id },
        data: req.body,
      });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "Parcelle",
        entityId: parcelle.id,
        before,
        after: parcelle,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(parcelle);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return next(
          new ApiError(
            409,
            "DUPLICATE",
            "Une parcelle avec ce nom ou ce code existe déjà dans la zone",
          ),
        );
      }
      next(err);
    }
  },
);

parcelsRouter.delete(
  "/parcels/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(parcelIdParams, "params"),
  async (req, res, next) => {
    try {
      const parcelle = await prisma.parcelle.findUnique({
        where: { id: req.params.id },
        include: { _count: { select: { pointages: true } } },
      });
      if (!parcelle) throw new ApiError(404, "NOT_FOUND", "Parcelle introuvable");
      if (parcelle._count.pointages > 0) {
        throw new ApiError(409, "PARCELLE_HAS_POINTAGES", "Parcelle référencée par des pointages");
      }

      await prisma.parcelle.delete({ where: { id: parcelle.id } });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "DELETE",
        entityType: "Parcelle",
        entityId: parcelle.id,
        before: parcelle,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
