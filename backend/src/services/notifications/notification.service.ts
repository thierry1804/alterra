import { NotificationType, Role, type Notification, type Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../middleware/error-handler.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { emitToUser } from "../../realtime/socket.js";
import { sendWebPushToUser } from "./web-push.service.js";

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string;
  entityId?: string | null;
  payload?: Record<string, unknown> | null;
  actorUserId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

export type NotificationDto = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string;
  entityId: string | null;
  payload: Prisma.JsonValue | null;
  readAt: string | null;
  createdAt: string;
};

function toDto(row: Notification): NotificationDto {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    body: row.body,
    entityType: row.entityType,
    entityId: row.entityId,
    payload: row.payload,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Persiste, audite, émet Socket.IO et tente Web Push. */
export async function createAndDispatch(input: CreateNotificationInput): Promise<NotificationDto> {
  const row = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      payload: (input.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });

  const dto = toDto(row);

  await writeAuditLog({
    userId: input.actorUserId ?? input.userId,
    action: "NOTIFY",
    entityType: "Notification",
    entityId: row.id,
    after: {
      type: row.type,
      userId: row.userId,
      entityType: row.entityType,
      entityId: row.entityId,
    },
    ip: input.ip,
    userAgent: input.userAgent,
  });

  emitToUser(input.userId, "notification", dto);

  await sendWebPushToUser(
    input.userId,
    {
      title: input.title,
      body: input.body,
      data: {
        notificationId: row.id,
        type: row.type,
        entityType: row.entityType,
        entityId: row.entityId,
        ...(input.payload ?? {}),
      },
    },
    {
      actorUserId: input.actorUserId,
      ip: input.ip,
      userAgent: input.userAgent,
    },
  );

  return dto;
}

export async function createAndDispatchMany(
  inputs: CreateNotificationInput[],
): Promise<NotificationDto[]> {
  const results: NotificationDto[] = [];
  for (const input of inputs) {
    results.push(await createAndDispatch(input));
  }
  return results;
}

/** CDE actifs rattachés à une équipe. */
export async function findChefEquipeIdsByTeam(teamId: string): Promise<string[]> {
  const users = await prisma.user.findMany({
    where: {
      role: Role.CHEF_EQUIPE,
      teamId,
      active: true,
      deletedAt: null,
    },
    select: { id: true },
  });
  return users.map((u) => u.id);
}

export async function listNotifications(
  userId: string,
  opts: { cursor?: string; take?: number } = {},
) {
  const pageSize = opts.take ?? 30;
  const rows = await prisma.notification.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
    ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > pageSize;
  const data = hasMore ? rows.slice(0, pageSize) : rows;
  return {
    data: data.map(toDto),
    nextCursor: hasMore ? data[data.length - 1]?.id : null,
    hasMore,
  };
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

export async function markNotificationRead(
  userId: string,
  id: string,
  audit?: { ip?: string | null; userAgent?: string | null },
): Promise<NotificationDto> {
  const existing = await prisma.notification.findFirst({ where: { id, userId } });
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Notification introuvable");

  if (existing.readAt) return toDto(existing);

  const row = await prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  await writeAuditLog({
    userId,
    action: "NOTIFY_READ",
    entityType: "Notification",
    entityId: id,
    after: { readAt: row.readAt },
    ip: audit?.ip,
    userAgent: audit?.userAgent,
  });

  return toDto(row);
}

export async function markAllNotificationsRead(
  userId: string,
  audit?: { ip?: string | null; userAgent?: string | null },
): Promise<{ count: number }> {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

  await writeAuditLog({
    userId,
    action: "NOTIFY_READ_ALL",
    entityType: "Notification",
    entityId: null,
    after: { count: result.count },
    ip: audit?.ip,
    userAgent: audit?.userAgent,
  });

  return { count: result.count };
}

export async function upsertPushSubscription(
  userId: string,
  input: { endpoint: string; p256dh: string; auth: string; userAgent?: string | null },
  audit?: { ip?: string | null; userAgent?: string | null },
) {
  const row = await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    },
    update: {
      userId,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
    },
  });

  await writeAuditLog({
    userId,
    action: "PUSH_SUBSCRIBE",
    entityType: "PushSubscription",
    entityId: row.id,
    after: { endpoint: row.endpoint.slice(-24) },
    ip: audit?.ip,
    userAgent: audit?.userAgent,
  });

  return row;
}

export async function deletePushSubscription(
  userId: string,
  endpoint: string,
  audit?: { ip?: string | null; userAgent?: string | null },
) {
  const existing = await prisma.pushSubscription.findFirst({
    where: { endpoint, userId },
  });
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Abonnement introuvable");

  await prisma.pushSubscription.delete({ where: { id: existing.id } });

  await writeAuditLog({
    userId,
    action: "PUSH_UNSUBSCRIBE",
    entityType: "PushSubscription",
    entityId: existing.id,
    after: { endpoint: endpoint.slice(-24) },
    ip: audit?.ip,
    userAgent: audit?.userAgent,
  });
}
