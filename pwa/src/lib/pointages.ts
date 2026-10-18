import { api } from "./api";

export type PointageStatus = "PENDING" | "VALIDATED" | "REJECTED" | "NEEDS_CLARIFICATION";

export interface PointageBioCheck {
  result: string;
  performedAt: string;
}

export interface EnteredBySummary {
  firstName: string;
  lastName: string;
}

export interface Pointage {
  id: string;
  workerId: string;
  subActivityId: string;
  quantity: string;
  amount: string;
  date: string;
  status: PointageStatus;
  rejectionReason: string | null;
  validatedAt: string | null;
  bioCheck: PointageBioCheck | null;
  enteredById: string;
  enteredBy: EnteredBySummary | null;
  createdByClientAt: string;
  photoKey: string | null;
}

export interface WorkerSummary {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string;
  teamId: string | null;
}

export interface ActivitySummary {
  id: string;
  label: string;
  unit: string;
}

export function formatPointageAmount(amount: string | number): string {
  return `${Number(amount).toLocaleString("fr-MG")} Ar`;
}

export function bioResultLabel(result: string | null | undefined): string {
  switch (result) {
    case "OK":
      return "Bio OK";
    case "KO":
      return "Bio KO";
    case "DOUBT":
      return "Bio doute";
    case "UNAVAILABLE":
      return "Bio indisponible";
    default:
      return "Bio manquante";
  }
}

export function bioResultClass(result: string | null | undefined): string {
  switch (result) {
    case "OK":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "KO":
      return "border-red-200 bg-red-50 text-red-800";
    case "DOUBT":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "UNAVAILABLE":
      return "border-zinc-200 bg-zinc-100 text-zinc-700";
    default:
      return "border-zinc-200 bg-zinc-50 text-zinc-600";
  }
}

export const POINTAGE_STATUS_LABELS: Record<PointageStatus, string> = {
  PENDING: "En attente",
  VALIDATED: "Validé",
  REJECTED: "Rejeté",
  NEEDS_CLARIFICATION: "Précision requise",
};

export function pointageStatusClass(status: PointageStatus): string {
  switch (status) {
    case "VALIDATED":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "REJECTED":
      return "border-red-200 bg-red-50 text-red-700";
    case "NEEDS_CLARIFICATION":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "border-zinc-200 bg-zinc-100 text-zinc-700";
  }
}

/** Pointages saisis par l'utilisateur courant, tous statuts — pour qu'il puisse consulter l'état
 * de ses saisies (validé, rejeté, en attente) sans pouvoir les modifier (sauf rejet → rectification). */
export async function fetchMyPointages(userId: string): Promise<Pointage[]> {
  const rows: Pointage[] = [];
  let cursor: string | undefined;

  do {
    const response = await api.get<{
      data: Pointage[];
      nextCursor: string | null;
      hasMore: boolean;
    }>("/pointages", { params: { cursor, take: 100 } });
    rows.push(...response.data.data.filter((p) => p.enteredById === userId));
    cursor = response.data.hasMore ? (response.data.nextCursor ?? undefined) : undefined;
  } while (cursor);

  return rows.sort((a, b) => b.date.localeCompare(a.date));
}
