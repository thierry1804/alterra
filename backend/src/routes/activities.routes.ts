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
  applySubActivityRateChange,
  ratesEqual,
  startOfUtcDay,
} from "../services/activities/activity-version.service.js";
import { bulkIdsSchema, runBulk } from "../lib/bulk.js";

export const activitiesRouter = Router();

const idParams = z.object({ id: z.string().uuid() });
const bulkDeactivateSchema = z.object({ ids: bulkIdsSchema });

const cursorPaginationQuery = z.object({
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});

/** Case-insensitive partial match on code/label (Prisma ilike). */
function codeLabelSearchFilter(q: string) {
  return {
    OR: [
      { code: { contains: q, mode: "insensitive" as const } },
      { label: { contains: q, mode: "insensitive" as const } },
    ],
  };
}

const categoryCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .transform((v) => v.toUpperCase());

const createCategorySchema = z.object({
  code: categoryCodeSchema,
  label: z.string().min(1),
  active: z.boolean().optional(),
});

const updateCategorySchema = z.object({
  code: categoryCodeSchema.optional(),
  label: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

async function assertCategoryCodeAvailable(code: string, excludeId?: string) {
  const conflict = await prisma.activityCategory.findFirst({
    where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (conflict) {
    throw new ApiError(409, "CATEGORY_CODE_TAKEN", `Le code "${code}" est déjà utilisé`);
  }
}

const unitCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(20)
  .transform((v) => v.toUpperCase());

const createUnitSchema = z.object({
  code: unitCodeSchema,
  label: z.string().min(1),
  active: z.boolean().optional(),
});

const updateUnitSchema = z.object({
  code: unitCodeSchema.optional(),
  label: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

async function assertUnitCodeAvailable(code: string, excludeId?: string) {
  const conflict = await prisma.unit.findFirst({
    where: { code, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  if (conflict) {
    throw new ApiError(409, "UNIT_CODE_TAKEN", `Le code "${code}" est déjà utilisé`);
  }
}

const listUnitsQuery = cursorPaginationQuery.extend({
  q: z.string().min(1).optional(),
});

activitiesRouter.get(
  "/units",
  requireAuth,
  validate(listUnitsQuery, "query"),
  async (req, res, next) => {
    try {
      const { cursor, take, q } = req.query as unknown as z.infer<typeof listUnitsQuery>;
      const pageSize = take ?? 50;

      const units = await prisma.unit.findMany({
        where: q ? codeLabelSearchFilter(q) : undefined,
        orderBy: [{ code: "asc" }, { id: "asc" }],
        take: pageSize + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const hasMore = units.length > pageSize;
      const data = hasMore ? units.slice(0, pageSize) : units;
      res.json({ data, nextCursor: hasMore ? data[data.length - 1]?.id : null, hasMore });
    } catch (err) {
      next(err);
    }
  },
);

activitiesRouter.post(
  "/units",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(createUnitSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof createUnitSchema>;
      await assertUnitCodeAvailable(body.code);
      const unit = await prisma.unit.create({ data: body });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "CREATE",
        entityType: "Unit",
        entityId: unit.id,
        after: unit,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(201).json(unit);
    } catch (err) {
      next(err);
    }
  },
);

activitiesRouter.patch(
  "/units/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(idParams, "params"),
  validate(updateUnitSchema),
  async (req, res, next) => {
    try {
      const current = await prisma.unit.findUnique({ where: { id: req.params.id } });
      if (!current) throw new ApiError(404, "NOT_FOUND", "Unité introuvable");

      const body = req.body as z.infer<typeof updateUnitSchema>;
      if (body.code !== undefined && body.code !== current.code) {
        await assertUnitCodeAvailable(body.code, current.id);
      }

      const unit = await prisma.unit.update({ where: { id: req.params.id }, data: body });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "Unit",
        entityId: unit.id,
        before: current,
        after: unit,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(unit);
    } catch (err) {
      next(err);
    }
  },
);

activitiesRouter.delete(
  "/units/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(idParams, "params"),
  async (req, res, next) => {
    try {
      const before = await prisma.unit.findUnique({ where: { id: req.params.id } });
      if (!before) throw new ApiError(404, "NOT_FOUND", "Unité introuvable");

      const unit = await prisma.unit.update({
        where: { id: req.params.id },
        data: { active: false },
      });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "DEACTIVATE",
        entityType: "Unit",
        entityId: unit.id,
        before,
        after: unit,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(unit);
    } catch (err) {
      next(err);
    }
  },
);

const listCategoriesQuery = cursorPaginationQuery.extend({
  includeSubActivities: z.enum(["true", "false"]).optional(),
  q: z.string().min(1).optional(),
});

activitiesRouter.get(
  "/activity-categories",
  requireAuth,
  validate(listCategoriesQuery, "query"),
  async (req, res, next) => {
    try {
      const { cursor, take, includeSubActivities, q } = req.query as unknown as z.infer<
        typeof listCategoriesQuery
      >;
      const pageSize = take ?? 50;

      const categories = await prisma.activityCategory.findMany({
        where: q
          ? {
              OR: [
                { code: { contains: q, mode: "insensitive" } },
                { label: { contains: q, mode: "insensitive" } },
                {
                  subActivities: {
                    some: {
                      OR: [
                        { label: { contains: q, mode: "insensitive" } },
                        { shortLabel: { contains: q, mode: "insensitive" } },
                      ],
                    },
                  },
                },
              ],
            }
          : undefined,
        orderBy: [{ code: "asc" }, { id: "asc" }],
        take: pageSize + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include:
          includeSubActivities === "true"
            ? {
                subActivities: {
                  where: {
                    active: true,
                    ...(q
                      ? {
                          OR: [
                            { label: { contains: q, mode: "insensitive" } },
                            { shortLabel: { contains: q, mode: "insensitive" } },
                          ],
                        }
                      : {}),
                  },
                  include: { unit: true },
                  orderBy: { label: "asc" },
                },
              }
            : undefined,
      });

      const hasMore = categories.length > pageSize;
      const data = hasMore ? categories.slice(0, pageSize) : categories;
      res.json({ data, nextCursor: hasMore ? data[data.length - 1]?.id : null, hasMore });
    } catch (err) {
      next(err);
    }
  },
);

activitiesRouter.get(
  "/activity-categories/:id",
  requireAuth,
  validate(idParams, "params"),
  async (req, res, next) => {
    try {
      const category = await prisma.activityCategory.findUnique({ where: { id: req.params.id } });
      if (!category) throw new ApiError(404, "NOT_FOUND", "Catégorie introuvable");
      res.json(category);
    } catch (err) {
      next(err);
    }
  },
);

activitiesRouter.post(
  "/activity-categories",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(createCategorySchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof createCategorySchema>;
      await assertCategoryCodeAvailable(body.code);
      const category = await prisma.activityCategory.create({ data: body });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "CREATE",
        entityType: "ActivityCategory",
        entityId: category.id,
        after: category,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(201).json(category);
    } catch (err) {
      next(err);
    }
  },
);

activitiesRouter.patch(
  "/activity-categories/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(idParams, "params"),
  validate(updateCategorySchema),
  async (req, res, next) => {
    try {
      const current = await prisma.activityCategory.findUnique({ where: { id: req.params.id } });
      if (!current) throw new ApiError(404, "NOT_FOUND", "Catégorie introuvable");

      const body = req.body as z.infer<typeof updateCategorySchema>;
      if (body.code !== undefined && body.code !== current.code) {
        await assertCategoryCodeAvailable(body.code, current.id);
      }

      const category = await prisma.activityCategory.update({
        where: { id: req.params.id },
        data: body,
      });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "ActivityCategory",
        entityId: category.id,
        before: current,
        after: category,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(category);
    } catch (err) {
      next(err);
    }
  },
);

activitiesRouter.delete(
  "/activity-categories/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(idParams, "params"),
  async (req, res, next) => {
    try {
      const before = await prisma.activityCategory.findUnique({ where: { id: req.params.id } });
      if (!before) throw new ApiError(404, "NOT_FOUND", "Catégorie introuvable");

      const category = await prisma.activityCategory.update({
        where: { id: req.params.id },
        data: { active: false },
      });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "DEACTIVATE",
        entityType: "ActivityCategory",
        entityId: category.id,
        before,
        after: category,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(category);
    } catch (err) {
      next(err);
    }
  },
);

const listSubActivitiesQuery = cursorPaginationQuery.extend({
  categoryId: z.string().uuid().optional(),
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

const createSubActivitySchema = z.object({
  categoryId: z.string().uuid(),
  label: z.string().min(1),
  shortLabel: z.string().min(1),
  unitId: z.string().uuid(),
  unitRate: z.coerce.number().positive(),
  validFrom: z.coerce.date().optional(),
  siteId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
});

const updateSubActivitySchema = z.object({
  categoryId: z.string().uuid().optional(),
  label: z.string().min(1).optional(),
  shortLabel: z.string().min(1).optional(),
  unitId: z.string().uuid().optional(),
  unitRate: z.coerce.number().positive().optional(),
  validFrom: z.coerce.date().optional(),
  siteId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
});

activitiesRouter.get(
  "/sub-activities",
  requireAuth,
  validate(listSubActivitiesQuery, "query"),
  async (req, res, next) => {
    try {
      const { categoryId, siteId, active, history, cursor, take } = req.query as unknown as z.infer<
        typeof listSubActivitiesQuery
      >;

      const where: Prisma.ActivitySubActivityWhereInput = {};
      if (categoryId) where.categoryId = categoryId;
      if (siteId !== undefined) {
        where.OR = [{ siteId: null }, { siteId }];
      } else if (req.user!.role !== Role.ADMIN) {
        const userSiteId = req.user!.siteId;
        where.OR = [{ siteId: null }, ...(userSiteId ? [{ siteId: userSiteId }] : [])];
      }
      if (active !== undefined) where.active = active;
      if (!history) where.validTo = null;

      const pageSize = take ?? 50;
      const subActivities = await prisma.activitySubActivity.findMany({
        where,
        include: { category: true, unit: true },
        orderBy: [{ label: "asc" }, { validFrom: "desc" }, { id: "asc" }],
        take: pageSize + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const hasMore = subActivities.length > pageSize;
      const data = hasMore ? subActivities.slice(0, pageSize) : subActivities;
      res.json({ data, nextCursor: hasMore ? data[data.length - 1]?.id : null, hasMore });
    } catch (err) {
      next(err);
    }
  },
);

activitiesRouter.get(
  "/sub-activities/:id",
  requireAuth,
  validate(idParams, "params"),
  async (req, res, next) => {
    try {
      const subActivity = await prisma.activitySubActivity.findUnique({
        where: { id: req.params.id },
        include: { category: true, unit: true },
      });
      if (!subActivity) throw new ApiError(404, "NOT_FOUND", "Sous-activité introuvable");
      res.json(subActivity);
    } catch (err) {
      next(err);
    }
  },
);

activitiesRouter.post(
  "/sub-activities",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(createSubActivitySchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof createSubActivitySchema>;
      const category = await prisma.activityCategory.findUnique({
        where: { id: body.categoryId },
      });
      if (!category) throw new ApiError(404, "NOT_FOUND", "Catégorie introuvable");

      const unit = await prisma.unit.findUnique({ where: { id: body.unitId } });
      if (!unit) throw new ApiError(404, "NOT_FOUND", "Unité introuvable");

      const data = { ...body, validFrom: body.validFrom ?? startOfUtcDay() };
      const subActivity = await prisma.activitySubActivity.create({
        data,
        include: { category: true, unit: true },
      });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "CREATE",
        entityType: "ActivitySubActivity",
        entityId: subActivity.id,
        after: subActivity,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(201).json(subActivity);
    } catch (err) {
      next(err);
    }
  },
);

activitiesRouter.patch(
  "/sub-activities/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(idParams, "params"),
  validate(updateSubActivitySchema),
  async (req, res, next) => {
    try {
      const current = await prisma.activitySubActivity.findUnique({
        where: { id: req.params.id },
      });
      if (!current) throw new ApiError(404, "NOT_FOUND", "Sous-activité introuvable");

      const { unitRate, ...otherFields } = req.body as z.infer<typeof updateSubActivitySchema>;

      if (unitRate !== undefined && !ratesEqual(current.unitRate, unitRate)) {
        const created = await applySubActivityRateChange(current, unitRate, {
          label: otherFields.label,
          shortLabel: otherFields.shortLabel,
          unitId: otherFields.unitId,
          siteId: otherFields.siteId,
          validFrom: otherFields.validFrom,
          active: otherFields.active,
        });
        await writeAuditLog({
          userId: req.user!.sub,
          action: "RATE_CHANGE",
          entityType: "ActivitySubActivity",
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

      const subActivity = await prisma.activitySubActivity.update({
        where: { id: req.params.id },
        data: otherFields,
        include: { category: true, unit: true },
      });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "ActivitySubActivity",
        entityId: subActivity.id,
        before: current,
        after: subActivity,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(subActivity);
    } catch (err) {
      next(err);
    }
  },
);

activitiesRouter.delete(
  "/sub-activities/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(idParams, "params"),
  async (req, res, next) => {
    try {
      const before = await prisma.activitySubActivity.findUnique({ where: { id: req.params.id } });
      if (!before) throw new ApiError(404, "NOT_FOUND", "Sous-activité introuvable");

      const subActivity = await prisma.activitySubActivity.update({
        where: { id: req.params.id },
        data: { active: false },
      });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "DEACTIVATE",
        entityType: "ActivitySubActivity",
        entityId: subActivity.id,
        before,
        after: subActivity,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(subActivity);
    } catch (err) {
      next(err);
    }
  },
);

activitiesRouter.post(
  "/sub-activities/bulk-deactivate",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(bulkDeactivateSchema),
  async (req, res, next) => {
    try {
      const { ids } = req.body as z.infer<typeof bulkDeactivateSchema>;
      const results = await runBulk(ids, async (id) => {
        const before = await prisma.activitySubActivity.findUnique({ where: { id } });
        if (!before) throw new ApiError(404, "NOT_FOUND", "Sous-activité introuvable");
        if (before.validTo !== null) {
          throw new ApiError(
            409,
            "NOT_CURRENT_VERSION",
            "Version historique — seule la version courante peut être désactivée",
          );
        }
        const subActivity = await prisma.activitySubActivity.update({
          where: { id },
          data: { active: false },
        });
        await writeAuditLog({
          userId: req.user!.sub,
          action: "DEACTIVATE",
          entityType: "ActivitySubActivity",
          entityId: subActivity.id,
          before,
          after: subActivity,
          ip: req.ip,
          userAgent: req.headers["user-agent"],
        });
      });
      res.json({ results });
    } catch (err) {
      next(err);
    }
  },
);
