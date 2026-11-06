export interface InvoiceRow {
  id: string;
  number: number | null;
  periodIso: string;
  referenceYear: number | null;
  activityLabel: string;
  siteLabel: string;
  workerCount: number;
  unitRate: string;
  totalAmount: string;
  createdAt: string;
}

export function formatInvoiceAmount(amount: string | number): string {
  return `${Number(amount).toLocaleString("fr-MG")} Ar`;
}
