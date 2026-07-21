import { Router } from "express";
import { BioProvider, Role } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { writeAuditLog } from "../services/audit/audit.service.js";
import {
  listTemplatesForSync,
  parseDescriptor,
  upsertWorkerTemplate,
} from "../services/biometric/template.service.js";

export const biometricTemplatesRouter = Router();

const upsertTemplateSchema = z.object({
  workerId: z.string().uuid(),
  descriptor: z.array(z.number()).length(128),
  source: z.nativeEnum(BioProvider).optional(),
  expiresAt: z.coerce.date().optional(),
});

biometricTemplatesRouter.get(
  "/biometric/templates/sync",
  requireAuth,
  requireRole(Role.CHEF_EQUIPE, Role.CHEF_SERVICE, Role.ADMIN),
  async (req, res, next) => {
    try {
      const data = await listTemplatesForSync(req.user!);
      res.json({ data, syncedAt: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  },
);

biometricTemplatesRouter.post(
  "/biometric/templates",
  requireAuth,
  requireRole(Role.ADMIN),
  validate(upsertTemplateSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof upsertTemplateSchema>;
      const descriptor = parseDescriptor(body.descriptor);
      await upsertWorkerTemplate({
        workerId: body.workerId,
        descriptor,
        source: body.source,
        expiresAt: body.expiresAt,
      });

      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPSERT",
        entityType: "BiometricTemplate",
        entityId: body.workerId,
        after: { workerId: body.workerId },
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.status(201).json({ workerId: body.workerId });
    } catch (err) {
      next(err);
    }
  },
);
