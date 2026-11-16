import type { PointageStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../middleware/error-handler.js";
import { resolvePeriod } from "../../lib/period-iso.js";
import { isoWeekOfUtcDate } from "../../lib/week-iso.js";

const MAX_WEEKS = 26;
const DEFAULT_WEEKS = 4;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface SynthesisFilters {
  weekFrom?: string;
  weekTo?: string;
  siteId?: string;
  subActivityId?: string;
}

export interface SynthesisSourceRow {
  date: Date;
  workerId: string;
  siteId: string;
  subActivityId: string;
  quantity: { toString(): string };
  amount: { toString(): string };
  status: PointageStatus;
  technicalValidatedAt: Date | null;
}

export interface SynthesisActivityInfo {
  label: string;
  categoryLabel: string;
  unit: string;
}

export interface SynthesisSiteInfo {
  code: string;
  name: string;
}

export interface SynthesisRow {
  weekIso: string;
  siteId: string;
  siteCode: string;
  siteName: string;
  subActivityId: string;
  activityLabel: string;
  categoryLabel: string;
  unit: string;
  people: number;
  quantity: number;
  cost: number;
  pointages: number;
  pendingSite: number;
  toValidate: number;
  validatedTechnical: number;
  rejected: number;
}

interface Accumulator {
  row: SynthesisRow;
  workers: Set<string>;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function aggregateSynthesis(
  rows: readonly SynthesisSourceRow[],
  activities: ReadonlyMap<string, SynthesisActivityInfo>,
  sites: ReadonlyMap<string, SynthesisSiteInfo>,
): SynthesisRow[] {
  const groups = new Map<string, Accumulator>();

  for (const source of rows) {
    const weekIso = isoWeekOfUtcDate(source.date);
    const key = `${weekIso}|${source.siteId}|${source.subActivityId}`;
    let group = groups.get(key);
    if (!group) {
      const activity = activities.get(source.subActivityId);
      const site = sites.get(source.siteId);
      group = {
        workers: new Set(),
        row: {
          weekIso,
          siteId: source.siteId,
          siteCode: site?.code ?? "",
          siteName: site?.name ?? "",
          subActivityId: source.subActivityId,
          activityLabel: activity?.label ?? "",
          categoryLabel: activity?.categoryLabel ?? "",
          unit: activity?.unit ?? "",
          people: 0,
          quantity: 0,
          cost: 0,
          pointages: 0,
          pendingSite: 0,
          toValidate: 0,
          validatedTechnical: 0,
          rejected: 0,
        },
      };
      groups.set(key, group);
    }

    const { row } = group;
    if (source.status === "REJECTED") {
      row.rejected += 1;
      continue;
    }
    group.workers.add(source.workerId);
    row.pointages += 1;
    row.quantity += Number(source.quantity.toString());
    row.cost += Number(source.amount.toString());
    if (source.status === "VALIDATED") {
      if (source.technicalValidatedAt) row.validatedTechnical += 1;
      else row.toValidate += 1;
    } else {
      row.pendingSite += 1;
    }
  }

  return [...groups.values()]
    .map(({ row, workers }) => ({
      ...row,
      people: workers.size,
      quantity: round2(row.quantity),
      cost: round2(row.cost),
    }))
    .sort(
      (a, b) =>
        b.weekIso.localeCompare(a.weekIso) ||
        a.siteName.localeCompare(b.siteName) ||
        a.activityLabel.localeCompare(b.activityLabel),
    );
}

function resolveWeeks(filters: SynthesisFilters): { weekFrom: string; weekTo: string } {
  const weekTo = filters.weekTo ?? isoWeekOfUtcDate(new Date());
  const { dateFrom: toStart } = resolvePeriod(weekTo);
  const weekFrom =
    filters.weekFrom ??
    isoWeekOfUtcDate(new Date(toStart.getTime() - (DEFAULT_WEEKS - 1) * WEEK_MS));
  const { dateFrom: fromStart } = resolvePeriod(weekFrom);

  const span = Math.round((toStart.getTime() - fromStart.getTime()) / WEEK_MS) + 1;
  if (span < 1) {
    throw new ApiError(
      422,
      "INVALID_PERIOD",
      "La semaine de début doit précéder la semaine de fin",
    );
  }
  if (span > MAX_WEEKS) {
    throw new ApiError(
      422,
      "PERIOD_TOO_LONG",
      `La période ne peut pas dépasser ${MAX_WEEKS} semaines`,
    );
  }
  return { weekFrom, weekTo };
}

export async function getPointageSynthesis(filters: SynthesisFilters) {
  const { weekFrom, weekTo } = resolveWeeks(filters);
  const { dateFrom } = resolvePeriod(weekFrom);
  const { dateTo } = resolvePeriod(weekTo);

  const pointages = await prisma.pointage.findMany({
    where: {
      date: { gte: dateFrom, lte: dateTo },
      ...(filters.siteId ? { worker: { siteId: filters.siteId } } : {}),
      ...(filters.subActivityId ? { subActivityId: filters.subActivityId } : {}),
    },
    select: {
      date: true,
      workerId: true,
      subActivityId: true,
      quantity: true,
      amount: true,
      status: true,
      technicalValidatedAt: true,
      worker: { select: { siteId: true } },
      subActivity: {
        select: {
          label: true,
          unit: { select: { label: true } },
          category: { select: { label: true } },
        },
      },
    },
  });

  const activities = new Map<string, SynthesisActivityInfo>();
  const siteIds = new Set<string>();
  const sourceRows: SynthesisSourceRow[] = pointages.map((pointage) => {
    activities.set(pointage.subActivityId, {
      label: pointage.subActivity.label,
      categoryLabel: pointage.subActivity.category.label,
      unit: pointage.subActivity.unit.label,
    });
    siteIds.add(pointage.worker.siteId);
    return {
      date: pointage.date,
      workerId: pointage.workerId,
      siteId: pointage.worker.siteId,
      subActivityId: pointage.subActivityId,
      quantity: pointage.quantity,
      amount: pointage.amount,
      status: pointage.status,
      technicalValidatedAt: pointage.technicalValidatedAt,
    };
  });

  const siteRows = await prisma.site.findMany({
    where: { id: { in: [...siteIds] } },
    select: { id: true, shortCode: true, name: true },
  });
  const sites = new Map(
    siteRows.map((site) => [site.id, { code: site.shortCode, name: site.name }]),
  );

  return { weekFrom, weekTo, rows: aggregateSynthesis(sourceRows, activities, sites) };
}
