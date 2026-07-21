import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { listAuditLogs } from "../services/audit/list.service.js";

export const auditRouter = Router();

const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  action: z.string().min(1).max(64).optional(),
  entityType: z.string().min(1).max(64).optional(),
  userId: z.string().uuid().optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

auditRouter.get(
  "/audit-log",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(auditQuerySchema, "query"),
  async (req, res, next) => {
    try {
      const query = req.query as z.infer<typeof auditQuerySchema>;
      const result = await listAuditLogs(query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);
