import { Role, Sexe } from "@prisma/client";
import type { AppPrisma } from "../../lib/prisma.js";

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

function emptyGenderBreakdown(): GenderBreakdown {
  return { masculin: 0, feminin: 0, nonRenseigne: 0, total: 0 };
}

function addGenderCount(breakdown: GenderBreakdown, sexe: Sexe | null, count: number): void {
  if (sexe === Sexe.MASCULIN) breakdown.masculin += count;
  else if (sexe === Sexe.FEMININ) breakdown.feminin += count;
  else breakdown.nonRenseigne += count;
  breakdown.total += count;
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

export async function getDashboardSummary(
  db: Pick<AppPrisma, "worker" | "pointage" | "payment" | "user" | "team" | "site">,
  siteId?: string,
): Promise<DashboardSummary> {
  const workerWhere = {
    status: "ACTIVE" as const,
    deletedAt: null,
    ...(siteId ? { siteId } : {}),
  };

  const pointageScope = siteId ? { worker: { siteId } } : {};
  const paymentScope = siteId ? { worker: { siteId } } : {};

  const activeWorkers = await db.worker.count({ where: workerWhere });
  const weekRange = getCurrentWeekRange();

  const workersPresentThisWeek = await db.pointage.groupBy({
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

  const pendingPointages = await db.pointage.count({
    where: { status: "PENDING", ...pointageScope },
  });

  const paymentAgg = await db.payment.aggregate({
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

    const grouped = await db.pointage.groupBy({
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

    const grouped = await db.pointage.groupBy({
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

  const failedPayments = await db.payment.count({
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

  const oldPending = await db.pointage.count({
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

  const staleCds = await db.user.count({
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

  const sexeGroups = await db.worker.groupBy({ by: ["sexe"], where: workerWhere, _count: true });
  const genderBreakdown = emptyGenderBreakdown();
  for (const group of sexeGroups) addGenderCount(genderBreakdown, group.sexe, group._count);

  const teamSexeGroups = await db.worker.groupBy({
    by: ["teamId", "sexe"],
    where: workerWhere,
    _count: true,
  });
  const teamIds = [...new Set(teamSexeGroups.map((g) => g.teamId).filter((id) => id !== null))];
  const teams = await db.team.findMany({
    where: { id: { in: teamIds } },
    select: { id: true, name: true },
  });
  const teamNameById = new Map(teams.map((t) => [t.id, t.name]));
  const teamBreakdowns = new Map<string, GenderBreakdown>();
  for (const group of teamSexeGroups) {
    const key = group.teamId ?? "__sans_equipe__";
    if (!teamBreakdowns.has(key)) teamBreakdowns.set(key, emptyGenderBreakdown());
    addGenderCount(teamBreakdowns.get(key)!, group.sexe, group._count);
  }
  const genderByTeam: GenderByGroup[] = [...teamBreakdowns.entries()]
    .map(([id, breakdown]) => ({
      id,
      name: id === "__sans_equipe__" ? "Sans équipe" : (teamNameById.get(id) ?? id),
      ...breakdown,
    }))
    .sort((a, b) => b.total - a.total);

  const siteSexeGroups = await db.worker.groupBy({
    by: ["siteId", "sexe"],
    where: workerWhere,
    _count: true,
  });
  const siteIds = [...new Set(siteSexeGroups.map((g) => g.siteId))];
  const sites = await db.site.findMany({
    where: { id: { in: siteIds } },
    select: { id: true, name: true, shortCode: true },
  });
  const siteNameById = new Map(sites.map((s) => [s.id, `${s.shortCode} — ${s.name}`]));
  const siteBreakdowns = new Map<string, GenderBreakdown>();
  for (const group of siteSexeGroups) {
    if (!siteBreakdowns.has(group.siteId)) siteBreakdowns.set(group.siteId, emptyGenderBreakdown());
    addGenderCount(siteBreakdowns.get(group.siteId)!, group.sexe, group._count);
  }
  const genderBySite: GenderByGroup[] = [...siteBreakdowns.entries()]
    .map(([id, breakdown]) => ({ id, name: siteNameById.get(id) ?? id, ...breakdown }))
    .sort((a, b) => b.total - a.total);

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
    genderBreakdown,
    genderByTeam,
    genderBySite,
  };
}

export { startOfUtcDay, getCurrentWeekRange, isoWeekNumber, formatDayLabel };
