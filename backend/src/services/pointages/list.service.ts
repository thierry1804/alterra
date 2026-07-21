import { PointageStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { getIsoWeekString } from "../../lib/week-iso.js";

export interface ListPointagesFilters {
  cursor?: string;
  status?: PointageStatus;
  workerId?: string;
  activityId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface PointageBioCheckSummary {
  result: string;
  performedAt: Date;
}

export interface PointageListItem {
  id: string;
  clientUuid: string;
  workerId: string;
  activityId: string;
  quantity: Prisma.Decimal;
  unitRateSnapshot: Prisma.Decimal;
  amount: Prisma.Decimal;
  date: Date;
  parcelleId: string | null;
  geoLat: number | null;
  geoLng: number | null;
  photoKey: string | null;
  notes: string | null;
  status: PointageStatus;
  enteredById: string;
  validatedById: string | null;
  validatedAt: Date | null;
  rejectionReason: string | null;
  bioCheckId: string | null;
  createdByClientAt: Date;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  bioCheck: PointageBioCheckSummary | null;
}

function buildWhere(filters: ListPointagesFilters): Prisma.PointageWhereInput {
  const where: Prisma.PointageWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.workerId) where.workerId = filters.workerId;
  if (filters.activityId) where.activityId = filters.activityId;
  if (filters.dateFrom || filters.dateTo) {
    where.date = {};
    if (filters.dateFrom) where.date.gte = filters.dateFrom;
    if (filters.dateTo) where.date.lte = filters.dateTo;
  }
  return where;
}

async function fetchLatestBioChecksByWorkerWeek(
  pairs: Array<{ workerId: string; weekIso: string }>,
): Promise<Map<string, PointageBioCheckSummary>> {
  const map = new Map<string, PointageBioCheckSummary>();
  if (pairs.length === 0) return map;

  const checks = await prisma.biometricCheck.findMany({
    where: { OR: pairs.map(({ workerId, weekIso }) => ({ workerId, weekIso })) },
    orderBy: { performedAt: "desc" },
    select: { workerId: true, weekIso: true, result: true, performedAt: true },
  });

  for (const check of checks) {
    if (!check.weekIso) continue;
    const key = `${check.workerId}:${check.weekIso}`;
    if (!map.has(key)) {
      map.set(key, { result: check.result, performedAt: check.performedAt });
    }
  }

  return map;
}

export async function listPointages(filters: ListPointagesFilters) {
  const take = 50;
  const where = buildWhere(filters);

  const pointages = await prisma.pointage.findMany({
    where,
    take: take + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    orderBy: { createdAt: "desc" },
  });

  const hasMore = pointages.length > take;
  const page = hasMore ? pointages.slice(0, take) : pointages;

  const workerWeekPairs = page.map((p) => ({
    workerId: p.workerId,
    weekIso: getIsoWeekString(p.date),
  }));
  const uniquePairs = [
    ...new Map(workerWeekPairs.map((pair) => [`${pair.workerId}:${pair.weekIso}`, pair])).values(),
  ];
  const bioByKey = await fetchLatestBioChecksByWorkerWeek(uniquePairs);

  const data: PointageListItem[] = page.map((pointage) => {
    const weekIso = getIsoWeekString(pointage.date);
    const bioCheck = bioByKey.get(`${pointage.workerId}:${weekIso}`) ?? null;
    return { ...pointage, bioCheck };
  });

  return {
    data,
    nextCursor: hasMore ? data[data.length - 1]?.id ?? null : null,
    hasMore,
  };
}
