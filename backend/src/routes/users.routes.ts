import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { ApiError } from "../middleware/error-handler.js";
import { writeAuditLog } from "../services/audit/audit.service.js";
import { invalidateTokensIssuedBefore, unblockUser } from "../lib/redis.js";
import {
  deactivateUser,
  generateTempPassword,
  hashPassword,
  resetUserPassword,
} from "../services/users/user-admin.service.js";
import { bulkIdsSchema, runBulk } from "../lib/bulk.js";
import { assertCanAssignRole, assertCanManageUser } from "../services/access/role-assignment.js";

export const usersRouter = Router();

const userIdParams = z.object({ id: z.guid() });

const USER_SORT_FIELDS = [
  "lastName",
  "email",
  "role",
  "siteId",
  "active",
  "lastLoginAt",
  "createdAt",
] as const;

const listUsersQuery = z.object({
  roleId: z.guid().optional(),
  siteId: z.guid().optional(),
  active: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  q: z.string().min(1).optional(),
  cursor: z.guid().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
  orderBy: z.enum(USER_SORT_FIELDS).optional(),
  dir: z.enum(["asc", "desc"]).optional(),
});

/** Case-insensitive partial match on nom/prénom/email (Prisma ilike). */
function buildUserSearchFilter(q: string): Prisma.UserWhereInput {
  return {
    OR: [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ],
  };
}

const bulkIdsOnlySchema = z.object({ ids: bulkIdsSchema });

const createUserSchema = z.object({
  email: z.email().optional(),
  phone: z.string().min(8).optional(),
  password: z.string().min(8).optional(),
  roleId: z.guid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  siteId: z.guid().nullable().optional(),
  teamId: z.guid().nullable().optional(),
  active: z.boolean().optional(),
});

const updateUserSchema = z.object({
  email: z.email().nullable().optional(),
  phone: z.string().min(8).nullable().optional(),
  roleId: z.guid().optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  siteId: z.guid().nullable().optional(),
  teamId: z.guid().nullable().optional(),
  active: z.boolean().optional(),
});

const resetPasswordSchema = z.object({
  password: z.string().min(8).optional(),
});

const USER_SELECT = {
  id: true,
  email: true,
  phone: true,
  accessRoleId: true,
  accessRole: { select: { name: true } },
  firstName: true,
  lastName: true,
  active: true,
  siteId: true,
  teamId: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type UserRow = Prisma.UserGetPayload<{ select: typeof USER_SELECT }>;

function serializeUser(user: UserRow) {
  const { accessRoleId, accessRole, ...rest } = user;
  return { ...rest, roleId: accessRoleId, roleName: accessRole.name };
}

usersRouter.use(requireAuth);

usersRouter.get(
  "/",
  requirePermission("utilisateur:lecture"),
  validate(listUsersQuery, "query"),
  async (req, res, next) => {
    try {
      const { roleId, siteId, active, q, cursor, take, orderBy, dir } =
        req.query as unknown as z.infer<typeof listUsersQuery>;

      const where: Prisma.UserWhereInput = { deletedAt: null };
      if (roleId) where.accessRoleId = roleId;
      if (siteId) where.siteId = siteId;
      if (active !== undefined) where.active = active;
      if (q) Object.assign(where, buildUserSearchFilter(q));

      const pageSize = take ?? 50;
      const sortDir = dir ?? "asc";
      const sortField =
        orderBy === "role" ? { accessRole: { name: sortDir } } : { [orderBy ?? ""]: sortDir };
      const users = await prisma.user.findMany({
        where,
        orderBy: orderBy
          ? [sortField, { id: "asc" }]
          : [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
        take: pageSize + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: USER_SELECT,
      });

      const hasMore = users.length > pageSize;
      const page = hasMore ? users.slice(0, pageSize) : users;
      const nextCursor = hasMore ? page[page.length - 1]?.id : null;

      res.json({ data: page.map(serializeUser), nextCursor, hasMore });
    } catch (err) {
      next(err);
    }
  },
);

usersRouter.get(
  "/:id",
  requirePermission("utilisateur:lecture"),
  validate(userIdParams, "params"),
  async (req, res, next) => {
    try {
      const user = await prisma.user.findFirst({
        where: { id: req.params.id, deletedAt: null },
        select: USER_SELECT,
      });
      if (!user) throw new ApiError(404, "NOT_FOUND", "Utilisateur introuvable");
      res.json(serializeUser(user));
    } catch (err) {
      next(err);
    }
  },
);

usersRouter.post(
  "/",
  requirePermission("utilisateur:ecriture"),
  validate(createUserSchema),
  async (req, res, next) => {
    try {
      // `password` n'est pas une colonne : seul son hachage est stocké.
      const { password, roleId, ...fields } = req.body;
      await assertCanAssignRole(req.user!, roleId);
      const tempPassword = password ?? generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);

      const user = serializeUser(
        await prisma.user.create({
          data: { ...fields, accessRoleId: roleId, passwordHash },
          select: USER_SELECT,
        }),
      );

      await writeAuditLog({
        userId: req.user!.sub,
        action: "CREATE",
        entityType: "User",
        entityId: user.id,
        after: user,
        ip: req.ip,
        userAgent: req.headers["user-agent"],
      });

      res
        .status(201)
        .json({ user, temporaryPassword: req.body.password ? undefined : tempPassword });
    } catch (err) {
      next(err);
    }
  },
);

usersRouter.patch(
  "/:id",
  requirePermission("utilisateur:ecriture"),
  validate(userIdParams, "params"),
  validate(updateUserSchema),
  async (req, res, next) => {
    try {
      const before = await prisma.user.findFirst({
        where: { id: req.params.id, deletedAt: null },
      });
      if (!before) throw new ApiError(404, "NOT_FOUND", "Utilisateur introuvable");
      await assertCanManageUser(req.user!, before);

      const { roleId, ...fields } = req.body;
      const roleChanges = roleId !== undefined && roleId !== before.accessRoleId;
      if (roleChanges) {
        if (before.id === req.user!.sub) {
          throw new ApiError(
            403,
            "SELF_ROLE_CHANGE",
            "Vous ne pouvez pas modifier votre propre rôle",
          );
        }
        await assertCanAssignRole(req.user!, roleId);
      }

      const user = serializeUser(
        await prisma.user.update({
          where: { id: req.params.id },
          data: { ...fields, ...(roleChanges ? { accessRoleId: roleId } : {}) },
          select: USER_SELECT,
        }),
      );

      // Sans ça, un compte réactivé reste bloqué par `deactivateUser` (clé Redis TTL 7 jours) :
      // il se reconnecte mais chaque appel API suivant répond 401 USER_BLOCKED.
      if (!before.active && user.active) {
        await unblockUser(user.id);
      }

      if (roleChanges) {
        await invalidateTokensIssuedBefore(user.id);
      }

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
  requirePermission("utilisateur:ecriture"),
  validate(userIdParams, "params"),
  validate(resetPasswordSchema),
  async (req, res, next) => {
    try {
      const existing = await prisma.user.findFirst({
        where: { id: req.params.id, deletedAt: null },
      });
      if (!existing) throw new ApiError(404, "NOT_FOUND", "Utilisateur introuvable");
      await assertCanManageUser(req.user!, existing);

      const tempPassword = req.body.password ?? generateTempPassword();
      const passwordHash = await hashPassword(tempPassword);

      await resetUserPassword(req.params.id, passwordHash);

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

usersRouter.post(
  "/:id/deactivate",
  requirePermission("utilisateur:ecriture"),
  validate(userIdParams, "params"),
  async (req, res, next) => {
    try {
      const existing = await prisma.user.findFirst({
        where: { id: req.params.id, deletedAt: null },
      });
      if (!existing) throw new ApiError(404, "NOT_FOUND", "Utilisateur introuvable");
      await assertCanManageUser(req.user!, existing);

      const user = await deactivateUser(req.params.id, {
        ip: req.ip,
        userAgent:
          typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
      });

      res.json({
        id: user.id,
        active: user.active,
        message: "Utilisateur désactivé",
      });
    } catch (err) {
      next(err);
    }
  },
);

usersRouter.post(
  "/bulk-deactivate",
  requirePermission("utilisateur:ecriture"),
  validate(bulkIdsOnlySchema),
  async (req, res, next) => {
    try {
      const { ids } = req.body as z.infer<typeof bulkIdsOnlySchema>;
      const meta = {
        ip: req.ip,
        userAgent:
          typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
      };
      const results = await runBulk(ids, async (id) => {
        const existing = await prisma.user.findFirst({ where: { id, deletedAt: null } });
        if (!existing) throw new ApiError(404, "NOT_FOUND", "Utilisateur introuvable");
        await assertCanManageUser(req.user!, existing);
        await deactivateUser(id, meta);
      });
      res.json({ results });
    } catch (err) {
      next(err);
    }
  },
);
