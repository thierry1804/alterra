import webpush from "web-push";
import { prisma } from "../../lib/prisma.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { logger } from "../../lib/logger.js";

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:noreply@alterra.mg";
  if (!publicKey || !privateKey) {
    logger.warn("Web Push: VAPID keys missing — push disabled");
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Envoie un Web Push à tous les abonnements de l'utilisateur ; purge les endpoints morts. */
export async function sendWebPushToUser(
  userId: string,
  payload: PushPayload,
  audit?: { actorUserId?: string | null; ip?: string | null; userAgent?: string | null },
): Promise<void> {
  if (!ensureVapid()) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return;

  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          body,
        );
        await writeAuditLog({
          userId: audit?.actorUserId ?? userId,
          action: "PUSH_SEND",
          entityType: "PushSubscription",
          entityId: sub.id,
          after: { userId, endpoint: sub.endpoint.slice(-24), title: payload.title },
          ip: audit?.ip,
          userAgent: audit?.userAgent,
        });
      } catch (err) {
        const statusCode =
          err && typeof err === "object" && "statusCode" in err
            ? Number((err as { statusCode: number }).statusCode)
            : undefined;
        await writeAuditLog({
          userId: audit?.actorUserId ?? userId,
          action: "PUSH_FAIL",
          entityType: "PushSubscription",
          entityId: sub.id,
          after: { userId, statusCode, message: err instanceof Error ? err.message : String(err) },
          ip: audit?.ip,
          userAgent: audit?.userAgent,
        });
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => undefined);
        }
        logger.warn({ err, userId, subId: sub.id }, "Web Push send failed");
      }
    }),
  );
}
