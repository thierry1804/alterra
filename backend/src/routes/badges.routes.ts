import { Router, type Request } from "express";
import { z } from "zod";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { normalizeNfcTagId } from "../lib/nfc-tag.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { ApiError } from "../middleware/error-handler.js";
import { writeAuditLog } from "../services/audit/audit.service.js";

export const badgesRouter = Router();

const badgeIdParams = z.object({ id: z.string().uuid() });

const listBadgesQuery = z.object({
  workerId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

const createBadgeSchema = z.object({
  workerId: z.string().uuid(),
  nfcTagId: z.string().min(4).max(64),
});

const updateBadgeSchema = z.object({
  nfcTagId: z.string().min(4).max(64).optional(),
  revokedAt: z.coerce.date().nullable().optional(),
});

function buildBadgeScopeWhere(req: Request): Prisma.BadgeWhereInput {
  const where: Prisma.BadgeWhereInput = {};
  if (req.user!.role === Role.CHEF_SERVICE && req.user!.siteId) {
    where.worker = { siteId: req.user!.siteId };
  }
  if (req.user!.role === Role.CHEF_EQUIPE && req.user!.teamId) {
    where.worker = { teamId: req.user!.teamId };
  }
  return where;
}

badgesRouter.get(
  "/badges",
  requireAuth,
  requireRole(Role.ADMIN, Role.CHEF_SERVICE, Role.CHEF_EQUIPE),
  validate(listBadgesQuery, "query"),
  async (req, res, next) => {
    try {
      const { workerId, siteId, teamId, active } = req.query as z.infer<typeof listBadgesQuery>;

      const where: Prisma.BadgeWhereInput = {
        ...buildBadgeScopeWhere(req),
      };

      if (workerId) where.workerId = workerId;
      if (active === true) where.revokedAt = null;
      if (active === false) where.revokedAt = { not: null };

      if (req.user!.role === Role.ADMIN) {
        if (siteId) where.worker = { ...(where.worker as Prisma.WorkerWhereInput), siteId };
        if (teamId) where.worker = { ...(where.worker as Prisma.WorkerWhereInput), teamId };
      }

      const badges = await prisma.badge.findMany({
        where,
        include: {
          worker: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              matricule: true,
              siteId: true,
              teamId: true,
            },
          },
        },
        orderBy: [{ assignedAt: "desc" }],
      });

      res.json({
        data: badges.map((badge) => ({
          id: badge.id,
          workerId: badge.workerId,
          nfcTagId: badge.nfcTagId,
          assignedAt: badge.assignedAt,
          revokedAt: badge.revokedAt,
          worker: badge.worker,
        })),
      });
    } catch (err) {
      next(err);
    }
  },
);

badgesRouter.get(
  "/badges/:id",
  requireAuth,
  requireRole(Role.ADMIN, Role.CHEF_SERVICE, Role.CHEF_EQUIPE),
  validate(badgeIdParams, "params"),
  async (req, res, next) => {
    try {
      const badge = await prisma.badge.findFirst({
        where: { id: req.params.id, ...buildBadgeScopeWhere(req) },
        include: {
          worker: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              matricule: true,
              siteId: true,
              teamId: true,
            },
          },
        },
      });
      if (!badge) throw new ApiError(404, "NOT_FOUND", "Badge introuvable");
      res.json(badge);
    } catch (err) {
      next(err);
    }
  },
);

badgesRouter.post(
  "/badges",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(createBadgeSchema),
  async (req, res, next) => {
    try {
      const worker = await prisma.worker.findFirst({
        where: { id: req.body.workerId, deletedAt: null },
      });
      if (!worker) throw new ApiError(404, "NOT_FOUND", "Travailleur introuvable");

      const existingWorkerBadge = await prisma.badge.findUnique({
        where: { workerId: worker.id },
      });
      if (existingWorkerBadge?.revokedAt === null) {
        throw new ApiError(409, "WORKER_HAS_BADGE", "Ce MOC possède déjà un badge actif");
      }

      const nfcTagId = normalizeNfcTagId(req.body.nfcTagId);
      if (!nfcTagId) {
        throw new ApiError(422, "INVALID_TAG", "Identifiant NFC invalide");
      }

      const badge = existingWorkerBadge
        ? await prisma.badge.update({
            where: { id: existingWorkerBadge.id },
            data: { nfcTagId, revokedAt: null, assignedAt: new Date() },
            include: {
              worker: {
                select: { id: true, firstName: true, lastName: true, matricule: true },
              },
            },
          })
        : await prisma.badge.create({
            data: {
              workerId: worker.id,
              nfcTagId,
            },
            include: {
              worker: {
                select: { id: true, firstName: true, lastName: true, matricule: true },
              },
            },
          });

      await writeAuditLog({
        userId: req.user!.sub,
        action: "CREATE",
        entityType: "Badge",
        entityId: badge.id,
        after: badge,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json(badge);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return next(new ApiError(409, "DUPLICATE", "Ce tag NFC est déjà enregistré"));
      }
      next(err);
    }
  },
);

badgesRouter.patch(
  "/badges/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(badgeIdParams, "params"),
  validate(updateBadgeSchema),
  async (req, res, next) => {
    try {
      const before = await prisma.badge.findUnique({ where: { id: req.params.id } });
      if (!before) throw new ApiError(404, "NOT_FOUND", "Badge introuvable");

      const data: Prisma.BadgeUpdateInput = {};
      if (req.body.nfcTagId !== undefined) {
        const nfcTagId = normalizeNfcTagId(req.body.nfcTagId);
        if (!nfcTagId) throw new ApiError(422, "INVALID_TAG", "Identifiant NFC invalide");
        data.nfcTagId = nfcTagId;
      }
      if (req.body.revokedAt !== undefined) {
        data.revokedAt = req.body.revokedAt;
      }

      const badge = await prisma.badge.update({
        where: { id: before.id },
        data,
        include: {
          worker: {
            select: { id: true, firstName: true, lastName: true, matricule: true },
          },
        },
      });

      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "Badge",
        entityId: badge.id,
        before,
        after: badge,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(badge);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return next(new ApiError(409, "DUPLICATE", "Ce tag NFC est déjà enregistré"));
      }
      next(err);
    }
  },
);

badgesRouter.delete(
  "/badges/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(badgeIdParams, "params"),
  async (req, res, next) => {
    try {
      const before = await prisma.badge.findUnique({ where: { id: req.params.id } });
      if (!before) throw new ApiError(404, "NOT_FOUND", "Badge introuvable");

      const badge = await prisma.badge.update({
        where: { id: before.id },
        data: { revokedAt: new Date() },
      });

      await writeAuditLog({
        userId: req.user!.sub,
        action: "DELETE",
        entityType: "Badge",
        entityId: badge.id,
        before,
        after: badge,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(badge);
    } catch (err) {
      next(err);
    }
  },
);
