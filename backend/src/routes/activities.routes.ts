import { Router } from "express";
import { z } from "zod";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { ApiError } from "../middleware/error-handler.js";
import { writeAuditLog } from "../services/audit/audit.service.js";
import {
  applyActivityRateChange,
  ratesEqual,
  startOfUtcDay,
} from "../services/activities/activity-version.service.js";

export const activitiesRouter = Router();

const activityIdParams = z.object({ id: z.string().uuid() });

const listActivitiesQuery = z.object({
  siteId: z.string().uuid().optional(),
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  history: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

const createActivitySchema = z.object({
  label: z.string().min(1),
  unit: z.string().min(1),
  unitRate: z.coerce.number().positive(),
  validFrom: z.coerce.date().optional(),
  siteId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
});

const updateActivitySchema = z.object({
  label: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  unitRate: z.coerce.number().positive().optional(),
  validFrom: z.coerce.date().optional(),
  siteId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
});

activitiesRouter.get(
  "/activities",
  requireAuth,
  validate(listActivitiesQuery, "query"),
  async (req, res, next) => {
    try {
      const { siteId, active, history } = req.query as unknown as z.infer<
        typeof listActivitiesQuery
      >;

      const where: Prisma.ActivityWhereInput = {};
      if (siteId !== undefined) {
        where.siteId = siteId;
      } else if (req.user!.role !== Role.ADMIN) {
        const userSiteId = req.user!.siteId;
        where.OR = [{ siteId: null }, ...(userSiteId ? [{ siteId: userSiteId }] : [])];
      }
      if (active !== undefined) where.active = active;
      if (!history) {
        where.validTo = null;
      }

      const activities = await prisma.activity.findMany({
        where,
        orderBy: [{ label: "asc" }, { validFrom: "desc" }],
      });

      res.json({ data: activities });
    } catch (err) {
      next(err);
    }
  },
);

activitiesRouter.get(
  "/activities/:id",
  requireAuth,
  validate(activityIdParams, "params"),
  async (req, res, next) => {
    try {
      const activity = await prisma.activity.findUnique({ where: { id: req.params.id } });
      if (!activity) throw new ApiError(404, "NOT_FOUND", "Activité introuvable");
      res.json(activity);
    } catch (err) {
      next(err);
    }
  },
);

activitiesRouter.post(
  "/activities",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(createActivitySchema),
  async (req, res, next) => {
    try {
      const data = {
        ...req.body,
        validFrom: req.body.validFrom ?? startOfUtcDay(),
      };
      const activity = await prisma.activity.create({ data });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "CREATE",
        entityType: "Activity",
        entityId: activity.id,
        after: activity,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(201).json(activity);
    } catch (err) {
      next(err);
    }
  },
);

activitiesRouter.patch(
  "/activities/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(activityIdParams, "params"),
  validate(updateActivitySchema),
  async (req, res, next) => {
    try {
      const current = await prisma.activity.findUnique({ where: { id: req.params.id } });
      if (!current) throw new ApiError(404, "NOT_FOUND", "Activité introuvable");

      const { unitRate, ...otherFields } = req.body as z.infer<typeof updateActivitySchema>;

      if (unitRate !== undefined && !ratesEqual(current.unitRate, unitRate)) {
        const created = await applyActivityRateChange(current, unitRate, {
          label: otherFields.label,
          unit: otherFields.unit,
          siteId: otherFields.siteId,
          validFrom: otherFields.validFrom,
          active: otherFields.active,
        });
        await writeAuditLog({
          userId: req.user!.sub,
          action: "RATE_CHANGE",
          entityType: "Activity",
          entityId: created.id,
          before: current,
          after: created,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        });
        return res.json(created);
      }

      if (Object.keys(otherFields).length === 0) {
        return res.json(current);
      }

      const activity = await prisma.activity.update({
        where: { id: req.params.id },
        data: otherFields,
      });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "Activity",
        entityId: activity.id,
        before: current,
        after: activity,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(activity);
    } catch (err) {
      next(err);
    }
  },
);

activitiesRouter.delete(
  "/activities/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(activityIdParams, "params"),
  async (req, res, next) => {
    try {
      const before = await prisma.activity.findUnique({ where: { id: req.params.id } });
      if (!before) throw new ApiError(404, "NOT_FOUND", "Activité introuvable");

      const activity = await prisma.activity.update({
        where: { id: req.params.id },
        data: { active: false },
      });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "DEACTIVATE",
        entityType: "Activity",
        entityId: activity.id,
        before,
        after: activity,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(activity);
    } catch (err) {
      next(err);
    }
  },
);
