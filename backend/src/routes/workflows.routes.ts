import { Router } from "express";
import { z } from "zod";
import { ClarificationStatus, RequestStatus, Role } from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { writeAuditLog } from "../services/audit/audit.service.js";
import {
  cancelActivityRequest,
  complementActivityRequest,
  createActivityRequest,
  decideActivityRequest,
  getActivityRequest,
  listActivityRequests,
} from "../services/workflows/activity-request.service.js";
import {
  cancelWorkerRequest,
  complementWorkerRequest,
  createWorkerRequest,
  decideWorkerRequest,
  getWorkerRequest,
  listWorkerRequests,
} from "../services/workflows/worker-request.service.js";
import {
  answerClarificationRequest,
  closeClarificationRequest,
  createClarificationRequest,
  getClarificationRequest,
  listClarificationRequests,
} from "../services/workflows/clarification-request.service.js";
import { workflowPhotoUploadUrl } from "../services/storage/presigned-url.service.js";
import { bulkIdsSchema, runBulk } from "../lib/bulk.js";

export const workflowsRouter = Router();

const idParams = z.object({ id: z.string().uuid() });

const listRequestQuery = z.object({
  status: z.nativeEnum(RequestStatus).optional(),
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});

const listClarificationQuery = z.object({
  status: z.nativeEnum(ClarificationStatus).optional(),
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});

const createActivitySchema = z.object({
  proposedLabel: z.string().min(1).max(120),
  proposedUnit: z.string().min(1).max(40),
  proposedRate: z.coerce.number().positive(),
  justification: z.string().min(10),
});

const createWorkerSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  mvolaNumber: z.string().min(9),
  cinNumber: z.string().optional(),
  proposedPhotoKey: z.string().optional(),
  targetTeamId: z.string().uuid().optional(),
  justification: z.string().min(10),
});

const decisionSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  decisionReason: z.string().min(3).optional(),
});

const bulkDecisionSchema = z.object({
  ids: bulkIdsSchema,
  decision: z.enum(["APPROVED", "REJECTED"]),
  decisionReason: z.string().min(3).optional(),
});

const complementSchema = z.object({
  comment: z.string().min(3),
});

const createClarificationSchema = z.object({
  pointageId: z.string().uuid(),
  question: z.string().min(10),
  requestedPhoto: z.boolean().optional(),
});

const answerClarificationSchema = z.object({
  answerText: z.string().min(3),
  answerPhotoKey: z.string().optional(),
});

const WF_CDS_ADMIN = [Role.CHEF_SERVICE, Role.ADMIN] as const;
const WF_CLAR_ROLES = [Role.CHEF_SERVICE, Role.CHEF_EQUIPE, Role.ADMIN] as const;

workflowsRouter.get(
  "/activity-requests",
  requireAuth,
  requireRole(...WF_CDS_ADMIN),
  validate(listRequestQuery, "query"),
  async (req, res, next) => {
    try {
      const query = req.query as z.infer<typeof listRequestQuery>;
      const result = await listActivityRequests(req.user!, query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.get(
  "/activity-requests/:id",
  requireAuth,
  requireRole(...WF_CDS_ADMIN),
  validate(idParams, "params"),
  async (req, res, next) => {
    try {
      const row = await getActivityRequest(req.user!, req.params.id);
      res.json(row);
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.post(
  "/activity-requests",
  requireAuth,
  requireRole(...WF_CDS_ADMIN),
  validate(createActivitySchema),
  async (req, res, next) => {
    try {
      const row = await createActivityRequest(req.user!, req.body);
      await writeAuditLog({
        userId: req.user!.sub,
        action: "CREATE",
        entityType: "ActivityRequest",
        entityId: row.id,
        after: row,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(201).json(row);
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.patch(
  "/activity-requests/:id/decision",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(idParams, "params"),
  validate(decisionSchema),
  async (req, res, next) => {
    try {
      const before = await getActivityRequest(req.user!, req.params.id);
      const row = await decideActivityRequest(req.user!, req.params.id, req.body);
      await writeAuditLog({
        userId: req.user!.sub,
        action: "DECIDE",
        entityType: "ActivityRequest",
        entityId: row.id,
        before,
        after: row,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(row);
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.post(
  "/activity-requests/bulk-decision",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(bulkDecisionSchema),
  async (req, res, next) => {
    try {
      const { ids, decision, decisionReason } = req.body as z.infer<typeof bulkDecisionSchema>;
      const results = await runBulk(ids, async (id) => {
        const before = await getActivityRequest(req.user!, id);
        const row = await decideActivityRequest(req.user!, id, { decision, decisionReason });
        await writeAuditLog({
          userId: req.user!.sub,
          action: "DECIDE",
          entityType: "ActivityRequest",
          entityId: row.id,
          before,
          after: row,
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

workflowsRouter.patch(
  "/activity-requests/:id/complement",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(idParams, "params"),
  validate(complementSchema),
  async (req, res, next) => {
    try {
      const before = await getActivityRequest(req.user!, req.params.id);
      const row = await complementActivityRequest(req.user!, req.params.id, req.body);
      await writeAuditLog({
        userId: req.user!.sub,
        action: "COMPLEMENT",
        entityType: "ActivityRequest",
        entityId: row.id,
        before,
        after: row,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(row);
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.patch(
  "/activity-requests/:id/cancel",
  requireAuth,
  requireRole(...WF_CDS_ADMIN),
  validate(idParams, "params"),
  async (req, res, next) => {
    try {
      const before = await getActivityRequest(req.user!, req.params.id);
      const row = await cancelActivityRequest(req.user!, req.params.id);
      await writeAuditLog({
        userId: req.user!.sub,
        action: "CANCEL",
        entityType: "ActivityRequest",
        entityId: row.id,
        before,
        after: row,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(row);
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.get(
  "/worker-requests",
  requireAuth,
  requireRole(...WF_CDS_ADMIN),
  validate(listRequestQuery, "query"),
  async (req, res, next) => {
    try {
      const result = await listWorkerRequests(req.user!, req.query as z.infer<typeof listRequestQuery>);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.post(
  "/worker-requests/photo-upload-url",
  requireAuth,
  requireRole(...WF_CDS_ADMIN),
  async (_req, res, next) => {
    try {
      res.json(await workflowPhotoUploadUrl("worker-requests"));
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.get(
  "/worker-requests/:id",
  requireAuth,
  requireRole(...WF_CDS_ADMIN),
  validate(idParams, "params"),
  async (req, res, next) => {
    try {
      res.json(await getWorkerRequest(req.user!, req.params.id));
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.post(
  "/worker-requests",
  requireAuth,
  requireRole(...WF_CDS_ADMIN),
  validate(createWorkerSchema),
  async (req, res, next) => {
    try {
      const row = await createWorkerRequest(req.user!, req.body);
      await writeAuditLog({
        userId: req.user!.sub,
        action: "CREATE",
        entityType: "WorkerRequest",
        entityId: row.id,
        after: row,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(201).json(row);
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.patch(
  "/worker-requests/:id/decision",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(idParams, "params"),
  validate(decisionSchema),
  async (req, res, next) => {
    try {
      const before = await getWorkerRequest(req.user!, req.params.id);
      const row = await decideWorkerRequest(req.user!, req.params.id, req.body);
      await writeAuditLog({
        userId: req.user!.sub,
        action: "DECIDE",
        entityType: "WorkerRequest",
        entityId: row.id,
        before,
        after: row,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(row);
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.post(
  "/worker-requests/bulk-decision",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(bulkDecisionSchema),
  async (req, res, next) => {
    try {
      const { ids, decision, decisionReason } = req.body as z.infer<typeof bulkDecisionSchema>;
      const results = await runBulk(ids, async (id) => {
        const before = await getWorkerRequest(req.user!, id);
        const row = await decideWorkerRequest(req.user!, id, { decision, decisionReason });
        await writeAuditLog({
          userId: req.user!.sub,
          action: "DECIDE",
          entityType: "WorkerRequest",
          entityId: row.id,
          before,
          after: row,
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

workflowsRouter.patch(
  "/worker-requests/:id/complement",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(idParams, "params"),
  validate(complementSchema),
  async (req, res, next) => {
    try {
      const before = await getWorkerRequest(req.user!, req.params.id);
      const row = await complementWorkerRequest(req.user!, req.params.id, req.body);
      await writeAuditLog({
        userId: req.user!.sub,
        action: "COMPLEMENT",
        entityType: "WorkerRequest",
        entityId: row.id,
        before,
        after: row,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(row);
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.patch(
  "/worker-requests/:id/cancel",
  requireAuth,
  requireRole(...WF_CDS_ADMIN),
  validate(idParams, "params"),
  async (req, res, next) => {
    try {
      const before = await getWorkerRequest(req.user!, req.params.id);
      const row = await cancelWorkerRequest(req.user!, req.params.id);
      await writeAuditLog({
        userId: req.user!.sub,
        action: "CANCEL",
        entityType: "WorkerRequest",
        entityId: row.id,
        before,
        after: row,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(row);
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.get(
  "/clarification-requests",
  requireAuth,
  requireRole(...WF_CLAR_ROLES),
  validate(listClarificationQuery, "query"),
  async (req, res, next) => {
    try {
      const result = await listClarificationRequests(
        req.user!,
        req.query as z.infer<typeof listClarificationQuery>,
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.post(
  "/clarification-requests/photo-upload-url",
  requireAuth,
  requireRole(Role.CHEF_EQUIPE, Role.ADMIN),
  async (_req, res, next) => {
    try {
      res.json(await workflowPhotoUploadUrl("clarifications"));
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.get(
  "/clarification-requests/:id",
  requireAuth,
  requireRole(...WF_CLAR_ROLES),
  validate(idParams, "params"),
  async (req, res, next) => {
    try {
      res.json(await getClarificationRequest(req.user!, req.params.id));
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.post(
  "/clarification-requests",
  requireAuth,
  requireRole(...WF_CDS_ADMIN),
  validate(createClarificationSchema),
  async (req, res, next) => {
    try {
      const row = await createClarificationRequest(req.user!, req.body);
      await writeAuditLog({
        userId: req.user!.sub,
        action: "CREATE",
        entityType: "ClarificationRequest",
        entityId: row.id,
        after: row,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.status(201).json(row);
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.patch(
  "/clarification-requests/:id/answer",
  requireAuth,
  requireRole(Role.CHEF_EQUIPE, Role.ADMIN),
  validate(idParams, "params"),
  validate(answerClarificationSchema),
  async (req, res, next) => {
    try {
      const before = await getClarificationRequest(req.user!, req.params.id);
      const row = await answerClarificationRequest(req.user!, req.params.id, req.body);
      await writeAuditLog({
        userId: req.user!.sub,
        action: "ANSWER",
        entityType: "ClarificationRequest",
        entityId: row.id,
        before,
        after: row,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(row);
    } catch (err) {
      next(err);
    }
  },
);

workflowsRouter.patch(
  "/clarification-requests/:id/close",
  requireAuth,
  requireRole(...WF_CDS_ADMIN),
  validate(idParams, "params"),
  async (req, res, next) => {
    try {
      const before = await getClarificationRequest(req.user!, req.params.id);
      const row = await closeClarificationRequest(req.user!, req.params.id);
      await writeAuditLog({
        userId: req.user!.sub,
        action: "CLOSE",
        entityType: "ClarificationRequest",
        entityId: row.id,
        before,
        after: row,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });
      res.json(row);
    } catch (err) {
      next(err);
    }
  },
);
