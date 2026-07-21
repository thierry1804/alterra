export type PointageStatus = "PENDING" | "VALIDATED" | "REJECTED" | "NEEDS_CLARIFICATION";

export interface PointageBioCheck {
  result: string;
  performedAt: string;
}

export interface Pointage {
  id: string;
  workerId: string;
  activityId: string;
  quantity: string;
  amount: string;
  date: string;
  status: PointageStatus;
  rejectionReason: string | null;
  bioCheck: PointageBioCheck | null;
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
