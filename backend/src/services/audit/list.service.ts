import { basePrisma } from "../../lib/prisma-base.js";
import { ApiError } from "../../middleware/error-handler.js";

export const AUDIT_SORT_FIELDS = ["createdAt", "action", "entityType", "userId", "entityId"] as const;
export type AuditSortField = (typeof AUDIT_SORT_FIELDS)[number];

export interface ListAuditLogParams {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  orderBy?: AuditSortField;
  dir?: "asc" | "desc";
}

export interface AuditLogRow {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface ListAuditLogResult {
  data: AuditLogRow[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

function parseDateBoundary(value: string, endOfDay: boolean): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(422, "INVALID_DATE", `Invalid date: ${value}`);
  }
  if (endOfDay) {
    date.setUTCHours(23, 59, 59, 999);
  } else {
    date.setUTCHours(0, 0, 0, 0);
  }
  return date;
}

export async function listAuditLogs(params: ListAuditLogParams): Promise<ListAuditLogResult> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.limit ?? 50));
  const skip = (page - 1) * pageSize;

  const where: {
    action?: string;
    entityType?: string;
    userId?: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = {};

  if (params.action) where.action = params.action;
  if (params.entityType) where.entityType = params.entityType;
  if (params.userId) where.userId = params.userId;
  if (params.dateFrom || params.dateTo) {
    where.createdAt = {};
    if (params.dateFrom) where.createdAt.gte = parseDateBoundary(params.dateFrom, false);
    if (params.dateTo) where.createdAt.lte = parseDateBoundary(params.dateTo, true);
  }

  const [rows, total] = await Promise.all([
    basePrisma.auditLog.findMany({
      where,
      orderBy: params.orderBy
        ? { [params.orderBy]: params.dir ?? "asc" }
        : { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    basePrisma.auditLog.count({ where }),
  ]);

  const userIds = [...new Set(rows.map((row) => row.userId).filter(Boolean))] as string[];
  const users =
    userIds.length > 0
      ? await basePrisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        })
      : [];
  const emailByUserId = new Map(users.map((user) => [user.id, user.email]));

  const data: AuditLogRow[] = rows.map((row) => ({
    id: row.id.toString(),
    userId: row.userId,
    userEmail: row.userId ? (emailByUserId.get(row.userId) ?? null) : null,
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    before: row.before,
    after: row.after,
    ip: row.ip,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
  }));

  return {
    data,
    page,
    pageSize,
    total,
    hasMore: skip + data.length < total,
  };
}
