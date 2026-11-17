import { Prisma } from "@prisma/client";
import type { AppPrisma } from "../../lib/prisma.js";
import { isiLineKey, lineIsi } from "../../lib/isi.js";
import { resolvePeriod } from "../../lib/period-iso.js";
import { isoWeekOfUtcDate } from "../../lib/week-iso.js";

type CostsDb = Pick<AppPrisma, "worker" | "pointage" | "payment" | "site" | "activityCategory">;

export interface CostsFilters {
  fromWeek?: string;
  toWeek?: string;
  siteId?: string;
  categoryId?: string;
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

function toNumber(value: Prisma.Decimal.Value | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value.toString());
}

function addTo(map: Map<string, number>, key: string, value: number): void {
  map.set(key, (map.get(key) ?? 0) + value);
}

function weekBounds(weekIso: string): { from: Date; to: Date } {
  const period = resolvePeriod(weekIso);
  return { from: period.dateFrom, to: period.dateTo };
}

export async function getCostsSummary(db: CostsDb, filters: CostsFilters): Promise<CostsSummary> {
  const earliest = await db.pointage.aggregate({
    where: { status: { not: "REJECTED" } },
    _min: { date: true },
  });
  const campaignStart = earliest._min.date ?? null;

  const currentWeek = isoWeekOfUtcDate(new Date());
  const fromWeek =
    filters.fromWeek ?? (campaignStart ? isoWeekOfUtcDate(campaignStart) : currentWeek);
  const toWeek = filters.toWeek ?? currentWeek;
  const rangeFrom = weekBounds(fromWeek).from;
  const rangeTo = weekBounds(toWeek).to;

  const siteWorker = filters.siteId ? { siteId: filters.siteId } : {};

  const payments = await db.payment.findMany({
    where: {
      bordereauId: { not: null },
      bordereauRef: { status: { not: "SUPERSEDED" } },
      status: { not: "FAILED" },
      worker: { deletedAt: null, ...siteWorker },
    },
    select: {
      workerId: true,
      bordereauId: true,
      netAmount: true,
      status: true,
      worker: { select: { siteId: true } },
      bordereauRef: {
        select: { status: true, periodIso: true, referenceYear: true },
      },
    },
  });

  const inRange = payments.filter((payment) => {
    const ref = payment.bordereauRef;
    if (!ref) return false;
    const period = resolvePeriod(ref.periodIso, undefined, ref.referenceYear);
    return period.dateTo >= rangeFrom && period.dateFrom <= rangeTo;
  });

  const paidKeys = new Set<string>();
  const paidBordereauIds = new Set<string>();
  const netPaidBySite = new Map<string, number>();
  const netToExportBySite = new Map<string, number>();
  const netAwaitingBySite = new Map<string, number>();

  for (const payment of inRange) {
    const net = toNumber(payment.netAmount);
    const siteId = payment.worker.siteId;
    if (payment.status === "PAID") {
      addTo(netPaidBySite, siteId, net);
      paidKeys.add(`${payment.bordereauId}|${payment.workerId}`);
      paidBordereauIds.add(payment.bordereauId!);
    } else if (payment.status === "EXPORTED") {
      addTo(netAwaitingBySite, siteId, net);
    } else if (payment.bordereauRef?.status === "DG_VALIDATED") {
      addTo(netToExportBySite, siteId, net);
    }
  }

  const byActivityMap = new Map<string, ActivityCost & { workers: Set<string> }>();
  const categoryPaidBySite = new Map<string, number>();

  if (paidBordereauIds.size > 0) {
    const pointages = await db.pointage.findMany({
      where: {
        bordereauId: { in: [...paidBordereauIds] },
        status: { not: "REJECTED" },
        ...(filters.categoryId ? { subActivity: { categoryId: filters.categoryId } } : {}),
      },
      select: {
        workerId: true,
        subActivityId: true,
        unitRateSnapshot: true,
        amount: true,
        bordereauId: true,
        worker: { select: { siteId: true } },
        bordereau: { select: { isiRate: true, isiRounding: true } },
        subActivity: { select: { category: { select: { id: true, code: true, label: true } } } },
      },
    });

    const lines = new Map<
      string,
      {
        amount: Prisma.Decimal;
        siteId: string;
        workerId: string;
        category: { id: string; code: string; label: string };
        isi: { rate: Prisma.Decimal; rounding: "UNIT" | "NONE" };
      }
    >();

    for (const pointage of pointages) {
      if (!pointage.bordereauId || !pointage.bordereau) continue;
      if (!paidKeys.has(`${pointage.bordereauId}|${pointage.workerId}`)) continue;
      const key = `${pointage.bordereauId}|${isiLineKey(pointage)}|${pointage.subActivity.category.id}`;
      const existing = lines.get(key);
      if (existing) {
        existing.amount = existing.amount.add(pointage.amount);
      } else {
        lines.set(key, {
          amount: new Prisma.Decimal(pointage.amount),
          siteId: pointage.worker.siteId,
          workerId: pointage.workerId,
          category: pointage.subActivity.category,
          isi: {
            rate: new Prisma.Decimal(pointage.bordereau.isiRate),
            rounding: pointage.bordereau.isiRounding,
          },
        });
      }
    }

    for (const line of lines.values()) {
      const net = toNumber(line.amount.sub(lineIsi(line.amount, line.isi)));
      const entry = byActivityMap.get(line.category.id) ?? {
        categoryId: line.category.id,
        code: line.category.code,
        label: line.category.label,
        netPaid: 0,
        workerCount: 0,
        workers: new Set<string>(),
      };
      entry.netPaid += net;
      entry.workers.add(line.workerId);
      byActivityMap.set(line.category.id, entry);
      addTo(categoryPaidBySite, line.siteId, net);
    }
  }

  const activeRows = campaignStart
    ? await db.pointage.findMany({
        where: {
          status: { not: "REJECTED" },
          date: { gte: campaignStart },
          worker: { deletedAt: null, ...siteWorker },
        },
        distinct: ["workerId"],
        select: { workerId: true, worker: { select: { siteId: true } } },
      })
    : [];
  const activeBySite = new Map<string, number>();
  for (const row of activeRows) addTo(activeBySite, row.worker.siteId, 1);

  const registered = await db.worker.groupBy({
    by: ["siteId"],
    where: { deletedAt: null, ...siteWorker },
    _count: { _all: true },
  });
  const registeredBySite = new Map(registered.map((row) => [row.siteId, row._count._all]));

  const sites = await db.site.findMany({
    where: filters.siteId ? { id: filters.siteId } : {},
    select: { id: true, name: true, shortCode: true },
    orderBy: { shortCode: "asc" },
  });

  const paidSource = filters.categoryId ? categoryPaidBySite : netPaidBySite;
  const bySite: SiteCost[] = sites.map((site) => ({
    siteId: site.id,
    name: site.name,
    shortCode: site.shortCode,
    netPaid: paidSource.get(site.id) ?? 0,
    netToExport: filters.categoryId ? 0 : (netToExportBySite.get(site.id) ?? 0),
    netAwaitingReturn: filters.categoryId ? 0 : (netAwaitingBySite.get(site.id) ?? 0),
    registeredWorkers: registeredBySite.get(site.id) ?? 0,
    activeWorkers: activeBySite.get(site.id) ?? 0,
  }));

  const categories = await db.activityCategory.findMany({
    where: { active: true },
    select: { id: true, code: true, label: true },
    orderBy: { code: "asc" },
  });

  const total = (pick: (row: SiteCost) => number) =>
    bySite.reduce((sum, row) => sum + pick(row), 0);

  return {
    period: {
      fromWeek,
      toWeek,
      campaignStart: campaignStart ? campaignStart.toISOString().slice(0, 10) : null,
    },
    totals: {
      netPaid: total((row) => row.netPaid),
      netToExport: total((row) => row.netToExport),
      netAwaitingReturn: total((row) => row.netAwaitingReturn),
      registeredWorkers: total((row) => row.registeredWorkers),
      activeWorkers: total((row) => row.activeWorkers),
    },
    bySite,
    categories,
    byActivity: [...byActivityMap.values()]
      .map(({ workers, ...rest }) => ({ ...rest, workerCount: workers.size }))
      .sort((a, b) => b.netPaid - a.netPaid),
  };
}
