import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/rbac.js";
import { validate } from "../middleware/validate.js";
import { ApiError } from "../middleware/error-handler.js";
import {
  deletePushSubscription,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadCount,
  upsertPushSubscription,
} from "../services/notifications/notification.service.js";
import { getVapidPublicKey } from "../services/notifications/web-push.service.js";

export const notificationsRouter = Router();

const PWA_ROLES = [Role.CHEF_SERVICE, Role.CHEF_EQUIPE, Role.ADMIN] as const;

const listQuery = z.object({
  cursor: z.string().uuid().optional(),
  take: z.coerce.number().int().min(1).max(100).optional(),
});

const idParams = z.object({ id: z.string().uuid() });

const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const pushUnsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

notificationsRouter.get(
  "/notifications/vapid-public-key",
  requireAuth,
  requireRole(...PWA_ROLES),
  (_req, res) => {
    const key = getVapidPublicKey();
    if (!key) {
      throw new ApiError(503, "PUSH_UNAVAILABLE", "Web Push non configuré (clés VAPID manquantes)");
    }
    res.json({ publicKey: key });
  },
);

notificationsRouter.get(
  "/notifications/unread-count",
  requireAuth,
  requireRole(...PWA_ROLES),
  async (req, res, next) => {
    try {
      const count = await unreadCount(req.user!.sub);
      res.json({ count });
    } catch (err) {
      next(err);
    }
  },
);

notificationsRouter.get(
  "/notifications",
  requireAuth,
  requireRole(...PWA_ROLES),
  validate(listQuery, "query"),
  async (req, res, next) => {
    try {
      const query = req.query as unknown as z.infer<typeof listQuery>;
      const page = await listNotifications(req.user!.sub, {
        cursor: query.cursor,
        take: query.take,
      });
      res.json(page);
    } catch (err) {
      next(err);
    }
  },
);

notificationsRouter.patch(
  "/notifications/:id/read",
  requireAuth,
  requireRole(...PWA_ROLES),
  validate(idParams, "params"),
  async (req, res, next) => {
    try {
      const row = await markNotificationRead(req.user!.sub, req.params.id, {
        ip: req.ip,
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
      });
      res.json(row);
    } catch (err) {
      next(err);
    }
  },
);

notificationsRouter.post(
  "/notifications/read-all",
  requireAuth,
  requireRole(...PWA_ROLES),
  async (req, res, next) => {
    try {
      const result = await markAllNotificationsRead(req.user!.sub, {
        ip: req.ip,
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

notificationsRouter.post(
  "/notifications/push-subscribe",
  requireAuth,
  requireRole(...PWA_ROLES),
  validate(pushSubscribeSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof pushSubscribeSchema>;
      const row = await upsertPushSubscription(
        req.user!.sub,
        {
          endpoint: body.endpoint,
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
          userAgent:
            typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        },
        {
          ip: req.ip,
          userAgent:
            typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
        },
      );
      res.status(201).json({ id: row.id });
    } catch (err) {
      next(err);
    }
  },
);

notificationsRouter.delete(
  "/notifications/push-subscribe",
  requireAuth,
  requireRole(...PWA_ROLES),
  validate(pushUnsubscribeSchema),
  async (req, res, next) => {
    try {
      const body = req.body as z.infer<typeof pushUnsubscribeSchema>;
      await deletePushSubscription(req.user!.sub, body.endpoint, {
        ip: req.ip,
        userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
      });
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);
