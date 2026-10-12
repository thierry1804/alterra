import { BioResult, PointageStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolvePeriod } from "../../lib/period-iso.js";
import { ApiError } from "../../middleware/error-handler.js";

export interface WeeklyPdfJobInput {
  siteId: string;
  weekIso: string;
  requestedById: string;
}

export interface WeeklyReportRow {
  workerName: string;
  quantity: string;
  unit: string;
  amount: string;
  bioStatus: string;
}

export interface WeeklyReportActivity {
  label: string;
  rows: WeeklyReportRow[];
}

export interface WeeklyReportDay {
  date: string;
  activities: WeeklyReportActivity[];
}

export interface WeeklyPaymentRow {
  workerName: string;
  mvolaNumber: string;
  amount: string;
  bioValid: string;
  description: string;
}

export interface WeeklyInvoiceLine {
  workerName: string;
  subActivityLabel: string;
  quantity: string;
  unit: string;
  unitRate: string;
  amount: string;
}

export interface WeeklyInvoiceActivity {
  code: string;
  label: string;
  workerCount: number;
  lines: WeeklyInvoiceLine[];
  subtotal: string;
}

export interface WeeklyReportViewModel {
  generatedAt: string;
  weekIso: string;
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  site: { name: string; shortCode: string };
  cds: { fullName: string; signedAt: string };
  summary: {
    workerCount: number;
    pointageCount: number;
    totalAmount: string;
    bioOkCount: number;
    bioPendingCount: number;
    paymentCount: number;
  };
  byDay: WeeklyReportDay[];
  invoiceActivities: WeeklyInvoiceActivity[];
  payments: WeeklyPaymentRow[];
}

function formatDateFr(date: Date): string {
  return date.toISOString().slice(0, 10);
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

interface InvoicePointage {
  workerId: string;
  subActivityId: string;
  quantity: { toString(): string };
  unitRateSnapshot: { toString(): string };
  amount: { toString(): string };
  worker: { firstName: string; lastName: string };
  subActivity: {
    label: string;
    unit: { label: string };
    category: { code: string; label: string };
  };
}

export function buildInvoiceActivities(pointages: InvoicePointage[]): WeeklyInvoiceActivity[] {
  const categories = new Map<
    string,
    {
      label: string;
      workerIds: Set<string>;
      subtotal: number;
      lines: Map<
        string,
        {
          workerName: string;
          subActivityLabel: string;
          unit: string;
          unitRate: number;
          quantity: number;
          amount: number;
        }
      >;
    }
  >();

  for (const pointage of pointages) {
    const { code, label } = pointage.subActivity.category;
    if (!categories.has(code)) {
      categories.set(code, { label, workerIds: new Set(), subtotal: 0, lines: new Map() });
    }
    const category = categories.get(code)!;
    const unitRate = Number(pointage.unitRateSnapshot.toString());
    const quantity = Number(pointage.quantity.toString());
    const amount = Number(pointage.amount.toString());
    const lineKey = `${pointage.workerId}|${pointage.subActivityId}|${unitRate}`;

    category.workerIds.add(pointage.workerId);
    category.subtotal += amount;

    const line = category.lines.get(lineKey);
    if (line) {
      line.quantity += quantity;
      line.amount += amount;
    } else {
      category.lines.set(lineKey, {
        workerName: `${pointage.worker.lastName} ${pointage.worker.firstName}`,
        subActivityLabel: pointage.subActivity.label,
        unit: pointage.subActivity.unit.label,
        unitRate,
        quantity,
        amount,
      });
    }
  }

  return [...categories.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, category]) => ({
      code,
      label: category.label,
      workerCount: category.workerIds.size,
      subtotal: formatAmount({ toString: () => String(category.subtotal) }),
      lines: [...category.lines.values()]
        .sort(
          (a, b) =>
            a.subActivityLabel.localeCompare(b.subActivityLabel) ||
            a.workerName.localeCompare(b.workerName),
        )
        .map((line) => ({
          workerName: line.workerName,
          subActivityLabel: line.subActivityLabel,
          quantity: line.quantity.toLocaleString("fr-FR", { maximumFractionDigits: 2 }),
          unit: line.unit,
          unitRate: formatAmount({ toString: () => String(line.unitRate) }),
          amount: formatAmount({ toString: () => String(line.amount) }),
        })),
    }));
}

export async function buildWeeklyReportViewModel(
  input: WeeklyPdfJobInput,
): Promise<WeeklyReportViewModel> {
  const period = resolvePeriod(input.weekIso);
  const site = await prisma.site.findUnique({ where: { id: input.siteId } });
  if (!site) {
    throw new ApiError(404, "SITE_NOT_FOUND", "Site not found");
  }

  const cds = await prisma.user.findUnique({
    where: { id: input.requestedById },
    select: { firstName: true, lastName: true },
  });
  if (!cds) {
    throw new ApiError(404, "USER_NOT_FOUND", "Requesting user not found");
  }

  const pointages = await prisma.pointage.findMany({
    where: {
      status: PointageStatus.VALIDATED,
      date: { gte: period.dateFrom, lte: period.dateTo },
      worker: { siteId: input.siteId },
    },
    include: {
      worker: true,
      subActivity: { include: { unit: true, category: true } },
    },
    orderBy: [{ date: "asc" }, { worker: { lastName: "asc" } }],
  });

  const bioChecks = await prisma.biometricCheck.findMany({
    where: {
      weekIso: period.weekIso,
      worker: { siteId: input.siteId },
    },
    orderBy: { performedAt: "desc" },
  });

  const latestBioByWorker = new Map<string, BioResult>();
  for (const check of bioChecks) {
    if (!latestBioByWorker.has(check.workerId)) {
      latestBioByWorker.set(check.workerId, check.result);
    }
  }

  const payments = await prisma.payment.findMany({
    where: {
      periodIso: period.shortPeriod,
      OR: [{ referenceYear: period.referenceYear }, { referenceYear: null }],
      worker: { siteId: input.siteId },
    },
    include: { worker: true },
    orderBy: { worker: { lastName: "asc" } },
  });

  const dayMap = new Map<string, Map<string, WeeklyReportRow[]>>();
  let totalAmount = 0;
  const workerIds = new Set<string>();

  for (const pointage of pointages) {
    workerIds.add(pointage.workerId);
    totalAmount += Number(pointage.amount.toString());

    const dayKey = formatDateFr(pointage.date);
    const activityLabel = pointage.subActivity.label;
    if (!dayMap.has(dayKey)) dayMap.set(dayKey, new Map());
    const activityMap = dayMap.get(dayKey)!;
    if (!activityMap.has(activityLabel)) activityMap.set(activityLabel, []);

    activityMap.get(activityLabel)!.push({
      workerName: `${pointage.worker.lastName} ${pointage.worker.firstName}`,
      quantity: pointage.quantity.toString(),
      unit: pointage.subActivity.unit.label,
      amount: formatAmount(pointage.amount),
      bioStatus: bioStatusLabel(latestBioByWorker.get(pointage.workerId)),
    });
  }

  const invoiceActivities = buildInvoiceActivities(pointages);

  const byDay: WeeklyReportDay[] = [...dayMap.entries()].map(([date, activitiesMap]) => ({
    date,
    activities: [...activitiesMap.entries()].map(([label, rows]) => ({ label, rows })),
  }));

  let bioOkCount = 0;
  let bioPendingCount = 0;
  for (const workerId of workerIds) {
    const result = latestBioByWorker.get(workerId);
    if (result === BioResult.OK) bioOkCount++;
    else bioPendingCount++;
  }

  const paymentRows: WeeklyPaymentRow[] = payments.map((payment) => ({
    workerName: `${payment.worker.lastName} ${payment.worker.firstName}`,
    mvolaNumber: payment.worker.mvolaNumber,
    amount: formatAmount(payment.amount),
    bioValid: payment.bioValid ? "OUI" : "NON",
    description: payment.description,
  }));

  const signedAt = new Date().toISOString();

  return {
    generatedAt: new Date(signedAt).toLocaleString("fr-FR"),
    weekIso: period.weekIso,
    periodLabel: period.shortPeriod,
    dateFrom: formatDateFr(period.dateFrom),
    dateTo: formatDateFr(period.dateTo),
    site: { name: site.name, shortCode: site.shortCode },
    cds: {
      fullName: `${cds.lastName} ${cds.firstName}`,
      signedAt: new Date(signedAt).toLocaleString("fr-FR"),
    },
    summary: {
      workerCount: workerIds.size,
      pointageCount: pointages.length,
      totalAmount: formatAmount({ toString: () => String(totalAmount) }),
      bioOkCount,
      bioPendingCount,
      paymentCount: payments.length,
    },
    byDay,
    invoiceActivities,
    payments: paymentRows,
  };
}
