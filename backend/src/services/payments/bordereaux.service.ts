import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolvePeriod } from "../../lib/period-iso.js";
import type { AuthUser } from "../access/auth-user.js";
import { isValidMvolaNumber } from "./mvola-description.js";

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

export interface ExportQueueFilters {
  periodIso?: string;
  referenceYear?: number;
}

export async function listExportQueue(user: AuthUser, filters: ExportQueueFilters) {
  const resolved = filters.periodIso
    ? resolvePeriod(filters.periodIso, undefined, filters.referenceYear)
    : undefined;

  const bordereaux = await prisma.bordereau.findMany({
    where: {
      status: { in: ["DG_VALIDATED", "EXPORTED"] },
      ...(resolved
        ? { periodIso: resolved.shortPeriod, referenceYear: resolved.referenceYear }
        : {}),
      ...(user.scope === "TOUS" ? {} : { siteId: user.siteId ?? "none" }),
    },
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
    orderBy: [{ periodIso: "desc" }, { site: { shortCode: "asc" } }],
    take: 200,
  });

  return {
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
