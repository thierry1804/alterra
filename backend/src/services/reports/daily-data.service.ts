import { BioResult, PointageStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { getIsoWeekString } from "../../lib/week-iso.js";
import { ApiError } from "../../middleware/error-handler.js";

export interface DailyPdfJobInput {
  siteId: string;
  date: string;
  requestedById: string;
  signatureText: string;
}

export interface DailyReportRow {
  workerName: string;
  quantity: string;
  unit: string;
  amount: string;
  bioStatus: string;
}

export interface DailyReportActivity {
  label: string;
  rows: DailyReportRow[];
}

export interface DailyReportViewModel {
  generatedAt: string;
  date: string;
  periodIso: string;
  site: { name: string; shortCode: string };
  cds: { fullName: string; signedAt: string; signatureText: string };
  summary: {
    workerCount: number;
    pointageCount: number;
    totalAmount: string;
    bioOkCount: number;
    bioPendingCount: number;
    pendingCount: number;
    needsClarificationCount: number;
    rejectedCount: number;
  };
  activities: DailyReportActivity[];
}

export interface DailyClosePreview {
  date: string;
  periodIso: string;
  validatedCount: number;
  pendingCount: number;
  needsClarificationCount: number;
  rejectedCount: number;
  totalAmount: string;
  workerCount: number;
  requiresConfirm: boolean;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDailyDate(dateStr: string): Date {
  if (!DATE_RE.test(dateStr)) {
    throw new ApiError(422, "INVALID_DATE", "date must be YYYY-MM-DD");
  }
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function dailyPeriodIsoFromDate(date: Date): string {
  const yearStart = Date.UTC(date.getUTCFullYear(), 0, 1);
  const dayOfYear = Math.floor((date.getTime() - yearStart) / 86_400_000) + 1;
  return `D${String(dayOfYear).padStart(3, "0")}`;
}

function formatAmount(value: { toString(): string }): string {
  return Number(value.toString()).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

function bioStatusLabel(result: BioResult | null | undefined): string {
  if (!result) return "En attente";
  switch (result) {
    case BioResult.OK:
      return "OK";
    case BioResult.DOUBT:
      return "Doute";
    case BioResult.KO:
      return "KO";
    case BioResult.UNAVAILABLE:
      return "Indisponible";
    default:
      return String(result);
  }
}

async function loadLatestBioByWorker(
  siteId: string,
  weekIso: string,
): Promise<Map<string, BioResult>> {
  const bioChecks = await prisma.biometricCheck.findMany({
    where: {
      weekIso,
      worker: { siteId },
    },
    orderBy: { performedAt: "desc" },
  });

  const latestBioByWorker = new Map<string, BioResult>();
  for (const check of bioChecks) {
    if (!latestBioByWorker.has(check.workerId)) {
      latestBioByWorker.set(check.workerId, check.result);
    }
  }
  return latestBioByWorker;
}

export async function getDailyClosePreview(
  siteId: string,
  dateStr: string,
): Promise<DailyClosePreview> {
  const date = parseDailyDate(dateStr);
  const periodIso = dailyPeriodIsoFromDate(date);

  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) throw new ApiError(404, "SITE_NOT_FOUND", "Site introuvable");

  const [validatedPointages, pendingCount, needsClarificationCount, rejectedCount] =
    await Promise.all([
      prisma.pointage.findMany({
        where: {
          date,
          status: PointageStatus.VALIDATED,
          worker: { siteId },
        },
        select: { workerId: true, amount: true },
      }),
      prisma.pointage.count({
        where: { date, status: PointageStatus.PENDING, worker: { siteId } },
      }),
      prisma.pointage.count({
        where: { date, status: PointageStatus.NEEDS_CLARIFICATION, worker: { siteId } },
      }),
      prisma.pointage.count({
        where: { date, status: PointageStatus.REJECTED, worker: { siteId } },
      }),
    ]);

  const totalAmount = validatedPointages.reduce(
    (sum, pointage) => sum + Number(pointage.amount.toString()),
    0,
  );
  const workerCount = new Set(validatedPointages.map((pointage) => pointage.workerId)).size;

  return {
    date: dateStr,
    periodIso,
    validatedCount: validatedPointages.length,
    pendingCount,
    needsClarificationCount,
    rejectedCount,
    totalAmount: formatAmount({ toString: () => String(totalAmount) }),
    workerCount,
    requiresConfirm: pendingCount > 0 || needsClarificationCount > 0,
  };
}

export async function buildDailyReportViewModel(
  input: DailyPdfJobInput,
): Promise<DailyReportViewModel> {
  const date = parseDailyDate(input.date);
  const periodIso = dailyPeriodIsoFromDate(date);

  const site = await prisma.site.findUnique({ where: { id: input.siteId } });
  if (!site) throw new ApiError(404, "SITE_NOT_FOUND", "Site introuvable");

  const cds = await prisma.user.findUnique({
    where: { id: input.requestedById },
    select: { firstName: true, lastName: true },
  });
  if (!cds) throw new ApiError(404, "USER_NOT_FOUND", "Utilisateur introuvable");

  const weekIso = getIsoWeekString(date);

  const latestBioByWorker = await loadLatestBioByWorker(input.siteId, weekIso);

  const [pointages, pendingCount, needsClarificationCount, rejectedCount] = await Promise.all([
    prisma.pointage.findMany({
      where: {
        date,
        status: PointageStatus.VALIDATED,
        worker: { siteId: input.siteId },
      },
      include: { worker: true, activity: true },
      orderBy: [{ activity: { label: "asc" } }, { worker: { lastName: "asc" } }],
    }),
    prisma.pointage.count({
      where: { date, status: PointageStatus.PENDING, worker: { siteId: input.siteId } },
    }),
    prisma.pointage.count({
      where: {
        date,
        status: PointageStatus.NEEDS_CLARIFICATION,
        worker: { siteId: input.siteId },
      },
    }),
    prisma.pointage.count({
      where: { date, status: PointageStatus.REJECTED, worker: { siteId: input.siteId } },
    }),
  ]);

  const activityMap = new Map<string, DailyReportRow[]>();
  const workerIds = new Set<string>();
  let totalAmount = 0;

  for (const pointage of pointages) {
    workerIds.add(pointage.workerId);
    totalAmount += Number(pointage.amount.toString());

    const label = pointage.activity.label;
    if (!activityMap.has(label)) activityMap.set(label, []);
    activityMap.get(label)!.push({
      workerName: `${pointage.worker.lastName} ${pointage.worker.firstName}`,
      quantity: pointage.quantity.toString(),
      unit: pointage.activity.unit,
      amount: formatAmount(pointage.amount),
      bioStatus: bioStatusLabel(latestBioByWorker.get(pointage.workerId)),
    });
  }

  let bioOkCount = 0;
  let bioPendingCount = 0;
  for (const workerId of workerIds) {
    if (latestBioByWorker.get(workerId) === BioResult.OK) bioOkCount++;
    else bioPendingCount++;
  }

  const signedAt = new Date().toISOString();

  return {
    generatedAt: new Date(signedAt).toLocaleString("fr-FR"),
    date: input.date,
    periodIso,
    site: { name: site.name, shortCode: site.shortCode },
    cds: {
      fullName: `${cds.lastName} ${cds.firstName}`,
      signedAt: new Date(signedAt).toLocaleString("fr-FR"),
      signatureText: input.signatureText.trim(),
    },
    summary: {
      workerCount: workerIds.size,
      pointageCount: pointages.length,
      totalAmount: formatAmount({ toString: () => String(totalAmount) }),
      bioOkCount,
      bioPendingCount,
      pendingCount,
      needsClarificationCount,
      rejectedCount,
    },
    activities: [...activityMap.entries()].map(([label, rows]) => ({ label, rows })),
  };
}
