import { PaymentStatus, PointageStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolvePeriod } from "../../lib/period-iso.js";
import { ApiError } from "../../middleware/error-handler.js";
import { BUCKETS, minioClient } from "../storage/minio.js";
import { htmlToPdfBuffer, renderActivityInvoiceHtml } from "../reports/pdf-render.service.js";
import { writeAuditLog } from "../audit/audit.service.js";

export interface ActivityInvoiceLine {
  rowNumber: number;
  matricule: string;
  cinNumber: string;
  designation: string;
  workerName: string;
  quantity: string;
  unitPrice: string;
  amount: string;
  isiAmount: string;
  netAmount: string;
}

export interface ActivityInvoiceViewModel {
  generatedAt: string;
  invoiceDate: string;
  invoiceNumber: string;
  weekIso: string;
  weekNumber: string;
  year: string;
  periodLabel: string;
  motif: string;
  dateFrom: string;
  dateTo: string;
  client: { name: string; nif: string; stat: string; addressLine1: string; addressLine2: string };
  site: { name: string; shortCode: string };
  activity: { label: string; unit: string; unitRate: string };
  lines: ActivityInvoiceLine[];
  summary: { workerCount: number; totalAmount: string; isiAmount: string; netAmount: string };
}

/** Identité fiscale du client facturé ("Doit :") — reprise telle quelle du modèle de référence
 * FORMAT FACTURE ISI.xlsx, pas une donnée qu'ALTERRA calcule ou stocke par ailleurs. */
const INVOICE_CLIENT = {
  name: "LOHASAHA MADAGASCO",
  nif: "2001423709",
  stat: "02101 11 2009 0 10596",
  addressLine1: "BAT KUBE D 2EME ETAGE, ZONE GALAXY ANDRAHARO",
  addressLine2: "101 ANTANANARIVO MADAGASCAR",
};

/** Retenue appliquée sur chaque ligne ("ISI 5%" du modèle de référence) — calculée à l'affichage,
 * jamais stockée : le format de référence l'exprime lui-même comme une formule, pas une donnée. */
const ISI_WITHHOLDING_RATE = 0.05;

export interface GenerateActivityInvoicesInput {
  shortPeriod: string;
  referenceYear: number;
  weekIso: string;
  dateFrom: Date;
  dateTo: Date;
  workerIds: string[];
  createdById: string;
}

export interface GeneratedInvoiceSummary {
  id: string;
  number: number | null;
  subActivityId: string;
  activityLabel: string;
  siteId: string;
  siteLabel: string;
  workerCount: number;
  unitRate: string;
  totalAmount: string;
}

function formatAmount(value: number): string {
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

function formatDateFr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

type InvoicePointageRow = Awaited<ReturnType<typeof fetchValidatedPointages>>[number];

function fetchValidatedPointages(where: {
  dateFrom: Date;
  dateTo: Date;
  workerIds: string[];
  subActivityId?: string;
  siteId?: string;
}) {
  return prisma.pointage.findMany({
    where: {
      status: PointageStatus.VALIDATED,
      date: { gte: where.dateFrom, lte: where.dateTo },
      workerId: { in: where.workerIds },
      ...(where.subActivityId ? { subActivityId: where.subActivityId } : {}),
      ...(where.siteId ? { worker: { siteId: where.siteId } } : {}),
    },
    include: {
      worker: {
        select: {
          matricule: true,
          cinNumber: true,
          firstName: true,
          lastName: true,
          siteId: true,
          site: true,
        },
      },
      subActivity: { include: { unit: true } },
    },
    orderBy: [{ worker: { lastName: "asc" } }],
  });
}

/** Numéro de facture suivant pour un site et une année ("N° XX/AAAA/SITE") — même principe que
 * `nextBordereauBySite` pour les paiements : un compteur alloué, pas réservé atomiquement. */
async function nextInvoiceNumber(siteId: string, referenceYear: number): Promise<number> {
  // `number` est nullable (factures créées avant ce champ) : Postgres trie NULL en tête sur un
  // DESC, donc sans ce filtre `last` serait systématiquement une ligne sans numéro.
  const last = await prisma.invoice.findFirst({
    where: { siteId, referenceYear, number: { not: null } },
    orderBy: { number: "desc" },
  });
  return (last?.number ?? 0) + 1;
}

/** Rend le PDF d'un (site, activité) et le stocke sur MinIO — ne touche pas la table Invoice
 * (création ou mise à jour à la charge de l'appelant, pour partager ce rendu entre génération et
 * régénération). `rows` doit déjà être filtré sur un seul site et une seule activité. */
async function renderAndStoreInvoicePdf(
  rows: InvoicePointageRow[],
  context: {
    weekIso: string;
    shortPeriod: string;
    referenceYear: number;
    dateFrom: Date;
    dateTo: Date;
    /** Facture déjà numérotée (régénération) — sinon un numéro est alloué ici. */
    existingNumber?: number | null;
  },
) {
  const subActivity = rows[0].subActivity;
  const subActivityId = rows[0].subActivityId;
  const site = rows[0].worker.site;
  const workerIds = new Set(rows.map((r) => r.workerId));
  const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount), 0);
  const isiAmount = totalAmount * ISI_WITHHOLDING_RATE;
  const netAmount = totalAmount - isiAmount;
  const unitRateSnapshot = rows[0].unitRateSnapshot;
  const generatedAt = new Date();
  const weekNumber = String(Number(context.weekIso.split("-W")[1]));
  const invoiceNumber =
    context.existingNumber ?? (await nextInvoiceNumber(site.id, context.referenceYear));
  const motif = `${subActivity.label} — Semaine ${weekNumber}/${context.referenceYear}`;

  const viewModel: ActivityInvoiceViewModel = {
    generatedAt: generatedAt.toLocaleString("fr-FR"),
    invoiceDate: generatedAt.toLocaleDateString("fr-FR"),
    invoiceNumber: `${String(invoiceNumber).padStart(2, "0")}/${context.referenceYear}/${site.shortCode}`,
    weekIso: context.weekIso,
    weekNumber,
    year: String(context.referenceYear),
    periodLabel: context.shortPeriod,
    motif,
    dateFrom: formatDateFr(context.dateFrom),
    dateTo: formatDateFr(context.dateTo),
    client: INVOICE_CLIENT,
    site: { name: site.name, shortCode: site.shortCode },
    activity: {
      label: subActivity.label,
      unit: subActivity.unit.label,
      // Tarif réellement appliqué au moment de la saisie (snapshot), pas le tarif courant de
      // l'activité qui a pu changer depuis.
      unitRate: formatAmount(Number(unitRateSnapshot)),
    },
    lines: rows.map((r, index) => {
      const amount = Number(r.amount);
      const lineIsi = amount * ISI_WITHHOLDING_RATE;
      return {
        rowNumber: index + 1,
        matricule: r.worker.matricule,
        cinNumber: r.worker.cinNumber ?? "",
        designation: motif,
        workerName: `${r.worker.lastName} ${r.worker.firstName}`,
        quantity: r.quantity.toString(),
        unitPrice: formatAmount(Number(r.unitRateSnapshot)),
        amount: formatAmount(amount),
        isiAmount: formatAmount(lineIsi),
        netAmount: formatAmount(amount - lineIsi),
      };
    }),
    summary: {
      workerCount: workerIds.size,
      totalAmount: formatAmount(totalAmount),
      isiAmount: formatAmount(isiAmount),
      netAmount: formatAmount(netAmount),
    },
  };

  const html = renderActivityInvoiceHtml(viewModel);
  const buffer = await htmlToPdfBuffer(html);

  const stamp = generatedAt.toISOString().replace(/[-:]/g, "").slice(0, 15);
  const fileKey = `invoices/${context.weekIso}/${site.shortCode}_${subActivityId}_${stamp}.pdf`;

  await minioClient.putObject(BUCKETS.reports, fileKey, buffer, buffer.length, {
    "Content-Type": "application/pdf",
  });

  return {
    subActivityId,
    activityLabel: subActivity.label,
    siteId: site.id,
    siteLabel: `${site.name} (${site.shortCode})`,
    fileKey,
    number: invoiceNumber,
    workerCount: workerIds.size,
    unitRateSnapshot,
    totalAmount,
  };
}

/**
 * Une facture PDF par site et par activité pour les travailleurs dont le paiement vient d'être
 * exporté MVola — regroupe leurs pointages validés de la période pour CE site et CETTE activité (le
 * Payment agrégé par travailleur ne garde qu'une "activité dominante", donc on repart des pointages
 * pour le détail par activité). Échec non bloquant pour l'export : erreurs loguées, jamais propagées.
 */
export async function generateActivityInvoices(
  input: GenerateActivityInvoicesInput,
): Promise<GeneratedInvoiceSummary[]> {
  if (input.workerIds.length === 0) return [];

  const pointages = await fetchValidatedPointages({
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    workerIds: input.workerIds,
  });

  if (pointages.length === 0) return [];

  const bySiteActivity = new Map<string, InvoicePointageRow[]>();
  for (const pointage of pointages) {
    const key = `${pointage.worker.siteId}:${pointage.subActivityId}`;
    const list = bySiteActivity.get(key) ?? [];
    list.push(pointage);
    bySiteActivity.set(key, list);
  }

  const results: GeneratedInvoiceSummary[] = [];
  const context = {
    weekIso: input.weekIso,
    shortPeriod: input.shortPeriod,
    referenceYear: input.referenceYear,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  };

  for (const rows of bySiteActivity.values()) {
    const built = await renderAndStoreInvoicePdf(rows, context);

    const invoice = await prisma.invoice.create({
      data: {
        periodIso: input.shortPeriod,
        referenceYear: input.referenceYear,
        siteId: built.siteId,
        subActivityId: built.subActivityId,
        fileKey: built.fileKey,
        number: built.number,
        workerCount: built.workerCount,
        unitRateSnapshot: built.unitRateSnapshot,
        totalAmount: built.totalAmount,
        createdById: input.createdById,
      },
    });

    results.push({
      id: invoice.id,
      number: invoice.number,
      subActivityId: built.subActivityId,
      activityLabel: built.activityLabel,
      siteId: built.siteId,
      siteLabel: built.siteLabel,
      workerCount: built.workerCount,
      unitRate: formatAmount(Number(built.unitRateSnapshot)),
      totalAmount: formatAmount(built.totalAmount),
    });
  }

  return results;
}

export interface ListInvoicesFilters {
  periodIso?: string;
  referenceYear?: number;
}

export async function listInvoices(filters: ListInvoicesFilters) {
  // Normalisé comme listPayments : accepte "2026-W29" ou "S29" en entrée, comparé à la forme courte
  // stockée ("S29") — une comparaison littérale casserait silencieusement sur la forme longue.
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
      subActivity: { select: { label: true, shortLabel: true } },
      site: { select: { name: true, shortCode: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return invoices.map((invoice) => ({
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

/**
 * Génération manuelle de rattrapage — pour une période déjà exportée MVola (payments EXPORTED/PAID)
 * mais sans facture (génération auto échouée à l'export, ou export fait avant cette fonctionnalité).
 */
export async function generateInvoicesForPeriod(
  periodIso: string,
  referenceYear: number | undefined,
  createdById: string,
  auditMeta?: { ip?: string; userAgent?: string },
): Promise<GeneratedInvoiceSummary[]> {
  const resolved = resolvePeriod(periodIso, undefined, referenceYear);

  const exportedPayments = await prisma.payment.findMany({
    where: {
      periodIso: resolved.shortPeriod,
      referenceYear: resolved.referenceYear,
      status: { in: [PaymentStatus.EXPORTED, PaymentStatus.PAID] },
    },
    select: { workerId: true },
  });

  if (exportedPayments.length === 0) {
    throw new ApiError(
      404,
      "NO_EXPORTED_PAYMENTS",
      "Aucun paiement exporté MVola pour cette période — rien à facturer",
    );
  }

  const created = await generateActivityInvoices({
    shortPeriod: resolved.shortPeriod,
    referenceYear: resolved.referenceYear,
    weekIso: resolved.weekIso,
    dateFrom: resolved.dateFrom,
    dateTo: resolved.dateTo,
    workerIds: [...new Set(exportedPayments.map((p) => p.workerId))],
    createdById,
  });

  await writeAuditLog({
    userId: createdById,
    action: "GENERATE",
    entityType: "Invoice",
    after: {
      periodIso: resolved.shortPeriod,
      referenceYear: resolved.referenceYear,
      invoiceIds: created.map((c) => c.id),
      count: created.length,
    },
    ip: auditMeta?.ip,
    userAgent: auditMeta?.userAgent,
  });

  return created;
}

/**
 * Régénère le PDF d'UNE facture déjà existante (correction de pointage après coup, échec de rendu
 * initial, etc.) — recalcule à partir des pointages validés actuels, remplace le PDF stocké et met
 * à jour la même ligne Invoice (conserve son id, son historique dans la liste).
 */
export async function regenerateInvoice(
  invoiceId: string,
  createdById: string,
  auditMeta?: { ip?: string; userAgent?: string },
): Promise<GeneratedInvoiceSummary> {
  const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Facture introuvable");

  const resolved = resolvePeriod(
    existing.periodIso,
    undefined,
    existing.referenceYear ?? undefined,
  );

  const exportedPayments = await prisma.payment.findMany({
    where: {
      periodIso: resolved.shortPeriod,
      referenceYear: resolved.referenceYear,
      status: { in: [PaymentStatus.EXPORTED, PaymentStatus.PAID] },
    },
    select: { workerId: true },
  });
  const workerIds = [...new Set(exportedPayments.map((p) => p.workerId))];

  const rows = await fetchValidatedPointages({
    dateFrom: resolved.dateFrom,
    dateTo: resolved.dateTo,
    workerIds,
    subActivityId: existing.subActivityId,
    siteId: existing.siteId,
  });

  if (rows.length === 0) {
    throw new ApiError(
      404,
      "NO_POINTAGES",
      "Aucun pointage validé pour ce site et cette activité sur la période — rien à régénérer",
    );
  }

  const built = await renderAndStoreInvoicePdf(rows, {
    weekIso: resolved.weekIso,
    shortPeriod: resolved.shortPeriod,
    referenceYear: resolved.referenceYear,
    dateFrom: resolved.dateFrom,
    dateTo: resolved.dateTo,
    // Une régénération garde le même numéro de facture — sauf rattrapage d'une facture créée
    // avant l'introduction de ce champ, qui en reçoit alors un pour la première fois.
    existingNumber: existing.number,
  });

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      fileKey: built.fileKey,
      number: built.number,
      workerCount: built.workerCount,
      unitRateSnapshot: built.unitRateSnapshot,
      totalAmount: built.totalAmount,
    },
  });

  await writeAuditLog({
    userId: createdById,
    action: "REGENERATE",
    entityType: "Invoice",
    entityId: invoiceId,
    before: {
      fileKey: existing.fileKey,
      workerCount: existing.workerCount,
      totalAmount: existing.totalAmount.toString(),
    },
    after: {
      fileKey: updated.fileKey,
      workerCount: updated.workerCount,
      totalAmount: updated.totalAmount.toString(),
    },
    ip: auditMeta?.ip,
    userAgent: auditMeta?.userAgent,
  });

  return {
    id: updated.id,
    number: updated.number,
    subActivityId: built.subActivityId,
    activityLabel: built.activityLabel,
    siteId: built.siteId,
    siteLabel: built.siteLabel,
    workerCount: built.workerCount,
    unitRate: formatAmount(Number(built.unitRateSnapshot)),
    totalAmount: formatAmount(built.totalAmount),
  };
}
