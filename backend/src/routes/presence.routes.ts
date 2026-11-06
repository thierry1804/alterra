import { Router, type Request } from "express";
import { z } from "zod";
import { Prisma, PresenceSource, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { syncPresenceBatch } from "../services/presence/sync.service.js";
import { IMPOSSIBLE_SCOPE_FILTER } from "../middleware/prisma-rls.js";

export const presenceRouter = Router();

const syncItemSchema = z.object({
  clientUuid: z.string().uuid(),
  workerId: z.string().uuid(),
  date: z.coerce.date(),
  arrivalTime: z.coerce.date(),
  badgeNfcTagId: z.string().min(1).max(64),
  source: z.enum(PresenceSource),
  parcelleId: z.string().uuid().optional(),
  createdByClientAt: z.coerce.date(),
});

const syncBatchSchema = z.object({
  batch: z.array(syncItemSchema).min(1).max(100),
});

const listPresenceQuery = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  workerId: z.string().uuid().optional(),
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});

/** PresenceRecord n'est pas couvert par la RLS (middleware/prisma-rls.ts) : scope manuel par rôle. */
function buildPresenceScopeWhere(req: Request): Prisma.PresenceRecordWhereInput {
  if (req.user!.role === Role.CHEF_SERVICE) {
    if (!req.user!.siteId) return IMPOSSIBLE_SCOPE_FILTER;
    return { worker: { siteId: req.user!.siteId } };
  }
  if (req.user!.role === Role.CHEF_EQUIPE) {
    if (!req.user!.teamId) return IMPOSSIBLE_SCOPE_FILTER;
    return { worker: { teamId: req.user!.teamId } };
  }
  return {};
}

presenceRouter.post(
  "/presence/sync",
  requireAuth,
  requireRole(Role.CHEF_EQUIPE, Role.CHEF_SERVICE, Role.ADMIN),
  validate(syncBatchSchema),
  async (req, res, next) => {
    try {
      const { batch } = req.body as z.infer<typeof syncBatchSchema>;
      const results = await syncPresenceBatch(batch, req.user!.sub);
      res.json({ results });
    } catch (err) {
      next(err);
    }
  },
);

presenceRouter.get(
  "/presence",
  requireAuth,
  requireRole(Role.CHEF_EQUIPE, Role.CHEF_SERVICE, Role.ADMIN),
  validate(listPresenceQuery, "query"),
  async (req, res, next) => {
    try {
      const { dateFrom, dateTo, workerId, cursor, take } = req.query as z.infer<
        typeof listPresenceQuery
      >;

      const pageSize = take ?? 50;
      const where: Prisma.PresenceRecordWhereInput = {
        ...buildPresenceScopeWhere(req),
        ...(workerId ? { workerId } : {}),
        ...(dateFrom || dateTo
          ? {
              date: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
      };

      const rows = await prisma.presenceRecord.findMany({
        where,
        orderBy: [{ date: "desc" }, { arrivalTime: "desc" }, { id: "desc" }],
        take: pageSize + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          worker: {
            select: { id: true, firstName: true, lastName: true, matricule: true },
          },
        },
      });

      const hasMore = rows.length > pageSize;
      const data = hasMore ? rows.slice(0, pageSize) : rows;
      const nextCursor = hasMore ? data[data.length - 1]?.id : null;

      res.json({ data, nextCursor, hasMore });
    } catch (err) {
      next(err);
    }
  },
);
