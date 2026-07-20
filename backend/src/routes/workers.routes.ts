import { Router } from "express";
import { z } from "zod";
import { Role, WorkerStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole, siteScope } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";

export const workersRouter = Router();

workersRouter.get("/workers", requireAuth, siteScope, async (req, res, next) => {
  try {
    const workers = await prisma.worker.findMany({
      where: { siteId: req.siteScope, deletedAt: null },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 100,
    });
    res.json({ data: workers });
  } catch (err) {
    next(err);
  }
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
});

workersRouter.post("/workers", requireAuth, requireRole(Role.ADMIN), validate(createWorkerSchema), async (req, res, next) => {
  try {
    const worker = await prisma.worker.create({ data: req.body });
    res.status(201).json(worker);
  } catch (err) {
    next(err);
  }
});
