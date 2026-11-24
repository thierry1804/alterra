import type { Prisma } from "@prisma/client";
import { basePrisma } from "../../lib/prisma-base.js";

export interface WriteAuditLogParams {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

type AuditClient = Pick<typeof basePrisma, "auditLog">;

/**
 * Append-only audit entry — uses base client to avoid extension recursion. Passer le client d'une
 * transaction pour que la trace soit écrite (ou annulée) avec la modification qu'elle décrit.
 */
export async function writeAuditLog(
  params: WriteAuditLogParams,
  client: AuditClient = basePrisma,
): Promise<void> {
  await client.auditLog.create({
    data: {
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      before: toJson(params.before),
      after: toJson(params.after),
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
    },
  });
}
