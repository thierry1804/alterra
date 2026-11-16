import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { AccessScope } from "@prisma/client";
import { basePrisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAnyPermission, requirePermission } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { writeAuditLog } from "../services/audit/audit.service.js";
import { invalidateRoleAccess } from "../services/access/access.service.js";
import { PERMISSION_CATALOG } from "../services/access/permissions.catalog.js";
import {
  createGroup,
  createRole,
  deleteGroup,
  deleteRole,
  listGroups,
  listRoleOptions,
  listRoles,
  updateGroup,
  updateRole,
} from "../services/access/access-admin.service.js";

export const accessRouter = Router();

const idParams = z.object({ id: z.guid() });

const nameSchema = z.string().trim().min(2).max(60);
const descriptionSchema = z.string().trim().max(200).nullable().optional();

const groupSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  permissions: z.array(z.string().min(1)).max(300),
});

const groupPatchSchema = groupSchema.partial();

const roleSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  scope: z.enum(AccessScope),
  mfaRequired: z.boolean().optional(),
  groupIds: z.array(z.guid()).max(100),
});

const rolePatchSchema = roleSchema.partial();

function auditMeta(req: Request) {
  return {
    userId: req.user!.sub,
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

accessRouter.get("/access/catalog", requireAuth, requirePermission("role:gerer"), (_req, res) => {
  res.json({ resources: PERMISSION_CATALOG });
});

accessRouter.get(
  "/access/role-options",
  requireAuth,
  requireAnyPermission("utilisateur:lecture", "role:gerer"),
  async (_req, res, next) => {
    try {
      res.json({ data: await listRoleOptions(basePrisma) });
    } catch (err) {
      next(err);
    }
  },
);

accessRouter.get(
  "/access/groups",
  requireAuth,
  requirePermission("role:gerer"),
  async (_req, res, next) => {
    try {
      res.json({ data: await listGroups(basePrisma) });
    } catch (err) {
      next(err);
    }
  },
);

accessRouter.post(
  "/access/groups",
  requireAuth,
  requirePermission("role:gerer"),
  validate(groupSchema),
  async (req, res, next) => {
    try {
      const group = await basePrisma.$transaction((tx) => createGroup(tx, req.user!, req.body));
      invalidateRoleAccess();
      await writeAuditLog({
        ...auditMeta(req),
        action: "CREATE",
        entityType: "PermissionGroup",
        entityId: group.id,
        after: group,
      });
      res.status(201).json(group);
    } catch (err) {
      next(err);
    }
  },
);

accessRouter.patch(
  "/access/groups/:id",
  requireAuth,
  requirePermission("role:gerer"),
  validate(idParams, "params"),
  validate(groupPatchSchema),
  async (req, res, next) => {
    try {
      const { before, after } = await basePrisma.$transaction((tx) =>
        updateGroup(tx, req.user!, req.params.id, req.body),
      );
      invalidateRoleAccess();
      await writeAuditLog({
        ...auditMeta(req),
        action: "UPDATE",
        entityType: "PermissionGroup",
        entityId: after.id,
        before,
        after,
      });
      res.json(after);
    } catch (err) {
      next(err);
    }
  },
);

accessRouter.delete(
  "/access/groups/:id",
  requireAuth,
  requirePermission("role:gerer"),
  validate(idParams, "params"),
  async (req, res, next) => {
    try {
      const before = await basePrisma.$transaction((tx) =>
        deleteGroup(tx, req.user!, req.params.id),
      );
      invalidateRoleAccess();
      await writeAuditLog({
        ...auditMeta(req),
        action: "DELETE",
        entityType: "PermissionGroup",
        entityId: before.id,
        before,
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

accessRouter.get(
  "/access/roles",
  requireAuth,
  requirePermission("role:gerer"),
  async (_req, res, next) => {
    try {
      res.json({ data: await listRoles(basePrisma) });
    } catch (err) {
      next(err);
    }
  },
);

accessRouter.post(
  "/access/roles",
  requireAuth,
  requirePermission("role:gerer"),
  validate(roleSchema),
  async (req, res, next) => {
    try {
      const role = await basePrisma.$transaction((tx) => createRole(tx, req.user!, req.body));
      invalidateRoleAccess();
      await writeAuditLog({
        ...auditMeta(req),
        action: "CREATE",
        entityType: "AccessRole",
        entityId: role.id,
        after: role,
      });
      res.status(201).json(role);
    } catch (err) {
      next(err);
    }
  },
);

accessRouter.patch(
  "/access/roles/:id",
  requireAuth,
  requirePermission("role:gerer"),
  validate(idParams, "params"),
  validate(rolePatchSchema),
  async (req, res, next) => {
    try {
      const { before, after } = await basePrisma.$transaction((tx) =>
        updateRole(tx, req.user!, req.params.id, req.body),
      );
      invalidateRoleAccess();
      await writeAuditLog({
        ...auditMeta(req),
        action: "UPDATE",
        entityType: "AccessRole",
        entityId: after.id,
        before,
        after,
      });
      res.json(after);
    } catch (err) {
      next(err);
    }
  },
);

accessRouter.delete(
  "/access/roles/:id",
  requireAuth,
  requirePermission("role:gerer"),
  validate(idParams, "params"),
  async (req, res, next) => {
    try {
      const before = await basePrisma.$transaction((tx) =>
        deleteRole(tx, req.user!, req.params.id),
      );
      invalidateRoleAccess();
      await writeAuditLog({
        ...auditMeta(req),
        action: "DELETE",
        entityType: "AccessRole",
        entityId: before.id,
        before,
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
