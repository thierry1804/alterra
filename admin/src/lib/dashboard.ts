export interface DashboardAlert {
  id: string;
  severity: "warning" | "error";
  message: string;
  link?: string;
}

export interface GenderBreakdown {
  masculin: number;
  feminin: number;
  nonRenseigne: number;
  total: number;
}

export interface GenderByGroup extends GenderBreakdown {
  id: string;
  name: string;
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
  genderBreakdown: GenderBreakdown;
  genderByTeam: GenderByGroup[];
  genderBySite: GenderByGroup[];
}

export function formatMga(amount: number): string {
  return `${new Intl.NumberFormat("fr-MG", { maximumFractionDigits: 0 }).format(amount)} Ar`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)} %`;
}

export interface SiteCost {
  siteId: string;
  name: string;
  shortCode: string;
  netPaid: number;
  netToExport: number;
  netAwaitingReturn: number;
  registeredWorkers: number;
  activeWorkers: number;
}

export interface ActivityCost {
  categoryId: string;
  code: string;
  label: string;
  netPaid: number;
  workerCount: number;
}

export interface CostsSummary {
  period: { fromWeek: string; toWeek: string; campaignStart: string | null };
  totals: {
    netPaid: number;
    netToExport: number;
    netAwaitingReturn: number;
    registeredWorkers: number;
    activeWorkers: number;
  };
  bySite: SiteCost[];
  byActivity: ActivityCost[];
  categories: Array<{ id: string; code: string; label: string }>;
}

function isoWeekOf(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function weekIsoOf(date: Date): string {
  const { year, week } = isoWeekOf(date);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function weekOptions(
  startIsoDate: string | null,
  end = new Date(),
): Array<{ value: string; label: string }> {
  const first = startIsoDate ? new Date(`${startIsoDate}T00:00:00.000Z`) : end;
  const cursor = new Date(first);
  cursor.setUTCDate(cursor.getUTCDate() - ((cursor.getUTCDay() || 7) - 1));
  const options: Array<{ value: string; label: string }> = [];
  while (cursor <= end) {
    const { week } = isoWeekOf(cursor);
    options.push({
      value: weekIsoOf(cursor),
      label: `S${week} · ${cursor.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}`,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return options;
}
