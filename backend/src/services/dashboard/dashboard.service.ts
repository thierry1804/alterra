import { Role } from "@prisma/client";

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getCurrentWeekRange(reference = new Date()): { from: Date; to: Date } {
  const day = startOfUtcDay(reference);
  const weekday = day.getUTCDay() || 7;
  const from = new Date(day);
  from.setUTCDate(day.getUTCDate() - (weekday - 1));
  const to = new Date(from);
  to.setUTCDate(from.getUTCDate() + 6);
  return { from, to };
}

function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", timeZone: "UTC" });
}

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

export async function getDashboardSummary(
  prisma: {
    worker: { count: (args: unknown) => Promise<number> };
    pointage: {
      count: (args: unknown) => Promise<number>;
      groupBy: (args: unknown) => Promise<Array<{ workerId: string }>>;
    };
    payment: {
      aggregate: (args: unknown) => Promise<{ _sum: { amount: unknown }; _count: number }>;
      count: (args: unknown) => Promise<number>;
    };
    user: { count: (args: unknown) => Promise<number> };
  },
  siteId?: string,
): Promise<DashboardSummary> {
  const workerWhere = {
    status: "ACTIVE" as const,
    deletedAt: null,
    ...(siteId ? { siteId } : {}),
  };

  const pointageScope = siteId ? { worker: { siteId } } : {};
  const paymentScope = siteId ? { worker: { siteId } } : {};

  const activeWorkers = await prisma.worker.count({ where: workerWhere });
  const weekRange = getCurrentWeekRange();

  const workersPresentThisWeek = await prisma.pointage.groupBy({
    by: ["workerId"],
    where: {
      status: "VALIDATED",
      date: { gte: weekRange.from, lte: weekRange.to },
      ...pointageScope,
    },
  });

  const presenceRate =
    activeWorkers === 0
      ? 0
      : Math.round((workersPresentThisWeek.length / activeWorkers) * 1000) / 10;

  const pendingPointages = await prisma.pointage.count({
    where: { status: "PENDING", ...pointageScope },
  });

  const paymentAgg = await prisma.payment.aggregate({
    where: { status: "PENDING", ...paymentScope },
    _sum: { amount: true },
    _count: true,
  });

  const pendingPaymentsAmount = Number(paymentAgg._sum.amount ?? 0);
  const pendingPaymentsCount = paymentAgg._count;

  const today = startOfUtcDay(new Date());
  const presenceLast7Days: DashboardSummary["presenceLast7Days"] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setUTCDate(today.getUTCDate() - offset);
    const nextDay = new Date(day);
    nextDay.setUTCDate(day.getUTCDate() + 1);

    const grouped = await prisma.pointage.groupBy({
      by: ["workerId"],
      where: {
        status: "VALIDATED",
        date: { gte: day, lt: nextDay },
        ...pointageScope,
      },
    });

    presenceLast7Days.push({
      date: day.toISOString().slice(0, 10),
      label: formatDayLabel(day),
      workersPresent: grouped.length,
    });
  }

  const workforceTrend: DashboardSummary["workforceTrend"] = [];
  for (let offset = 7; offset >= 0; offset -= 1) {
    const ref = new Date(today);
    ref.setUTCDate(today.getUTCDate() - offset * 7);
    const { from, to } = getCurrentWeekRange(ref);

    const grouped = await prisma.pointage.groupBy({
      by: ["workerId"],
      where: {
        status: "VALIDATED",
        date: { gte: from, lte: to },
        ...pointageScope,
      },
    });

    workforceTrend.push({
      weekLabel: `S${isoWeekNumber(from)}`,
      activeWorkers: grouped.length,
    });
  }

  const alerts: DashboardAlert[] = [];
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setUTCDate(today.getUTCDate() - 7);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const failedPayments = await prisma.payment.count({
    where: { status: "FAILED", ...paymentScope },
  });
  if (failedPayments > 0) {
    alerts.push({
      id: "failed-payments",
      severity: "error",
      message: `${failedPayments} paiement(s) en échec MVola`,
      link: "/payments",
    });
  }

  const oldPending = await prisma.pointage.count({
    where: {
      status: "PENDING",
      date: { lt: sevenDaysAgo },
      ...pointageScope,
    },
  });
  if (oldPending > 0) {
    alerts.push({
      id: "old-pending-pointages",
      severity: "warning",
      message: `${oldPending} pointage(s) en attente depuis plus de 7 jours`,
      link: "/pointages",
    });
  }

  const staleCds = await prisma.user.count({
    where: {
      role: Role.CHEF_SERVICE,
      active: true,
      OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: twentyFourHoursAgo } }],
      ...(siteId ? { siteId } : {}),
    },
  });
  if (staleCds > 0) {
    alerts.push({
      id: "stale-cds-sync",
      severity: "warning",
      message: `${staleCds} chef(s) de service sans connexion depuis 24 h`,
    });
  }

  if (pendingPointages > 10) {
    alerts.push({
      id: "high-pending-pointages",
      severity: "warning",
      message: `${pendingPointages} pointages en attente de validation`,
      link: "/pointages",
    });
  }

  return {
    kpis: {
      activeWorkers,
      presenceRate,
      pendingPointages,
      pendingPaymentsCount,
      pendingPaymentsAmount,
    },
    presenceLast7Days,
    workforceTrend,
    alerts,
  };
}

export { startOfUtcDay, getCurrentWeekRange, isoWeekNumber, formatDayLabel };
