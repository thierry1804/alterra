export type PaymentStatus = "PENDING" | "EXPORTED" | "PAID" | "FAILED";

export interface PaymentWorker {
  id: string;
  firstName: string;
  lastName: string;
  mvolaNumber: string;
  matricule: string;
}

export interface PaymentRow {
  id: string;
  workerId: string;
  worker: PaymentWorker;
  periodIso: string;
  cycle: string;
  amount: string;
  originalAmount: string | null;
  description: string;
  bioValid: boolean;
  status: PaymentStatus;
  exportedAt: string | null;
  paidAt: string | null;
  failureReason: string | null;
  correctionReason: string | null;
  createdAt: string;
}

export interface GeneratePaymentsResult {
  periodIso: string;
  weekIso: string;
  created: number;
  skippedZeroAmount: number;
  payments: Array<{
    id: string;
    workerId: string;
    amount: string;
    bioValid: boolean;
    description: string;
  }>;
}

export interface ImportMvolaResult {
  periodIso: string;
  paid: number;
  failed: number;
  skippedAlreadyFinal: number;
  unmatched: Array<{ line: number; phone: string; amount: number }>;
  duplicates: Array<{ line: number; phone: string; amount: number; paymentIds: string[] }>;
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "En attente",
  EXPORTED: "Exporté",
  PAID: "Payé",
  FAILED: "Échec",
};

export function paymentStatusVariant(
  status: PaymentStatus,
): "default" | "success" | "warning" | "danger" {
  switch (status) {
    case "PAID":
      return "success";
    case "EXPORTED":
      return "warning";
    case "FAILED":
      return "danger";
    default:
      return "default";
  }
}

export function formatPaymentAmount(amount: string | number): string {
  return `${Number(amount).toLocaleString("fr-MG")} Ar`;
}

/** ISO week input helper — e.g. 2026-W29 */
export function currentIsoWeekInput(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function periodToExportParam(periodIso: string): string {
  const match = periodIso.match(/^(\d{4})-W(\d{2})$/);
  if (match) return `S${Number(match[2])}`;
  return periodIso;
}
