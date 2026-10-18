import { api } from "./api";

export type NotificationType =
  | "CLARIFICATION_OPEN"
  | "CLARIFICATION_ANSWERED"
  | "CLARIFICATION_CLOSED"
  | "POINTAGE_REJECTED"
  | "POINTAGE_VALIDATED"
  | "ACTIVITY_REQUEST_DECIDED"
  | "WORKER_REQUEST_DECIDED";

export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType: string;
  entityId: string | null;
  payload: { href?: string; [key: string]: unknown } | null;
  readAt: string | null;
  createdAt: string;
}

export const NOTIFICATIONS_UPDATED_EVENT = "alterra:notifications-updated";

export function emitNotificationsUpdated(): void {
  window.dispatchEvent(new Event(NOTIFICATIONS_UPDATED_EVENT));
}

export async function fetchNotifications(cursor?: string): Promise<{
  data: AppNotification[];
  nextCursor: string | null;
  hasMore: boolean;
}> {
  const res = await api.get<{
    data: AppNotification[];
    nextCursor: string | null;
    hasMore: boolean;
  }>("/notifications", { params: { cursor, take: 30 } });
  return res.data;
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await api.get<{ count: number }>("/notifications/unread-count");
  return res.data.count;
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const res = await api.patch<AppNotification>(`/notifications/${id}/read`);
  emitNotificationsUpdated();
  return res.data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post("/notifications/read-all");
  emitNotificationsUpdated();
}

export async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await api.get<{ publicKey: string }>("/notifications/vapid-public-key");
    return res.data.publicKey;
  } catch {
    return null;
  }
}

export async function subscribePush(subscription: PushSubscriptionJSON): Promise<void> {
  if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    throw new Error("Abonnement push invalide");
  }
  await api.post("/notifications/push-subscribe", {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await api.delete("/notifications/push-subscribe", { data: { endpoint } });
}

export function notificationHref(n: AppNotification): string {
  const href = n.payload && typeof n.payload.href === "string" ? n.payload.href : null;
  if (href) return href;
  switch (n.type) {
    case "CLARIFICATION_OPEN":
    case "CLARIFICATION_ANSWERED":
    case "CLARIFICATION_CLOSED":
      return "/clarifications";
    case "POINTAGE_REJECTED":
    case "POINTAGE_VALIDATED":
      return "/my-pointages";
    case "ACTIVITY_REQUEST_DECIDED":
      return "/activity-requests";
    case "WORKER_REQUEST_DECIDED":
      return "/worker-requests";
    default:
      return "/notifications";
  }
}
