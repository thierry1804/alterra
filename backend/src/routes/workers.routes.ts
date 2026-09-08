import { Router } from "express";
import { z } from "zod";
import { Prisma, Role, WorkerStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { ApiError } from "../middleware/error-handler.js";
import { writeAuditLog } from "../services/audit/audit.service.js";
import { workerPhotoUploadUrl } from "../services/storage/presigned-url.service.js";
import {
  detectWorkersImportColumns,
  importWorkersRows,
  parseWorkersWorkbook,
} from "../services/import/workers-import.service.js";

export const workersRouter = Router();

const workerIdParams = z.object({ id: z.string().uuid() });

const listWorkersQuery = z.object({
  siteId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  status: z.nativeEnum(WorkerStatus).optional(),
  q: z.string().min(1).optional(),
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});

const createWorkerSchema = z.object({
  matricule: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  mvolaNumber: z.string().min(9),
  cinNumber: z.string().optional(),
  siteId: z.string().uuid(),
  teamId: z.string().uuid().optional(),
  hiredAt: z.coerce.date(),
  status: z.nativeEnum(WorkerStatus).default(WorkerStatus.ACTIVE),
  birthDate: z.coerce.date().optional(),
  maritalStatus: z.string().optional(),
  childrenCount: z.coerce.number().int().min(0).optional(),
  legacyMocId: z.coerce.number().int().optional(),
});

const updateWorkerSchema = createWorkerSchema.partial().extend({
  photoKey: z.string().min(1).optional(),
});

const confirmPhotoSchema = z.object({
  photoKey: z.string().min(1),
});

/** Case-insensitive partial match on firstName, lastName, matricule, mvolaNumber (Prisma ilike). */
function buildSearchFilter(q: string): Prisma.WorkerWhereInput {
  return {
    OR: [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { matricule: { contains: q, mode: "insensitive" } },
      { mvolaNumber: { contains: q, mode: "insensitive" } },
    ],
  };
}

const importBodySchema = z.object({
  contentBase64: z.string().min(1),
  hasHeaderRow: z.boolean().optional(),
  referenceRowNumber: z.number().int().min(1).optional(),
  mapping: z.record(z.string()).optional(),
});

const importColumnsBodySchema = z.object({
  contentBase64: z.string().min(1),
  hasHeaderRow: z.boolean().optional(),
  referenceRowNumber: z.number().int().min(1).optional(),
});

const importQuerySchema = z.object({
  dryRun: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
});

function assertPhotoKeyForWorker(workerId: string, photoKey: string) {
  const expectedPrefix = `workers/${workerId}/`;
  if (!photoKey.startsWith(expectedPrefix)) {
    throw new ApiError(422, "INVALID_PHOTO_KEY", "Clé photo invalide pour ce travailleur");
  }
}

workersRouter.get(
  "/workers",
  requireAuth,
  validate(listWorkersQuery, "query"),
  async (req, res, next) => {
    try {
      const { siteId, teamId, status, q, cursor, take } = req.query as z.infer<
        typeof listWorkersQuery
      >;

      const where: Prisma.WorkerWhereInput = { deletedAt: null };
      if (siteId) where.siteId = siteId;
      if (teamId) where.teamId = teamId;
      if (status) where.status = status;
      if (q) Object.assign(where, buildSearchFilter(q));

      const pageSize = take ?? 50;
      const workers = await prisma.worker.findMany({
        where,
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
        take: pageSize + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });

      const hasMore = workers.length > pageSize;
      const data = hasMore ? workers.slice(0, pageSize) : workers;
      const nextCursor = hasMore ? data[data.length - 1]?.id : null;

      res.json({ data, nextCursor, hasMore });
    } catch (err) {
      next(err);
    }
  },
);

workersRouter.get(
  "/workers/:id",
  requireAuth,
  validate(workerIdParams, "params"),
  async (req, res, next) => {
    try {
      const worker = await prisma.worker.findFirst({
        where: { id: req.params.id, deletedAt: null },
      });
      if (!worker) throw new ApiError(404, "NOT_FOUND", "Travailleur introuvable");
      res.json(worker);
    } catch (err) {
      next(err);
    }
  },
);

workersRouter.post(
  "/workers",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(createWorkerSchema),
  async (req, res, next) => {
    try {
      const worker = await prisma.worker.create({ data: req.body });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "CREATE",
        entityType: "Worker",
        entityId: worker.id,
        after: worker,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(201).json(worker);
    } catch (err) {
      next(err);
    }
  },
);

workersRouter.patch(
  "/workers/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(workerIdParams, "params"),
  validate(updateWorkerSchema),
  async (req, res, next) => {
    try {
      const before = await prisma.worker.findFirst({
        where: { id: req.params.id, deletedAt: null },
      });
      if (!before) throw new ApiError(404, "NOT_FOUND", "Travailleur introuvable");

      const worker = await prisma.worker.update({
        where: { id: req.params.id },
        data: req.body,
      });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "Worker",
        entityId: worker.id,
        before,
        after: worker,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(worker);
    } catch (err) {
      next(err);
    }
  },
);

workersRouter.delete(
  "/workers/:id",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(workerIdParams, "params"),
  async (req, res, next) => {
    try {
      const before = await prisma.worker.findFirst({
        where: { id: req.params.id, deletedAt: null },
      });
      if (!before) throw new ApiError(404, "NOT_FOUND", "Travailleur introuvable");

      const worker = await prisma.worker.update({
        where: { id: req.params.id },
        data: { deletedAt: new Date() },
      });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "DELETE",
        entityType: "Worker",
        entityId: worker.id,
        before,
        after: worker,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(worker);
    } catch (err) {
      next(err);
    }
  },
);

workersRouter.post(
  "/workers/:id/photo",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(workerIdParams, "params"),
  validate(confirmPhotoSchema),
  async (req, res, next) => {
    try {
      const before = await prisma.worker.findFirst({
        where: { id: req.params.id, deletedAt: null },
      });
      if (!before) throw new ApiError(404, "NOT_FOUND", "Travailleur introuvable");

      const { photoKey } = req.body as z.infer<typeof confirmPhotoSchema>;
      assertPhotoKeyForWorker(before.id, photoKey);

      const worker = await prisma.worker.update({
        where: { id: before.id },
        data: { photoKey },
      });
      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "Worker",
        entityId: worker.id,
        before: { photoKey: before.photoKey },
        after: { photoKey: worker.photoKey },
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(worker);
    } catch (err) {
      next(err);
    }
  },
);

workersRouter.post(
  "/workers/:id/photo-upload-url",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(workerIdParams, "params"),
  async (req, res, next) => {
    try {
      const worker = await prisma.worker.findFirst({
        where: { id: req.params.id, deletedAt: null },
      });
      if (!worker) throw new ApiError(404, "NOT_FOUND", "Travailleur introuvable");

      const result = await workerPhotoUploadUrl(worker.id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

workersRouter.post(
  "/workers/import/columns",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(importColumnsBodySchema),
  async (req, res, next) => {
    try {
      const { contentBase64, hasHeaderRow, referenceRowNumber } = req.body as z.infer<
        typeof importColumnsBodySchema
      >;
      const buffer = Buffer.from(contentBase64, "base64");
      const result = await detectWorkersImportColumns(
        buffer,
        hasHeaderRow ?? true,
        referenceRowNumber ?? 1,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

workersRouter.post(
  "/workers/import",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(importQuerySchema, "query"),
  validate(importBodySchema),
  async (req, res, next) => {
    try {
      const dryRun =
        (req.query as unknown as z.infer<typeof importQuerySchema>).dryRun ?? true;
      const { contentBase64, hasHeaderRow, referenceRowNumber, mapping } = req.body as z.infer<
        typeof importBodySchema
      >;
      const buffer = Buffer.from(contentBase64, "base64");
      const preview = await parseWorkersWorkbook(buffer, {
        hasHeaderRow,
        referenceRowNumber,
        mapping,
      });

      if (dryRun) {
        return res.json(preview);
      }

      if (preview.errors.length > 0) {
        throw new ApiError(422, "IMPORT_VALIDATION_FAILED", "Corrigez les erreurs avant import", {
          errors: preview.errors,
        });
      }

      const { created, updated } = await importWorkersRows(preview.valid);
      await writeAuditLog({
        userId: req.user!.sub,
        action: "IMPORT",
        entityType: "Worker",
        after: { created: created.length, updated: updated.length },
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(201).json({
        imported: created.length + updated.length,
        created: created.length,
        updated: updated.length,
        data: [...created, ...updated],
      });
    } catch (err) {
      next(err);
    }
  },
);
