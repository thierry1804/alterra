import { Router, raw } from "express";
import { z } from "zod";
import { PointageStatus, Role } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { syncPointageBatch } from "../services/pointages/sync.service.js";
import { listPointages } from "../services/pointages/list.service.js";
import { rejectPointage, validatePointage } from "../services/pointages/validation.service.js";
import { correctPointage, resubmitPointage } from "../services/pointages/correction.service.js";
import { POINTAGE_SORT_FIELDS } from "../services/pointages/list.service.js";
import { bulkIdsSchema, runBulk } from "../lib/bulk.js";
import { getPhotoStream, uploadPointagePhoto } from "../services/storage/presigned-url.service.js";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../middleware/error-handler.js";
import {
  notifyPointagesRejected,
  notifyPointagesValidated,
} from "../services/notifications/notify-helpers.js";

export const pointagesRouter = Router();

const syncItemSchema = z.object({
  clientUuid: z.string().uuid(),
  workerId: z.string().uuid(),
  subActivityId: z.string().uuid(),
  quantity: z.number().positive(),
  date: z.coerce.date(),
  parcelleId: z.string().uuid().optional(),
  geoLat: z.number().optional(),
  geoLng: z.number().optional(),
  notes: z.string().max(500).optional(),
  createdByClientAt: z.coerce.date(),
  photoKey: z.string().min(1).optional(),
});

const syncBatchSchema = z.object({
  batch: z.array(syncItemSchema).min(1).max(100),
});

const listPointagesQuery = z.object({
  cursor: z.string().uuid().optional(),
  status: z.enum(PointageStatus).optional(),
  workerId: z.string().uuid().optional(),
  subActivityId: z.string().uuid().optional(),
  siteId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  orderBy: z.enum(POINTAGE_SORT_FIELDS).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
});

const pointageIdParams = z.object({ id: z.string().uuid() });

const rejectSchema = z.object({ rejectionReason: z.string().min(3) });

const bulkIdsOnlySchema = z.object({ ids: bulkIdsSchema });
const bulkRejectSchema = z.object({ ids: bulkIdsSchema, rejectionReason: z.string().min(3) });

const correctionSchema = z.object({
  quantity: z.number().positive().optional(),
  subActivityId: z.string().uuid().optional(),
  date: z.coerce.date().optional(),
  photoKey: z.string().min(1).optional(),
  correctionReason: z.string().min(10),
});

const resubmitSchema = z.object({
  quantity: z.number().positive().optional(),
  subActivityId: z.string().uuid().optional(),
  date: z.coerce.date().optional(),
  photoKey: z.string().min(1).optional(),
  resubmitReason: z.string().min(10),
});

pointagesRouter.post(
  "/pointages/photo",
  requireAuth,
  requireRole(Role.CHEF_EQUIPE, Role.CHEF_SERVICE, Role.ADMIN),
  raw({ type: "image/jpeg", limit: "5mb" }),
  async (req, res, next) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        throw new ApiError(400, "INVALID_PHOTO", "Corps de requête image/jpeg attendu");
      }
      const photoKey = await uploadPointagePhoto(req.body);
      res.json({ photoKey });
    } catch (err) {
      next(err);
    }
  },
);

pointagesRouter.post(
  "/pointages/sync",
  requireAuth,
  requireRole(Role.CHEF_EQUIPE, Role.CHEF_SERVICE, Role.ADMIN),
  validate(syncBatchSchema),
  async (req, res, next) => {
    try {
      const { batch } = req.body as z.infer<typeof syncBatchSchema>;
      const results = await syncPointageBatch(batch, req.user!.sub);
      res.json({ results });
    } catch (err) {
      next(err);
    }
  },
);

pointagesRouter.get(
  "/pointages",
  requireAuth,
  validate(listPointagesQuery, "query"),
  async (req, res, next) => {
    try {
      const filters = req.query as z.infer<typeof listPointagesQuery>;
      const result = await listPointages(filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

pointagesRouter.get(
  "/pointages/:id/photo",
  requireAuth,
  validate(pointageIdParams, "params"),
  async (req, res, next) => {
    try {
      const pointage = await prisma.pointage.findUnique({
        where: { id: req.params.id },
        select: { photoKey: true },
      });
      if (!pointage) throw new ApiError(404, "NOT_FOUND", "Pointage introuvable");
      if (!pointage.photoKey) throw new ApiError(404, "NO_PHOTO", "Aucune photo pour ce pointage");

      // MinIO n'est pas exposé publiquement : on relaie l'image au lieu de renvoyer une URL présignée
      // (son hôte interne serait injoignable pour le navigateur, et bloqué par le CSP img-src).
      const stream = await getPhotoStream(pointage.photoKey);
      res.setHeader("Content-Type", "image/jpeg");
      res.setHeader("Cache-Control", "private, max-age=3600");
      stream.pipe(res);
      stream.on("error", next);
    } catch (err) {
      next(err);
    }
  },
);

pointagesRouter.patch(
  "/pointages/:id/validate",
  requireAuth,
  requireRole(Role.CHEF_SERVICE, Role.ADMIN),
  validate(pointageIdParams, "params"),
  async (req, res, next) => {
    try {
      const pointage = await validatePointage(req.params.id, req.user!.sub);
      await notifyPointagesValidated([pointage.id], {
        actorUserId: req.user!.sub,
        ip: req.ip,
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
      });
      res.json(pointage);
    } catch (err) {
      next(err);
    }
  },
);

pointagesRouter.patch(
  "/pointages/:id/reject",
  requireAuth,
  requireRole(Role.CHEF_SERVICE, Role.ADMIN),
  validate(pointageIdParams, "params"),
  validate(rejectSchema),
  async (req, res, next) => {
    try {
      const { rejectionReason } = req.body as z.infer<typeof rejectSchema>;
      const pointage = await rejectPointage(req.params.id, req.user!.sub, rejectionReason);
      await notifyPointagesRejected([pointage.id], rejectionReason, {
        actorUserId: req.user!.sub,
        ip: req.ip,
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
      });
      res.json(pointage);
    } catch (err) {
      next(err);
    }
  },
);

pointagesRouter.patch(
  "/pointages/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(pointageIdParams, "params"),
  validate(correctionSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof correctionSchema>;
      const pointage = await correctPointage(req.params.id, body, {
        ip: req.ip,
        userAgent:
          typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
      });
      res.json(pointage);
    } catch (err) {
      next(err);
    }
  },
);

pointagesRouter.patch(
  "/pointages/:id/resubmit",
  requireAuth,
  requireRole(Role.CHEF_EQUIPE, Role.CHEF_SERVICE),
  validate(pointageIdParams, "params"),
  validate(resubmitSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof resubmitSchema>;
      const pointage = await resubmitPointage(req.params.id, req.user!.sub, body, {
        ip: req.ip,
        userAgent:
          typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
      });
      res.json(pointage);
    } catch (err) {
      next(err);
    }
  },
);

pointagesRouter.post(
  "/pointages/bulk-validate",
  requireAuth,
  requireRole(Role.CHEF_SERVICE, Role.ADMIN),
  validate(bulkIdsOnlySchema),
  async (req, res, next) => {
    try {
      const { ids } = req.body as z.infer<typeof bulkIdsOnlySchema>;
      const okIds: string[] = [];
      const results = await runBulk(ids, async (id) => {
        await validatePointage(id, req.user!.sub);
        okIds.push(id);
      });
      if (okIds.length > 0) {
        await notifyPointagesValidated(okIds, {
          actorUserId: req.user!.sub,
          ip: req.ip,
          userAgent:
            typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        });
      }
      res.json({ results });
    } catch (err) {
      next(err);
    }
  },
);

pointagesRouter.post(
  "/pointages/bulk-reject",
  requireAuth,
  requireRole(Role.CHEF_SERVICE, Role.ADMIN),
  validate(bulkRejectSchema),
  async (req, res, next) => {
    try {
      const { ids, rejectionReason } = req.body as z.infer<typeof bulkRejectSchema>;
      const okIds: string[] = [];
      const results = await runBulk(ids, async (id) => {
        await rejectPointage(id, req.user!.sub, rejectionReason);
        okIds.push(id);
      });
      if (okIds.length > 0) {
        await notifyPointagesRejected(okIds, rejectionReason, {
          actorUserId: req.user!.sub,
          ip: req.ip,
          userAgent:
            typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        });
      }
      res.json({ results });
    } catch (err) {
      next(err);
    }
  },
);
