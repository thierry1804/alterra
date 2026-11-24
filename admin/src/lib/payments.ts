import { formatAr } from "./money";
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
  isiAmount: string;
  netAmount: string;
  bordereauStatus: BordereauStatus | null;
  adjustments: Array<{ id: string; amount: string; reason: string }>;
  originalAmount: string | null;
  description: string;
  bioValid: boolean;
  status: PaymentStatus;
  exportedAt: string | null;
  paidAt: string | null;
  failureReason: string | null;
  reconciliationStatus: ReconciliationStatus | null;
  mvolaReference: string | null;
  transferFee: string | null;
  correctionReason: string | null;
  createdAt: string;
}

export type ReconciliationStatus = "CONFIRME" | "ECART_MONTANT" | "ORPHELIN" | "NON_CONFIRME";

export const RECONCILIATION_LABELS: Record<ReconciliationStatus, string> = {
  CONFIRME: "Confirmé par MVola",
  ECART_MONTANT: "Écart de montant",
  ORPHELIN: "Orphelin",
  NON_CONFIRME: "Non confirmé",
};

export interface MvolaExportEntry {
  id: string;
  createdAt: string;
  userEmail: string | null;
  periodIso: string | null;
  referenceYear: number | null;
  version: number;
  isCurrent: boolean;
  exportedCount: number | null;
  filename: string | null;
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
  confirme: number;
  ecartMontant: number;
  orphelin: number;
  nonConfirme: number;
  dejaTraite: number;
  fraisRattaches: number;
  internal: number;
  ignored: number;
  confirmes: Array<{ paymentId: string; worker: string; reference: string; montant: string }>;
  ecarts: Array<{
    paymentId: string;
    worker: string;
    reference: string;
    montantReleve: number;
    montantAttendu: string;
  }>;
  orphelins: Array<{ reference: string; description: string | null; montant: number }>;
  nonConfirmes: Array<{
    paymentId: string;
    worker: string;
    periodIso: string;
    bordereau: number;
    montant: string;
  }>;
  dejaTraites: Array<{ paymentId: string; reference: string }>;
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
  return formatAr(amount);
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

export type BordereauStatus =
  "GENERATED" | "FINANCE_VALIDATED" | "DG_VALIDATED" | "EXPORTED" | "SUPERSEDED";

export const BORDEREAU_STATUS_LABELS: Record<BordereauStatus, string> = {
  GENERATED: "À valider (finance)",
  FINANCE_VALIDATED: "À valider (DG)",
  DG_VALIDATED: "Validé",
  EXPORTED: "Exporté",
  SUPERSEDED: "Remplacé",
};

export function bordereauStatusVariant(status: BordereauStatus): "default" | "success" | "info" {
  if (status === "EXPORTED" || status === "DG_VALIDATED") return "success";
  if (status === "FINANCE_VALIDATED") return "info";
  return "default";
}

export interface BordereauRow {
  id: string;
  siteId: string;
  siteName: string;
  siteCode: string;
  periodIso: string;
  referenceYear: number;
  number: number;
  version: number;
  status: BordereauStatus;
  createdAt: string;
  paymentCount: number;
  totalAmount: string;
  financeValidatedAt: string | null;
  dgValidatedAt: string | null;
  returnReason: string | null;
}

export interface GenerateBordereauxResult {
  created: number;
  bordereaux: Array<{
    siteCode: string;
    number: number;
    version: number;
    created: number;
    droppedAdjustments: number;
  }>;
  skippedSites: Array<{ siteCode: string; code: string; message: string }>;
}

export interface BordereauLine {
  paymentId?: string;
  adjustments?: Array<{ id: string; amount: string; reason: string }>;
  isiAmount?: string;
  netAmount?: string;
  matricule: string;
  workerName: string;
  mvolaNumber: string;
  amount: string;
  description: string;
  bioValid: boolean;
}

export interface BordereauVersion {
  id: string;
  version: number;
  status: BordereauStatus;
  createdAt: string;
  createdBy: string | null;
  supersededAt: string | null;
  financeValidatedAt: string | null;
  financeValidatedBy: string | null;
  dgValidatedAt: string | null;
  dgValidatedBy: string | null;
  returnReason: string | null;
  returnedAt: string | null;
  returnedBy: string | null;
}

export interface BordereauDetail {
  id: string;
  siteId: string;
  siteName: string;
  siteCode: string;
  periodIso: string;
  referenceYear: number;
  number: number;
  version: number;
  status: BordereauStatus;
  lines: BordereauLine[];
  totals: { gross: string; isi: string; net: string; isiRate: string };
  versions: BordereauVersion[];
}

export interface ExportQueueRow {
  id: string;
  siteId: string;
  siteName: string;
  siteCode: string;
  periodIso: string;
  referenceYear: number;
  number: number;
  version: number;
  status: BordereauStatus;
  exportedAt: string | null;
  paymentCount: number;
  totalNet: string;
  invoiceNet: string | null;
  blockedLines: Array<{ matricule: string; reason: string }>;
  batches: Array<{ id: string; version: number; filename: string; createdAt: string }>;
}
