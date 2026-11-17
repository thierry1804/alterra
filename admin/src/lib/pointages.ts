import type { Worker } from "./referentials";

export type PointageStatus = "PENDING" | "VALIDATED" | "REJECTED" | "NEEDS_CLARIFICATION";

export interface PointageBioCheck {
  result: string;
  performedAt: string;
}

export interface Pointage {
  id: string;
  clientUuid: string;
  workerId: string;
  subActivityId: string;
  parcelleId?: string | null;
  parcelle?: {
    id: string;
    code: string | null;
    name: string;
    kind: "PARCELLE" | "PEPINIERE";
    zone: { id: string; name: string; code: string | null };
  } | null;
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
  technicalValidatedAt?: string | null;
  rejectionReason: string | null;
  createdByClientAt: string;
  syncedAt: string;
  createdAt: string;
  updatedAt: string;
  bioCheck: PointageBioCheck | null;
  worker?: Worker;
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

export function parcelleLabel(parcelle: Pointage["parcelle"]): string {
  if (!parcelle) return "";
  const place = parcelle.kind === "PEPINIERE" ? "Pépinière" : "Parcelle";
  return `${parcelle.zone.name} · ${place} ${parcelle.code ?? parcelle.name}`;
}
