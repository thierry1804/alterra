import { Router } from "express";
import rateLimit from "express-rate-limit";
import { BioContext } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { getBridgeLicenseProvider } from "../services/biometric/bridge-license.provider.js";
import {
  BRIDGE_OUTCOMES,
  completeSession,
  createSession,
  getSessionView,
  startSession,
} from "../services/biometric/session.service.js";

export const biometricSessionsRouter = Router();

const referenceParams = z.object({ reference: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/) });
const idParams = z.object({ id: z.guid() });

const createSchema = z.object({
  workerId: z.guid(),
  context: z.enum(BioContext).optional(),
  referenceDate: z.coerce.date().optional(),
});

const startSchema = z.object({
  deviceId: z.string().trim().min(1).max(128),
  engineVersion: z.string().trim().max(64).default(""),
});

const resultSchema = z.object({
  deviceId: z.string().trim().min(1).max(128),
  engineVersion: z.string().trim().max(64).default(""),
  outcome: z.enum(BRIDGE_OUTCOMES),
  score: z.number().int().min(0).max(1000).nullish(),
  liveness: z.number().int().min(0).max(1000).nullish(),
  distanceCm: z.number().int().min(0).max(10000).nullish(),
  errorCode: z.string().trim().max(64).nullish(),
});

const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: process.env.NODE_ENV === "production" ? 30 : 300,
  standardHeaders: true,
  legacyHeaders: false,
});

biometricSessionsRouter.post(
  "/biometric/sessions",
  requireAuth,
  requirePermission("biometrie:verifier_en_ligne"),
  validate(createSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof createSchema>;
      const session = await createSession({
        workerId: body.workerId,
        createdById: req.user!.sub,
        context: body.context,
        referenceDate: body.referenceDate,
        ip: req.ip,
      });
      res.status(201).json(session);
    } catch (err) {
      next(err);
    }
  },
);

biometricSessionsRouter.get(
  "/biometric/sessions/:id",
  requireAuth,
  requirePermission("biometrie:verifier_en_ligne"),
  validate(idParams, "params"),
  async (req, res, next) => {
    try {
      res.json(await getSessionView(req.params.id as string, req.user!.sub));
    } catch (err) {
      next(err);
    }
  },
);

biometricSessionsRouter.post(
  "/biometric/sessions/:reference/start",
  publicLimiter,
  validate(referenceParams, "params"),
  validate(startSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof startSchema>;
      const ticket = await startSession(
        req.params.reference as string,
        { deviceId: body.deviceId, engineVersion: body.engineVersion },
        getBridgeLicenseProvider(),
      );
      res.json({
        accessToken: ticket.accessToken,
        referenceFace: ticket.referenceFaceBase64,
        matchingThreshold: ticket.matchingThreshold,
        timeoutSeconds: ticket.timeoutSeconds,
        livenessThreshold: ticket.livenessThreshold,
      });
    } catch (err) {
      next(err);
    }
  },
);

biometricSessionsRouter.post(
  "/biometric/sessions/:reference/result",
  publicLimiter,
  validate(referenceParams, "params"),
  validate(resultSchema),
  async (req, res, next) => {
    try {
      const session = await completeSession(
        req.params.reference as string,
        req.body as z.infer<typeof resultSchema>,
        req.ip,
      );
      res.json({ status: session.status });
    } catch (err) {
      next(err);
    }
  },
);
