import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolvePeriod } from "../../lib/period-iso.js";
import type { AuthUser } from "../access/auth-user.js";
import { isValidMvolaNumber } from "./mvola-description.js";

export type BordereauStatusGroup = "TO_VALIDATE" | "TO_EXPORT" | "EXPORTED" | "ALL";

const STATUS_GROUPS = {
  TO_VALIDATE: ["GENERATED", "FINANCE_VALIDATED"],
  TO_EXPORT: ["DG_VALIDATED"],
  EXPORTED: ["EXPORTED"],
} as const;

const DEFAULT_PAGE_SIZE = 50;

export interface ListBordereauxFilters {
  periodIso?: string;
  referenceYear?: number;
  siteId?: string;
  group?: BordereauStatusGroup;
  cursor?: string;
  take?: number;
}

export async function listBordereaux(filters: ListBordereauxFilters) {
  const period = filters.periodIso
    ? resolvePeriod(filters.periodIso, undefined, filters.referenceYear)
    : null;

  const base = {
    ...(period ? { periodIso: period.shortPeriod, referenceYear: period.referenceYear } : {}),
    ...(filters.siteId ? { siteId: filters.siteId } : {}),
  };
  const group = filters.group ?? "ALL";
  const take = filters.take ?? DEFAULT_PAGE_SIZE;

  const [rows, grouped] = await Promise.all([
    prisma.bordereau.findMany({
      where: {
        ...base,
        status: group === "ALL" ? { not: "SUPERSEDED" } : { in: [...STATUS_GROUPS[group]] },
      },
      take: take + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      include: {
        site: { select: { id: true, name: true, shortCode: true } },
        payments: { select: { amount: true, status: true } },
      },
      orderBy: period
        ? [{ site: { shortCode: "asc" } }, { version: "desc" }, { id: "asc" }]
        : [{ referenceYear: "desc" }, { createdAt: "desc" }, { id: "asc" }],
    }),
    prisma.bordereau.groupBy({
      by: ["status"],
      where: { ...base, status: { not: "SUPERSEDED" } },
      _count: { _all: true },
    }),
  ]);

  const countOf = (statuses: readonly string[]) =>
    grouped
      .filter((row) => statuses.includes(row.status))
      .reduce((sum, row) => sum + row._count._all, 0);
  const counts = {
    TO_VALIDATE: countOf(STATUS_GROUPS.TO_VALIDATE),
    TO_EXPORT: countOf(STATUS_GROUPS.TO_EXPORT),
    EXPORTED: countOf(STATUS_GROUPS.EXPORTED),
    ALL: grouped.reduce((sum, row) => sum + row._count._all, 0),
  };

  const hasMore = rows.length > take;
  const bordereaux = hasMore ? rows.slice(0, take) : rows;

  return {
    counts,
    hasMore,
    nextCursor: hasMore ? (bordereaux[bordereaux.length - 1]?.id ?? null) : null,
    data: bordereaux.map((bordereau) => ({
      id: bordereau.id,
      siteId: bordereau.siteId,
      siteName: bordereau.site.name,
      siteCode: bordereau.site.shortCode,
      periodIso: bordereau.periodIso,
      referenceYear: bordereau.referenceYear,
      number: bordereau.number,
      version: bordereau.version,
      status: bordereau.status,
      createdAt: bordereau.createdAt,
      financeValidatedAt: bordereau.financeValidatedAt,
      dgValidatedAt: bordereau.dgValidatedAt,
      returnReason: bordereau.returnReason,
      paymentCount: bordereau.payments.length,
      totalAmount: bordereau.payments
        .reduce((sum, payment) => sum.add(payment.amount), new Prisma.Decimal(0))
        .toString(),
    })),
  };
}

export type ExportQueueGroup = "TO_EXPORT" | "EXPORTED" | "ALL";

const EXPORT_QUEUE_STATUSES = {
  TO_EXPORT: ["DG_VALIDATED"],
  EXPORTED: ["EXPORTED"],
  ALL: ["DG_VALIDATED", "EXPORTED"],
} as const;

export interface ExportQueueFilters {
  periodIso?: string;
  referenceYear?: number;
  group?: ExportQueueGroup;
  cursor?: string;
  take?: number;
}

export async function listExportQueue(user: AuthUser, filters: ExportQueueFilters) {
  const resolved = filters.periodIso
    ? resolvePeriod(filters.periodIso, undefined, filters.referenceYear)
    : undefined;

  const base = {
    ...(resolved ? { periodIso: resolved.shortPeriod, referenceYear: resolved.referenceYear } : {}),
    ...(user.scope === "TOUS" ? {} : { siteId: user.siteId ?? "none" }),
  };
  const group = filters.group ?? "ALL";
  const take = filters.take ?? DEFAULT_PAGE_SIZE;

  const [rows, grouped] = await Promise.all([
    prisma.bordereau.findMany({
      where: { ...base, status: { in: [...EXPORT_QUEUE_STATUSES[group]] } },
      take: take + 1,
      ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
      include: {
        site: { select: { name: true, shortCode: true } },
        invoice: { select: { net: true } },
        exportBatches: {
          select: { id: true, version: true, filename: true, createdAt: true },
          orderBy: { version: "desc" },
        },
        payments: {
          select: {
            netAmount: true,
            bioValid: true,
            worker: { select: { matricule: true, mvolaNumber: true } },
          },
        },
      },
      orderBy: [
        { referenceYear: "desc" },
        { periodIso: "desc" },
        { site: { shortCode: "asc" } },
        { id: "asc" },
      ],
    }),
    prisma.bordereau.groupBy({
      by: ["status"],
      where: { ...base, status: { in: [...EXPORT_QUEUE_STATUSES.ALL] } },
      _count: { _all: true },
    }),
  ]);

  const countOf = (status: string) =>
    grouped.find((row) => row.status === status)?._count._all ?? 0;
  const counts = {
    TO_EXPORT: countOf("DG_VALIDATED"),
    EXPORTED: countOf("EXPORTED"),
    ALL: countOf("DG_VALIDATED") + countOf("EXPORTED"),
  };

  const hasMore = rows.length > take;
  const bordereaux = hasMore ? rows.slice(0, take) : rows;

  return {
    counts,
    hasMore,
    nextCursor: hasMore ? (bordereaux[bordereaux.length - 1]?.id ?? null) : null,
    data: bordereaux.map((bordereau) => {
      const totalNet = bordereau.payments.reduce(
        (sum, payment) => sum.add(payment.netAmount),
        new Prisma.Decimal(0),
      );
      const blockedLines =
        bordereau.status === "DG_VALIDATED"
          ? bordereau.payments.flatMap((payment) => {
              if (!payment.bioValid) {
                return [{ matricule: payment.worker.matricule, reason: "Biométrie non validée" }];
              }
              if (!payment.netAmount.gt(0)) {
                return [{ matricule: payment.worker.matricule, reason: "Montant nul" }];
              }
              if (!isValidMvolaNumber(payment.worker.mvolaNumber)) {
                return [{ matricule: payment.worker.matricule, reason: "Numéro MVola invalide" }];
              }
              return [];
            })
          : [];
      return {
        id: bordereau.id,
        siteId: bordereau.siteId,
        siteName: bordereau.site.name,
        siteCode: bordereau.site.shortCode,
        periodIso: bordereau.periodIso,
        referenceYear: bordereau.referenceYear,
        number: bordereau.number,
        version: bordereau.version,
        status: bordereau.status,
        exportedAt: bordereau.exportedAt,
        paymentCount: bordereau.payments.length,
        totalNet: totalNet.toString(),
        invoiceNet: bordereau.invoice ? bordereau.invoice.net.toString() : null,
        blockedLines,
        batches: bordereau.exportBatches,
      };
    }),
  };
}
