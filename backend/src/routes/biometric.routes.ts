import { Router } from "express";
import { BioContext, Role } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { performBiometricCheck } from "../services/biometric/check.service.js";

export const biometricRouter = Router();

const checkSchema = z.object({
  workerId: z.string().uuid(),
  context: z.nativeEnum(BioContext).optional(),
  photoBase64: z.string().min(32).optional(),
  referenceDate: z.coerce.date().optional(),
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
