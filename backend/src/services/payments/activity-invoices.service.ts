import { prisma } from "../../lib/prisma.js";
import { resolvePeriod } from "../../lib/period-iso.js";

/** Factures historiques (une par site et par sous-activité, créées à l'export avant P1-08) :
 * conservées en lecture seule. Les nouvelles factures sont rattachées aux bordereaux. */

const DEFAULT_PAGE_SIZE = 50;

export interface ListInvoicesFilters {
  periodIso?: string;
  referenceYear?: number;
}

export interface ListInvoicesPage extends ListInvoicesFilters {
  cursor?: string;
  take?: number;
}

export async function listInvoices(filters: ListInvoicesPage) {
  // Normalisé comme listPayments : accepte "2026-W29" ou "S29" en entrée, comparé à la forme courte
  // stockée ("S29") — une comparaison littérale casserait silencieusement sur la forme longue.
  const resolved = filters.periodIso
    ? resolvePeriod(filters.periodIso, undefined, filters.referenceYear)
    : undefined;

  const take = filters.take ?? DEFAULT_PAGE_SIZE;
  const rows = await prisma.invoice.findMany({
    take: take + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    where: {
      ...(resolved
        ? { periodIso: resolved.shortPeriod, referenceYear: resolved.referenceYear }
        : {}),
    },
    include: {
      subActivity: { select: { label: true, shortLabel: true } },
      site: { select: { name: true, shortCode: true } },
    },
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });

  const hasMore = rows.length > take;
  const invoices = hasMore ? rows.slice(0, take) : rows;

  const data = invoices.map((invoice) => ({
    id: invoice.id,
    number: invoice.number,
    periodIso: invoice.periodIso,
    referenceYear: invoice.referenceYear,
    activityLabel: invoice.subActivity.label,
    siteLabel: `${invoice.site.name} (${invoice.site.shortCode})`,
    workerCount: invoice.workerCount,
    unitRate: invoice.unitRateSnapshot.toString(),
    totalAmount: invoice.totalAmount.toString(),
    createdAt: invoice.createdAt.toISOString(),
  }));

  return {
    data,
    hasMore,
    nextCursor: hasMore ? (invoices[invoices.length - 1]?.id ?? null) : null,
  };
}

/** Même filtrage que listInvoices, mais avec fileKey pour l'archive ZIP (téléchargement groupé). */
export async function listInvoicesForZip(filters: ListInvoicesFilters) {
  const resolved = filters.periodIso
    ? resolvePeriod(filters.periodIso, undefined, filters.referenceYear)
    : undefined;

  const invoices = await prisma.invoice.findMany({
    where: {
      ...(resolved
        ? { periodIso: resolved.shortPeriod, referenceYear: resolved.referenceYear }
        : {}),
    },
    include: {
      subActivity: { select: { label: true } },
      site: { select: { shortCode: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return invoices.map((invoice) => ({
    id: invoice.id,
    fileKey: invoice.fileKey,
    periodIso: invoice.periodIso,
    activityLabel: invoice.subActivity.label,
    siteShortCode: invoice.site.shortCode,
  }));
}
