import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolvePeriod } from "../../lib/period-iso.js";

export interface ListBordereauxFilters {
  periodIso: string;
  referenceYear?: number;
  siteId?: string;
}

export async function listBordereaux(filters: ListBordereauxFilters) {
  const { shortPeriod, referenceYear } = resolvePeriod(
    filters.periodIso,
    undefined,
    filters.referenceYear,
  );

  const bordereaux = await prisma.bordereau.findMany({
    where: {
      periodIso: shortPeriod,
      referenceYear,
      status: { not: "SUPERSEDED" },
      ...(filters.siteId ? { siteId: filters.siteId } : {}),
    },
    include: {
      site: { select: { id: true, name: true, shortCode: true } },
      payments: { select: { amount: true, status: true } },
    },
    orderBy: [{ site: { shortCode: "asc" } }, { version: "desc" }],
  });

  return {
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
