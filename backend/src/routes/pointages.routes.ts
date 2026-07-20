import { Router } from "express";
import { z } from "zod";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole, siteScope } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";

export const pointagesRouter = Router();

const syncItemSchema = z.object({
  clientUuid: z.string().uuid(),
  workerId: z.string().uuid(),
  activityId: z.string().uuid(),
  quantity: z.number().positive(),
  date: z.coerce.date(),
  parcelleId: z.string().uuid().optional(),
  geoLat: z.number().optional(),
  geoLng: z.number().optional(),
  notes: z.string().max(500).optional(),
  createdByClientAt: z.coerce.date(),
});

const syncBatchSchema = z.object({
  batch: z.array(syncItemSchema).min(1).max(100),
});

/**
 * Idempotent batch sync — the mechanism that makes offline PWA capture safe.
 * clientUuid carries a unique DB constraint; replaying an already-synced
 * item returns 'already_exists' instead of erroring or duplicating.
 */
pointagesRouter.post(
  "/pointages/sync",
  requireAuth,
  requireRole(Role.CHEF_EQUIPE, Role.CHEF_SERVICE, Role.ADMIN),
  validate(syncBatchSchema),
  async (req, res, next) => {
    try {
      const { batch } = req.body as z.infer<typeof syncBatchSchema>;
      const results: Array<{ clientUuid: string; status: string; id?: string; reason?: string }> = [];

      for (const item of batch) {
        try {
          const activity = await prisma.activity.findUniqueOrThrow({ where: { id: item.activityId } });
          const amount = item.quantity * Number(activity.unitRate);

          const created = await prisma.pointage.create({
            data: {
              clientUuid: item.clientUuid,
              workerId: item.workerId,
              activityId: item.activityId,
              quantity: item.quantity,
              unitRateSnapshot: activity.unitRate,
              amount,
              date: item.date,
              parcelleId: item.parcelleId,
              geoLat: item.geoLat,
              geoLng: item.geoLng,
              notes: item.notes,
              enteredById: req.user!.sub,
              createdByClientAt: item.createdByClientAt,
            },
          });
          results.push({ clientUuid: item.clientUuid, status: "created", id: created.id });
        } catch (err) {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
            const existing = await prisma.pointage.findUnique({ where: { clientUuid: item.clientUuid } });
            results.push({ clientUuid: item.clientUuid, status: "already_exists", id: existing?.id });
          } else {
            results.push({
              clientUuid: item.clientUuid,
              status: "rejected",
              reason: err instanceof Error ? err.message : "unknown_error",
            });
          }
        }
      }

      res.json({ results });
    } catch (err) {
      next(err);
    }
  },
);

pointagesRouter.get("/pointages", requireAuth, siteScope, async (req, res, next) => {
  try {
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const take = 50;

    const pointages = await prisma.pointage.findMany({
      where: req.siteScope ? { worker: { siteId: req.siteScope } } : {},
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: "desc" },
    });

    const hasMore = pointages.length > take;
    const data = hasMore ? pointages.slice(0, take) : pointages;

    res.json({ data, nextCursor: hasMore ? data[data.length - 1].id : null, hasMore });
  } catch (err) {
    next(err);
  }
});

pointagesRouter.patch(
  "/pointages/:id/validate",
  requireAuth,
  requireRole(Role.CHEF_SERVICE, Role.ADMIN),
  async (req, res, next) => {
    try {
      const pointage = await prisma.pointage.update({
        where: { id: req.params.id },
        data: { status: "VALIDATED", validatedById: req.user!.sub, validatedAt: new Date() },
      });
      res.json(pointage);
    } catch (err) {
      next(err);
    }
  },
);

const rejectSchema = z.object({ rejectionReason: z.string().min(3) });

pointagesRouter.patch(
  "/pointages/:id/reject",
  requireAuth,
  requireRole(Role.CHEF_SERVICE, Role.ADMIN),
  validate(rejectSchema),
  async (req, res, next) => {
    try {
      const pointage = await prisma.pointage.update({
        where: { id: req.params.id },
        data: { status: "REJECTED", rejectionReason: req.body.rejectionReason },
      });
      res.json(pointage);
    } catch (err) {
      next(err);
    }
  },
);
