import { Router } from "express";
import { z } from "zod";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";

export const sitesRouter = Router();

sitesRouter.get("/sites", requireAuth, async (req, res, next) => {
  try {
    const where = req.user!.role === Role.ADMIN ? {} : { id: req.user!.siteId ?? "__none__" };
    const sites = await prisma.site.findMany({ where, orderBy: { name: "asc" } });
    res.json({ data: sites });
  } catch (err) {
    next(err);
  }
});

const createSiteSchema = z.object({
  name: z.string().min(2),
  shortCode: z.string().min(2).max(10),
  location: z.string().optional(),
  geoLat: z.number().optional(),
  geoLng: z.number().optional(),
});

sitesRouter.post("/sites", requireAuth, requireRole(Role.ADMIN), validate(createSiteSchema), async (req, res, next) => {
  try {
    const site = await prisma.site.create({ data: req.body });
    res.status(201).json(site);
  } catch (err) {
    next(err);
  }
});
