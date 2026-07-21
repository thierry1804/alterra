import { Router } from "express";
import { z } from "zod";
import { Prisma, Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { ApiError } from "../middleware/error-handler.js";
import { writeAuditLog } from "../services/audit/audit.service.js";
import {
  deactivateUser,
  generateTempPassword,
  hashPassword,
} from "../services/users/user-admin.service.js";

export const usersRouter = Router();

const userIdParams = z.object({ id: z.string().uuid() });

const listUsersQuery = z.object({
  role: z.nativeEnum(Role).optional(),
  siteId: z.string().uuid().optional(),
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});

const createUserSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(8).optional(),
  password: z.string().min(8).optional(),
  role: z.nativeEnum(Role),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  siteId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
});

const updateUserSchema = z.object({
  email: z.string().email().nullable().optional(),
  phone: z.string().min(8).nullable().optional(),
  role: z.nativeEnum(Role).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  siteId: z.string().uuid().nullable().optional(),
  teamId: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8).optional(),
});

usersRouter.use(requireAuth, requireRole(Role.ADMIN));

usersRouter.get("/", validate(listUsersQuery, "query"), async (req, res, next) => {
  try {
    const { role, siteId, active, cursor, take } = req.query as z.infer<typeof listUsersQuery>;

    const where: Prisma.UserWhereInput = { deletedAt: null };
    if (role) where.role = role;
    if (siteId) where.siteId = siteId;
    if (active !== undefined) where.active = active;

    const pageSize = take ?? 50;
    const users = await prisma.user.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
      take: pageSize + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        firstName: true,
        lastName: true,
        active: true,
        siteId: true,
        teamId: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const hasMore = users.length > pageSize;
    const data = hasMore ? users.slice(0, pageSize) : users;
    const nextCursor = hasMore ? data[data.length - 1]?.id : null;

    res.json({ data, nextCursor, hasMore });
  } catch (err) {
    next(err);
  }
});

usersRouter.get("/:id", validate(userIdParams, "params"), async (req, res, next) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, deletedAt: null },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        firstName: true,
        lastName: true,
        active: true,
        siteId: true,
        teamId: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) throw new ApiError(404, "NOT_FOUND", "Utilisateur introuvable");
    res.json(user);
  } catch (err) {
    next(err);
  }
});

usersRouter.post("/", validate(createUserSchema), async (req, res, next) => {
  try {
    const tempPassword = req.body.password ?? generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const user = await prisma.user.create({
      data: {
        ...req.body,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        phone: true,
        role: true,
        firstName: true,
        lastName: true,
        active: true,
        siteId: true,
        teamId: true,
        createdAt: true,
      },
    });

    await writeAuditLog({
      userId: req.user!.sub,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      after: user,
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json({ user, temporaryPassword: req.body.password ? undefined : tempPassword });
  } catch (err) {
    next(err);
  }
});

usersRouter.patch(
  "/:id",
  validate(userIdParams, "params"),
  validate(updateUserSchema),
  async (req, res, next) => {
    try {
      const before = await prisma.user.findFirst({
        where: { id: req.params.id, deletedAt: null },
      });
      if (!before) throw new ApiError(404, "NOT_FOUND", "Utilisateur introuvable");

      const user = await prisma.user.update({
        where: { id: req.params.id },
        data: req.body,
        select: {
          id: true,
          email: true,
          phone: true,
          role: true,
          firstName: true,
          lastName: true,
          active: true,
          siteId: true,
          teamId: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await writeAuditLog({
        userId: req.user!.sub,
        action: "UPDATE",
        entityType: "User",
        entityId: user.id,
        before,
        after: user,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json(user);
    } catch (err) {
      next(err);
    }
  },
);

usersRouter.post(
  "/:id/reset-password",
  validate(userIdParams, "params"),
  validate(resetPasswordSchema),
  async (req, res, next) => {
    try {
      const existing = await prisma.user.findFirst({
        where: { id: req.params.id, deletedAt: null },
      });
      if (!existing) throw new ApiError(404, "NOT_FOUND", "Utilisateur introuvable");

      const tempPassword = req.body.password ?? generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);

      await prisma.user.update({
        where: { id: req.params.id },
        data: { passwordHash },
      });

      await writeAuditLog({
        userId: req.user!.sub,
        action: "RESET_PASSWORD",
        entityType: "User",
        entityId: req.params.id,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res.json({
        temporaryPassword: req.body.password ? undefined : tempPassword,
        message: "Mot de passe réinitialisé",
      });
    } catch (err) {
      next(err);
    }
  },
);

usersRouter.post("/:id/deactivate", validate(userIdParams, "params"), async (req, res, next) => {
  try {
    const existing = await prisma.user.findFirst({
      where: { id: req.params.id, deletedAt: null },
    });
    if (!existing) throw new ApiError(404, "NOT_FOUND", "Utilisateur introuvable");

    const user = await deactivateUser(req.params.id, {
      ip: req.ip,
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
    });

    res.json({
      id: user.id,
      active: user.active,
      message: "Utilisateur désactivé",
    });
  } catch (err) {
    next(err);
  }
});
