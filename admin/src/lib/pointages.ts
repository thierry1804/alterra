export type PointageStatus = "PENDING" | "VALIDATED" | "REJECTED" | "NEEDS_CLARIFICATION";

export interface PointageBioCheck {
  result: string;
  performedAt: string;
}

export interface Pointage {
  id: string;
  clientUuid: string;
  workerId: string;
  activityId: string;
  quantity: string;
  unitRateSnapshot: string;
  amount: string;
  date: string;
  geoLat: number | null;
  geoLng: number | null;
  photoKey: string | null;
  notes: string | null;
  status: PointageStatus;
  enteredById: string;
  validatedById: string | null;
  validatedAt: string | null;
  rejectionReason: string | null;
  createdByClientAt: string;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
  bioCheck: PointageBioCheck | null;
}

export const POINTAGE_STATUS_LABELS: Record<PointageStatus, string> = {
  PENDING: "En attente",
  VALIDATED: "Validé",
  REJECTED: "Rejeté",
  NEEDS_CLARIFICATION: "Précision requise",
};

export function pointageStatusVariant(
  status: PointageStatus,
): "default" | "success" | "warning" | "danger" {
  switch (status) {
    case "VALIDATED":
      return "success";
    case "REJECTED":
      return "danger";
    case "NEEDS_CLARIFICATION":
      return "warning";
    default:
      return "default";
  }
}

export function formatPointageAmount(amount: string | number): string {
  return `${Number(amount).toLocaleString("fr-MG")} Ar`;
}
