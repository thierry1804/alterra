export type ReportType = "pointages" | "payments" | "presence-by-site";

export type ReportExportFormat = "csv" | "xlsx" | "pdf";

export interface ReportMeta {
  type: ReportType;
  title: string;
  dateFrom: string;
  dateTo: string;
  siteId: string | null;
  rowCount: number;
}

export interface ReportPreview {
  meta: ReportMeta;
  columns: string[];
  rows: Record<string, string | number | null>[];
}

export const REPORT_DEFINITIONS: Array<{
  type: ReportType;
  title: string;
  description: string;
}> = [
  {
    type: "pointages",
    title: "Pointages mensuels",
    description: "Détail des pointages validés par MOC, activité et montant.",
  },
  {
    type: "payments",
    title: "Paiements mensuels",
    description: "Lignes de bordereau générées sur la période, statuts et bio.",
  },
  {
    type: "presence-by-site",
    title: "Présence par site",
    description: "Synthèse par site : effectif, taux de présence, montants.",
  },
];

export const REPORT_COLUMN_LABELS: Record<string, string> = {
  date: "Date",
  site: "Site",
  siteName: "Nom site",
  matricule: "Matricule",
  worker: "MOC",
  activity: "Activité",
  quantity: "Quantité",
  amount: "Montant",
  status: "Statut",
  period: "Période",
  bioValid: "Bio",
  paidAt: "Payé le",
  activeWorkers: "Effectif actif",
  workersPresent: "MOC présents",
  presenceRate: "Taux présence %",
  validatedPointages: "Pointages validés",
  validatedAmount: "Montant validé",
  paidAmount: "Montant payé",
};

export function currentMonthInput(): string {
  const now = new Date();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${now.getUTCFullYear()}-${month}`;
}

export function formatReportCell(column: string, value: string | number | null): string {
  if (value === null || value === undefined) return "—";
  if (column === "amount" || column === "validatedAmount" || column === "paidAmount") {
    return `${Number(value).toLocaleString("fr-MG")} Ar`;
  }
  if (column === "presenceRate") {
    return `${value} %`;
  }
  return String(value);
}
