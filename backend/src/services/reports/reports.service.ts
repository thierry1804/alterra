import { PointageStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../middleware/error-handler.js";

export type ReportType = "pointages" | "payments" | "presence-by-site";

export interface ReportFilters {
  dateFrom: Date;
  dateTo: Date;
  siteId?: string;
}

export interface ReportMeta {
  type: ReportType;
  title: string;
  dateFrom: string;
  dateTo: string;
  siteId: string | null;
  rowCount: number;
}

export interface ReportResult {
  meta: ReportMeta;
  columns: string[];
  rows: Record<string, string | number | null>[];
}

const REPORT_TITLES: Record<ReportType, string> = {
  pointages: "Pointages sur période",
  payments: "Paiements sur période",
  "presence-by-site": "Présence par site",
};

export function resolveMonthRange(month: string): { dateFrom: Date; dateTo: Date } {
  const match = month.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    throw new ApiError(422, "INVALID_MONTH", "month must be YYYY-MM");
  }

  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    throw new ApiError(422, "INVALID_MONTH", "month must be YYYY-MM");
  }

  const dateFrom = new Date(Date.UTC(year, monthIndex, 1));
  const dateTo = new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999));
  return { dateFrom, dateTo };
}

export async function generateReport(
  type: ReportType,
  filters: ReportFilters,
): Promise<ReportResult> {
  const metaBase: Omit<ReportMeta, "rowCount"> = {
    type,
    title: REPORT_TITLES[type],
    dateFrom: filters.dateFrom.toISOString().slice(0, 10),
    dateTo: filters.dateTo.toISOString().slice(0, 10),
    siteId: filters.siteId ?? null,
  };

  switch (type) {
    case "pointages":
      return generatePointagesReport(metaBase, filters);
    case "payments":
      return generatePaymentsReport(metaBase, filters);
    case "presence-by-site":
      return generatePresenceBySiteReport(metaBase, filters);
    default:
      throw new ApiError(422, "INVALID_REPORT", `Unknown report type: ${type}`);
  }
}

async function generatePointagesReport(
  metaBase: Omit<ReportMeta, "rowCount">,
  filters: ReportFilters,
): Promise<ReportResult> {
  const workerScope = filters.siteId ? { siteId: filters.siteId } : {};

  const pointages = await prisma.pointage.findMany({
    where: {
      date: { gte: filters.dateFrom, lte: filters.dateTo },
      worker: workerScope,
    },
    include: {
      worker: { include: { site: true } },
      activity: true,
    },
    orderBy: [{ date: "asc" }, { worker: { lastName: "asc" } }],
  });

  const rows = pointages.map((pointage) => ({
    date: pointage.date.toISOString().slice(0, 10),
    site: pointage.worker.site.shortCode,
    matricule: pointage.worker.matricule,
    worker: `${pointage.worker.firstName} ${pointage.worker.lastName}`,
    activity: pointage.activity.label,
    quantity: Number(pointage.quantity),
    amount: Number(pointage.amount),
    status: pointage.status,
  }));

  return {
    meta: { ...metaBase, rowCount: rows.length },
    columns: ["date", "site", "matricule", "worker", "activity", "quantity", "amount", "status"],
    rows,
  };
}

async function generatePaymentsReport(
  metaBase: Omit<ReportMeta, "rowCount">,
  filters: ReportFilters,
): Promise<ReportResult> {
  const workerScope = filters.siteId ? { siteId: filters.siteId } : {};

  const payments = await prisma.payment.findMany({
    where: {
      createdAt: { gte: filters.dateFrom, lte: filters.dateTo },
      worker: workerScope,
    },
    include: {
      worker: { include: { site: true } },
    },
    orderBy: [{ periodIso: "asc" }, { worker: { lastName: "asc" } }],
  });

  const rows = payments.map((payment) => ({
    period: payment.periodIso,
    site: payment.worker.site.shortCode,
    matricule: payment.worker.matricule,
    worker: `${payment.worker.firstName} ${payment.worker.lastName}`,
    amount: Number(payment.amount),
    bioValid: payment.bioValid ? "OUI" : "NON",
    status: payment.status,
    paidAt: payment.paidAt?.toISOString().slice(0, 10) ?? null,
  }));

  return {
    meta: { ...metaBase, rowCount: rows.length },
    columns: ["period", "site", "matricule", "worker", "amount", "bioValid", "status", "paidAt"],
    rows,
  };
}

async function generatePresenceBySiteReport(
  metaBase: Omit<ReportMeta, "rowCount">,
  filters: ReportFilters,
): Promise<ReportResult> {
  const sites = await prisma.site.findMany({
    where: {
      active: true,
      ...(filters.siteId ? { id: filters.siteId } : {}),
    },
    orderBy: { shortCode: "asc" },
  });

  const rows: Record<string, string | number | null>[] = [];

  for (const site of sites) {
    const activeWorkers = await prisma.worker.count({
      where: { siteId: site.id, status: "ACTIVE", deletedAt: null },
    });

    const presentWorkers = await prisma.pointage.groupBy({
      by: ["workerId"],
      where: {
        status: PointageStatus.VALIDATED,
        date: { gte: filters.dateFrom, lte: filters.dateTo },
        worker: { siteId: site.id },
      },
    });

    const pointageAgg = await prisma.pointage.aggregate({
      where: {
        status: PointageStatus.VALIDATED,
        date: { gte: filters.dateFrom, lte: filters.dateTo },
        worker: { siteId: site.id },
      },
      _count: true,
      _sum: { amount: true },
    });

    const paidAgg = await prisma.payment.aggregate({
      where: {
        status: PaymentStatus.PAID,
        createdAt: { gte: filters.dateFrom, lte: filters.dateTo },
        worker: { siteId: site.id },
      },
      _sum: { amount: true },
    });

    const presenceRate =
      activeWorkers === 0
        ? 0
        : Math.round((presentWorkers.length / activeWorkers) * 1000) / 10;

    rows.push({
      site: site.shortCode,
      siteName: site.name,
      activeWorkers,
      workersPresent: presentWorkers.length,
      presenceRate,
      validatedPointages: pointageAgg._count,
      validatedAmount: Number(pointageAgg._sum.amount ?? 0),
      paidAmount: Number(paidAgg._sum.amount ?? 0),
    });
  }

  return {
    meta: { ...metaBase, rowCount: rows.length },
    columns: [
      "site",
      "siteName",
      "activeWorkers",
      "workersPresent",
      "presenceRate",
      "validatedPointages",
      "validatedAmount",
      "paidAmount",
    ],
    rows,
  };
}
