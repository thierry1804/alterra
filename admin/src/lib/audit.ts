export interface AuditLogEntry {
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

export interface AuditLogResponse {
  data: AuditLogEntry[];
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

export const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "EXPORT",
  "IMPORT",
  "VALIDATE",
  "REJECT",
  "CORRECT",
] as const;

export const AUDIT_ENTITY_TYPES = [
  "Worker",
  "Pointage",
  "Payment",
  "Site",
  "Activity",
  "User",
] as const;

export function formatAuditDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

export function auditActorLabel(entry: AuditLogEntry): string {
  return entry.userEmail ?? entry.userId ?? "Système";
}
