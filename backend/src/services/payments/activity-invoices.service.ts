import { PaymentStatus, PointageStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolvePeriod } from "../../lib/period-iso.js";
import { ApiError } from "../../middleware/error-handler.js";
import { BUCKETS, minioClient } from "../storage/minio.js";
import { htmlToPdfBuffer, renderActivityInvoiceHtml } from "../reports/pdf-render.service.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { DEFAULT_ICON_BASE64, DEFAULT_ICON_CONTENT_TYPE } from "../../assets/default-icon.js";

export interface ActivityInvoiceLine {
  matricule: string;
  workerName: string;
  quantity: string;
  unitPrice: string;
  amount: string;
}

export interface ActivityInvoiceViewModel {
  generatedAt: string;
  weekIso: string;
  weekNumber: string;
  year: string;
  periodLabel: string;
  dateFrom: string;
  dateTo: string;
  header: { appName: string; logoDataUri: string };
  site: { name: string; shortCode: string };
  activity: { label: string; unit: string; unitRate: string };
  lines: ActivityInvoiceLine[];
  summary: { workerCount: number; totalAmount: string };
}

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

const ICON_CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  svg: "image/svg+xml",
  webp: "image/webp",
};

/** Logo + nom d'application actuels (mêmes réglages que la sidebar admin) — repliés sur le logo
 * ALTERRA par défaut si aucune icône custom n'est configurée ou que sa lecture échoue. */
async function getInvoiceHeaderAssets(): Promise<{ appName: string; logoDataUri: string }> {
  const defaultHeader = {
    appName: "ALTERRA",
    logoDataUri: `data:${DEFAULT_ICON_CONTENT_TYPE};base64,${DEFAULT_ICON_BASE64}`,
  };

  const setting = await prisma.appSetting.findUnique({ where: { id: "singleton" } });
  const appName = setting?.appName ?? defaultHeader.appName;
  if (!setting?.iconKey) return { appName, logoDataUri: defaultHeader.logoDataUri };

  try {
    const ext = setting.iconKey.split(".").pop() ?? "";
    const contentType = ICON_CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";
    const stream = await minioClient.getObject(BUCKETS.assets, setting.iconKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    const base64 = Buffer.concat(chunks).toString("base64");
    return { appName, logoDataUri: `data:${contentType};base64,${base64}` };
  } catch {
    return { appName, logoDataUri: defaultHeader.logoDataUri };
  }
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
      worker: { select: { matricule: true, firstName: true, lastName: true, siteId: true, site: true } },
      subActivity: { include: { unit: true } },
    },
    orderBy: [{ worker: { lastName: "asc" } }],
  });
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
    header: { appName: string; logoDataUri: string };
  },
) {
  const subActivity = rows[0].subActivity;
  const subActivityId = rows[0].subActivityId;
  const site = rows[0].worker.site;
  const workerIds = new Set(rows.map((r) => r.workerId));
  const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount), 0);
  const unitRateSnapshot = rows[0].unitRateSnapshot;
  const generatedAt = new Date();
  const weekNumber = String(Number(context.weekIso.split("-W")[1]));

  const viewModel: ActivityInvoiceViewModel = {
    generatedAt: generatedAt.toLocaleString("fr-FR"),
    weekIso: context.weekIso,
    weekNumber,
    year: String(context.referenceYear),
    periodLabel: context.shortPeriod,
    dateFrom: formatDateFr(context.dateFrom),
    dateTo: formatDateFr(context.dateTo),
    header: context.header,
    site: { name: site.name, shortCode: site.shortCode },
    activity: {
      label: subActivity.label,
      unit: subActivity.unit.label,
      // Tarif réellement appliqué au moment de la saisie (snapshot), pas le tarif courant de
      // l'activité qui a pu changer depuis.
      unitRate: formatAmount(Number(unitRateSnapshot)),
    },
    lines: rows.map((r) => ({
      matricule: r.worker.matricule,
      workerName: `${r.worker.lastName} ${r.worker.firstName}`,
      quantity: r.quantity.toString(),
      unitPrice: formatAmount(Number(r.unitRateSnapshot)),
      amount: formatAmount(Number(r.amount)),
    })),
    summary: {
      workerCount: workerIds.size,
      totalAmount: formatAmount(totalAmount),
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
  const header = await getInvoiceHeaderAssets();
  const context = {
    weekIso: input.weekIso,
    shortPeriod: input.shortPeriod,
    referenceYear: input.referenceYear,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    header,
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
        workerCount: built.workerCount,
        unitRateSnapshot: built.unitRateSnapshot,
        totalAmount: built.totalAmount,
        createdById: input.createdById,
      },
    });

    results.push({
      id: invoice.id,
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
      ...(resolved ? { periodIso: resolved.shortPeriod, referenceYear: resolved.referenceYear } : {}),
    },
    include: {
      subActivity: { select: { label: true, shortLabel: true } },
      site: { select: { name: true, shortCode: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return invoices.map((invoice) => ({
    id: invoice.id,
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

  const resolved = resolvePeriod(existing.periodIso, undefined, existing.referenceYear ?? undefined);

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

  const header = await getInvoiceHeaderAssets();

  const built = await renderAndStoreInvoicePdf(rows, {
    weekIso: resolved.weekIso,
    shortPeriod: resolved.shortPeriod,
    referenceYear: resolved.referenceYear,
    dateFrom: resolved.dateFrom,
    dateTo: resolved.dateTo,
    header,
  });

  const updated = await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      fileKey: built.fileKey,
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
    subActivityId: built.subActivityId,
    activityLabel: built.activityLabel,
    siteId: built.siteId,
    siteLabel: built.siteLabel,
    workerCount: built.workerCount,
    unitRate: formatAmount(Number(built.unitRateSnapshot)),
    totalAmount: formatAmount(built.totalAmount),
  };
}
