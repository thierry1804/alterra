export interface DashboardAlert {
  id: string;
  severity: "warning" | "error";
  message: string;
  link?: string;
}

export interface DashboardSummary {
  kpis: {
    activeWorkers: number;
    presenceRate: number;
    pendingPointages: number;
    pendingPaymentsCount: number;
    pendingPaymentsAmount: number;
  };
  presenceLast7Days: Array<{
    date: string;
    label: string;
    workersPresent: number;
  }>;
  workforceTrend: Array<{
    weekLabel: string;
    activeWorkers: number;
  }>;
  alerts: DashboardAlert[];
}

export function formatMga(amount: number): string {
  return `${new Intl.NumberFormat("fr-MG", { maximumFractionDigits: 0 }).format(amount)} Ar`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)} %`;
}
