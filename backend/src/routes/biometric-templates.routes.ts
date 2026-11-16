import { Router } from "express";
import { BioProvider } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { writeAuditLog } from "../services/audit/audit.service.js";
import {
  listTemplatesForSync,
  parseDescriptor,
  upsertWorkerTemplate,
} from "../services/biometric/template.service.js";

export const biometricTemplatesRouter = Router();

const upsertTemplateSchema = z.object({
  workerId: z.guid(),
  descriptor: z.array(z.number()).length(128),
  source: z.enum(BioProvider).optional(),
  expiresAt: z.coerce.date().optional(),
});

biometricTemplatesRouter.get(
  "/biometric/templates/sync",
  requireAuth,
  requirePermission("biometrie:gabarits_lecture"),
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
  requirePermission("biometrie:gabarits_ecriture"),
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
