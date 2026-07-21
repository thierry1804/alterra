import { Router } from "express";
import { z } from "zod";
import { PointageStatus, Role } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { syncPointageBatch } from "../services/pointages/sync.service.js";
import { listPointages } from "../services/pointages/list.service.js";
import {
  rejectPointage,
  validatePointage,
} from "../services/pointages/validation.service.js";
import { correctPointage } from "../services/pointages/correction.service.js";

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

const listPointagesQuery = z.object({
  cursor: z.string().uuid().optional(),
  status: z.nativeEnum(PointageStatus).optional(),
  workerId: z.string().uuid().optional(),
  activityId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

const pointageIdParams = z.object({ id: z.string().uuid() });

const rejectSchema = z.object({ rejectionReason: z.string().min(3) });

const correctionSchema = z.object({
  quantity: z.number().positive().optional(),
  activityId: z.string().uuid().optional(),
  date: z.coerce.date().optional(),
  correctionReason: z.string().min(10),
});

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

pointagesRouter.patch(
  "/pointages/:id/validate",
  requireAuth,
  requireRole(Role.CHEF_SERVICE, Role.ADMIN),
  validate(pointageIdParams, "params"),
  async (req, res, next) => {
    try {
      const pointage = await validatePointage(req.params.id, req.user!.sub);
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
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
      });
      res.json(pointage);
    } catch (err) {
      next(err);
    }
  },
);
