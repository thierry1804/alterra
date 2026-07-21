import { Router } from "express";
import { BioContext, BioResult, Role } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { performBiometricCheck } from "../services/biometric/check.service.js";
import { recordOfflineBiometricCheck } from "../services/biometric/check-offline.service.js";

export const biometricRouter = Router();

const checkSchema = z.object({
  workerId: z.string().uuid(),
  context: z.nativeEnum(BioContext).optional(),
  photoBase64: z.string().min(32).optional(),
  referenceDate: z.coerce.date().optional(),
});

const checkOfflineSchema = z.object({
  clientUuid: z.string().uuid(),
  workerId: z.string().uuid(),
  result: z.nativeEnum(BioResult),
  score: z.number().min(0).max(1).nullable(),
  context: z.nativeEnum(BioContext).optional(),
  referenceDate: z.coerce.date().optional(),
  performedAt: z.coerce.date(),
});

biometricRouter.post(
  "/biometric/check",
  requireAuth,
  requireRole(Role.CHEF_SERVICE, Role.ADMIN),
  validate(checkSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof checkSchema>;
      const result = await performBiometricCheck({
        workerId: body.workerId,
        performedById: req.user!.sub,
        context: body.context,
        photoBase64: body.photoBase64,
        referenceDate: body.referenceDate,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },
);

biometricRouter.post(
  "/biometric/check-offline",
  requireAuth,
  requireRole(Role.CHEF_EQUIPE, Role.CHEF_SERVICE, Role.ADMIN),
  validate(checkOfflineSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof checkOfflineSchema>;
      const result = await recordOfflineBiometricCheck({
        clientUuid: body.clientUuid,
        workerId: body.workerId,
        result: body.result,
        score: body.score,
        performedById: req.user!.sub,
        context: body.context,
        referenceDate: body.referenceDate,
        performedAt: body.performedAt,
      });
      res.status(result.status === "created" ? 201 : 200).json(result);
    } catch (err) {
      next(err);
    }
  },
);
