import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { basePrisma } from "../../lib/prisma-base.js";
import { resolvePeriod } from "../../lib/period-iso.js";
import { INVOICE_CLIENT } from "../../lib/invoice-client.js";
import { isiLineKey, lineIsi, ratePercentLabel, type IsiSettings } from "../../lib/isi.js";
import { ApiError } from "../../middleware/error-handler.js";
import { BUCKETS, minioClient } from "../storage/minio.js";
import { getReportStream } from "../storage/presigned-url.service.js";
import { htmlToPdfBuffer, renderBordereauInvoiceHtml } from "../reports/pdf-render.service.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { logger } from "../../lib/logger.js";
import type { AuthUser } from "../access/auth-user.js";
import { assertBordereauSite } from "./bordereau-access.js";

export interface BordereauInvoiceLine {
  rowNumber: number;
  matricule: string;
  cinNumber: string;
  designation: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  amount: string;
  isiAmount: string;
  netAmount: string;
}

export interface BordereauInvoiceActivity {
  code: string;
  label: string;
  isiRate: string;
  lines: BordereauInvoiceLine[];
  subtotal: string;
  isiSubtotal: string;
  netSubtotal: string;
}

export interface BordereauInvoiceViewModel {
  invoiceNumber: string;
  invoiceDate: string;
  generatedAt: string;
  version: number;
  motif: string;
  periodLabel: string;
  client: typeof INVOICE_CLIENT;
  site: { name: string; shortCode: string };
  activities: BordereauInvoiceActivity[];
  totals: { workerCount: number; gross: string; isi: string; net: string };
  isiRate: string;
}

export interface BordereauInvoiceTotals {
  gross: string;
  isi: string;
  net: string;
  workerCount: number;
}

function formatMoney(value: Prisma.Decimal.Value): string {
  return Number(new Prisma.Decimal(value).toString()).toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  });
}

function formatQuantity(value: Prisma.Decimal.Value): string {
  return Number(new Prisma.Decimal(value).toString()).toLocaleString("fr-FR", {
    maximumFractionDigits: 3,
  });
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

interface InvoiceData {
  viewModel: BordereauInvoiceViewModel;
  totals: BordereauInvoiceTotals;
}

export async function buildInvoiceData(bordereauId: string): Promise<InvoiceData | null> {
  const bordereau = await prisma.bordereau.findUnique({
    where: { id: bordereauId },
    include: { site: { select: { name: true, shortCode: true } } },
  });
  if (!bordereau) throw new ApiError(404, "NOT_FOUND", "Bordereau introuvable");

  const pointages = await prisma.pointage.findMany({
    where: { bordereauId },
    include: {
      worker: { select: { matricule: true, cinNumber: true, lastName: true, firstName: true } },
      subActivity: { include: { unit: true, category: true } },
    },
  });
  if (pointages.length === 0) return null;

  const period = resolvePeriod(bordereau.periodIso, undefined, bordereau.referenceYear);
  const weekNumber = String(Number(period.weekIso.split("-W")[1]));
  const periodLabel =
    period.cycle === "DAILY" ? period.dateFrom.toISOString().slice(0, 10) : `S${weekNumber}`;
  const motif =
    period.cycle === "DAILY"
      ? `Travaux du ${period.dateFrom.toLocaleDateString("fr-FR", { timeZone: "UTC" })}`
      : `Travaux de la semaine ${weekNumber}/${period.referenceYear}`;

  const grouped = new Map<
    string,
    {
      category: { code: string; label: string };
      subActivityLabel: string;
      unit: string;
      unitRate: Prisma.Decimal;
      worker: (typeof pointages)[number]["worker"];
      workerId: string;
      quantity: Prisma.Decimal;
      amount: Prisma.Decimal;
    }
  >();
  for (const pointage of pointages) {
    const key = isiLineKey(pointage);
    const entry = grouped.get(key);
    if (entry) {
      entry.quantity = entry.quantity.add(pointage.quantity);
      entry.amount = entry.amount.add(pointage.amount);
    } else {
      grouped.set(key, {
        category: {
          code: pointage.subActivity.category.code,
          label: pointage.subActivity.category.label,
        },
        subActivityLabel: pointage.subActivity.label,
        unit: pointage.subActivity.unit.label,
        unitRate: new Prisma.Decimal(pointage.unitRateSnapshot),
        worker: pointage.worker,
        workerId: pointage.workerId,
        quantity: new Prisma.Decimal(pointage.quantity),
        amount: new Prisma.Decimal(pointage.amount),
      });
    }
  }

  const isiSettings: IsiSettings = {
    rate: new Prisma.Decimal(bordereau.isiRate),
    rounding: bordereau.isiRounding,
  };
  const byCategory = new Map<string, typeof grouped extends Map<string, infer V> ? V[] : never>();
  for (const entry of grouped.values()) {
    const list = byCategory.get(entry.category.code) ?? [];
    list.push(entry);
    byCategory.set(entry.category.code, list);
  }

  let rowNumber = 0;
  let gross = new Prisma.Decimal(0);
  let isi = new Prisma.Decimal(0);
  const workerIds = new Set<string>();
  const activities: BordereauInvoiceActivity[] = [...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, entries]) => {
      let subtotal = new Prisma.Decimal(0);
      let isiSubtotal = new Prisma.Decimal(0);
      const lines = entries
        .sort(
          (a, b) =>
            a.subActivityLabel.localeCompare(b.subActivityLabel) ||
            `${a.worker.lastName} ${a.worker.firstName}`.localeCompare(
              `${b.worker.lastName} ${b.worker.firstName}`,
            ),
        )
        .map((entry) => {
          const lineIsiValue = lineIsi(entry.amount, isiSettings);
          subtotal = subtotal.add(entry.amount);
          isiSubtotal = isiSubtotal.add(lineIsiValue);
          workerIds.add(entry.workerId);
          rowNumber += 1;
          return {
            rowNumber,
            matricule: entry.worker.matricule,
            cinNumber: entry.worker.cinNumber ?? "",
            designation: `${entry.subActivityLabel} ${periodLabel}`,
            quantity: formatQuantity(entry.quantity),
            unit: entry.unit,
            unitPrice: formatMoney(entry.unitRate),
            amount: formatMoney(entry.amount),
            isiAmount: formatMoney(lineIsiValue),
            netAmount: formatMoney(entry.amount.sub(lineIsiValue)),
          };
        });
      gross = gross.add(subtotal);
      isi = isi.add(isiSubtotal);
      return {
        code,
        label: entries[0].category.label,
        isiRate: ratePercentLabel(bordereau.isiRate),
        lines,
        subtotal: formatMoney(subtotal),
        isiSubtotal: formatMoney(isiSubtotal),
        netSubtotal: formatMoney(subtotal.sub(isiSubtotal)),
      };
    });

  const adjustments = await prisma.paymentAdjustment.findMany({
    where: { bordereauId },
    include: {
      payment: {
        select: {
          workerId: true,
          worker: { select: { matricule: true, cinNumber: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  if (adjustments.length > 0) {
    let adjustmentSubtotal = new Prisma.Decimal(0);
    let adjustmentIsi = new Prisma.Decimal(0);
    const adjustmentLines: BordereauInvoiceLine[] = adjustments.map((adjustment) => {
      const adjustmentLineIsi = lineIsi(adjustment.amount, isiSettings);
      adjustmentSubtotal = adjustmentSubtotal.add(adjustment.amount);
      adjustmentIsi = adjustmentIsi.add(adjustmentLineIsi);
      workerIds.add(adjustment.payment.workerId);
      rowNumber += 1;
      return {
        rowNumber,
        matricule: adjustment.payment.worker.matricule,
        cinNumber: adjustment.payment.worker.cinNumber ?? "",
        designation: `Ajustement manuel — ${adjustment.reason}`,
        quantity: "",
        unit: "",
        unitPrice: "",
        amount: formatMoney(adjustment.amount),
        isiAmount: formatMoney(adjustmentLineIsi),
        netAmount: formatMoney(adjustment.amount.sub(adjustmentLineIsi)),
      };
    });
    activities.push({
      code: "AJ",
      label: "Ajustements manuels",
      isiRate: ratePercentLabel(bordereau.isiRate),
      lines: adjustmentLines,
      subtotal: formatMoney(adjustmentSubtotal),
      isiSubtotal: formatMoney(adjustmentIsi),
      netSubtotal: formatMoney(adjustmentSubtotal.sub(adjustmentIsi)),
    });
    gross = gross.add(adjustmentSubtotal);
    isi = isi.add(adjustmentIsi);
  }

  const net = gross.sub(isi);
  const now = new Date();
  return {
    viewModel: {
      invoiceNumber: `${pad2(bordereau.number)}/${bordereau.referenceYear}/${bordereau.site.shortCode}`,
      invoiceDate: now.toLocaleDateString("fr-FR"),
      generatedAt: now.toLocaleString("fr-FR"),
      version: bordereau.version,
      motif,
      periodLabel: `${bordereau.periodIso} ${bordereau.referenceYear}`,
      client: INVOICE_CLIENT,
      site: bordereau.site,
      activities,
      totals: {
        workerCount: workerIds.size,
        gross: formatMoney(gross),
        isi: formatMoney(isi),
        net: formatMoney(net),
      },
      isiRate: ratePercentLabel(bordereau.isiRate),
    },
    totals: {
      gross: gross.toString(),
      isi: isi.toString(),
      net: net.toString(),
      workerCount: workerIds.size,
    },
  };
}

export interface EnsureInvoiceOptions {
  force?: boolean;
  /** Pourquoi le PDF est (re)généré : conservé dans l'historique des révisions. */
  reason?: string;
  userId?: string | null;
}

export async function ensureInvoice(bordereauId: string, options: EnsureInvoiceOptions = {}) {
  const existing = await prisma.bordereauInvoice.findUnique({ where: { bordereauId } });
  if (existing && !options.force) return existing;

  const data = await buildInvoiceData(bordereauId);
  if (!data) return existing;

  const buffer = await htmlToPdfBuffer(renderBordereauInvoiceHtml(data.viewModel));
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15);
  const fileKey = `invoices/bordereaux/${bordereauId}/${stamp}.pdf`;
  await minioClient.putObject(BUCKETS.reports, fileKey, buffer, buffer.length, {
    "Content-Type": "application/pdf",
  });

  const figures = {
    fileKey,
    workerCount: data.totals.workerCount,
    gross: data.totals.gross,
    isi: data.totals.isi,
    net: data.totals.net,
  };

  // La ligne courante et son historique bougent ensemble : sans révision, un PDF écrasé serait perdu
  // pour l'application (le fichier resterait dans MinIO sans plus aucune référence).
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.bordereauInvoice.upsert({
      where: { bordereauId },
      create: { bordereauId, ...figures },
      update: figures,
    });
    const last = await tx.bordereauInvoiceRevision.aggregate({
      where: { invoiceId: invoice.id },
      _max: { revision: true },
    });
    await tx.bordereauInvoiceRevision.create({
      data: {
        invoiceId: invoice.id,
        revision: (last._max.revision ?? 0) + 1,
        ...figures,
        reason: options.reason ?? (existing ? "Régénération" : "Génération initiale"),
        createdById: options.userId ?? null,
      },
    });
    return invoice;
  });
}

export async function ensureInvoiceQuietly(
  bordereauId: string,
  force = false,
  reason?: string,
): Promise<void> {
  try {
    await ensureInvoice(bordereauId, { force, reason });
  } catch (err) {
    logger.error({ err, bordereauId }, "bordereau invoice generation failed");
  }
}

export async function openInvoice(bordereauId: string, user: AuthUser) {
  const bordereau = await prisma.bordereau.findUnique({
    where: { id: bordereauId },
    include: { site: { select: { shortCode: true } } },
  });
  if (!bordereau) throw new ApiError(404, "NOT_FOUND", "Bordereau introuvable");
  assertBordereauSite(user, bordereau.siteId);

  const invoice = await ensureInvoice(bordereauId);
  if (!invoice) {
    throw new ApiError(404, "INVOICE_UNAVAILABLE", "Aucune facture disponible pour ce bordereau");
  }

  await writeAuditLog({
    userId: user.sub,
    action: "DOWNLOAD",
    entityType: "BordereauInvoice",
    entityId: invoice.id,
    after: { bordereauId, version: bordereau.version },
  });

  return {
    stream: await getReportStream(invoice.fileKey),
    filename: `Facture_${bordereau.site.shortCode}_${bordereau.periodIso}_${bordereau.referenceYear}_n${bordereau.number}_v${bordereau.version}.pdf`,
  };
}

export async function regenerateInvoice(bordereauId: string, user: AuthUser) {
  const bordereau = await prisma.bordereau.findUnique({ where: { id: bordereauId } });
  if (!bordereau) throw new ApiError(404, "NOT_FOUND", "Bordereau introuvable");
  assertBordereauSite(user, bordereau.siteId);
  if (bordereau.status !== "GENERATED" && bordereau.status !== "FINANCE_VALIDATED") {
    throw new ApiError(
      409,
      "INVOICE_FROZEN",
      "La facture ne peut plus changer : le bordereau est validé par le DG, exporté ou remplacé",
    );
  }
  const invoice = await ensureInvoice(bordereauId, {
    force: true,
    reason: "Régénération manuelle",
    userId: user.sub,
  });
  if (!invoice) {
    throw new ApiError(404, "INVOICE_UNAVAILABLE", "Aucune facture disponible pour ce bordereau");
  }
  await writeAuditLog({
    userId: user.sub,
    action: "REGENERATE_INVOICE",
    entityType: "BordereauInvoice",
    entityId: invoice.id,
    after: { bordereauId, version: bordereau.version },
  });
  return invoice;
}

async function loadBordereauForInvoice(bordereauId: string, user: AuthUser) {
  const bordereau = await prisma.bordereau.findUnique({
    where: { id: bordereauId },
    include: { site: { select: { shortCode: true } }, invoice: { select: { id: true } } },
  });
  if (!bordereau) throw new ApiError(404, "NOT_FOUND", "Bordereau introuvable");
  assertBordereauSite(user, bordereau.siteId);
  return bordereau;
}

/** Historique des PDF de la facture d'un bordereau, du plus récent au plus ancien. */
export async function listInvoiceRevisions(bordereauId: string, user: AuthUser) {
  const bordereau = await loadBordereauForInvoice(bordereauId, user);
  if (!bordereau.invoice) return [];

  const revisions = await prisma.bordereauInvoiceRevision.findMany({
    where: { invoiceId: bordereau.invoice.id },
    orderBy: { revision: "desc" },
  });
  const authorIds = [
    ...new Set(revisions.map((r) => r.createdById).filter((id): id is string => !!id)),
  ];
  const authors = authorIds.length
    ? await basePrisma.user.findMany({
        where: { id: { in: authorIds } },
        select: { id: true, firstName: true, lastName: true },
      })
    : [];
  const nameOf = new Map(authors.map((a) => [a.id, `${a.firstName} ${a.lastName}`]));

  return revisions.map((revision, index) => ({
    id: revision.id,
    revision: revision.revision,
    current: index === 0,
    reason: revision.reason,
    createdAt: revision.createdAt,
    createdBy: revision.createdById ? (nameOf.get(revision.createdById) ?? null) : null,
    workerCount: revision.workerCount,
    gross: revision.gross.toString(),
    isi: revision.isi.toString(),
    net: revision.net.toString(),
  }));
}

/** PDF d'une révision précise de la facture : téléchargement tracé dans l'audit. */
export async function openInvoiceRevision(bordereauId: string, revisionId: string, user: AuthUser) {
  const bordereau = await loadBordereauForInvoice(bordereauId, user);
  const revision = bordereau.invoice
    ? await prisma.bordereauInvoiceRevision.findFirst({
        where: { id: revisionId, invoiceId: bordereau.invoice.id },
      })
    : null;
  if (!revision) throw new ApiError(404, "NOT_FOUND", "Version de facture introuvable");

  await writeAuditLog({
    userId: user.sub,
    action: "DOWNLOAD",
    entityType: "BordereauInvoice",
    entityId: revision.invoiceId,
    after: { bordereauId, version: bordereau.version, revision: revision.revision },
  });

  return {
    stream: await getReportStream(revision.fileKey),
    filename: `Facture_${bordereau.site.shortCode}_${bordereau.periodIso}_${bordereau.referenceYear}_n${bordereau.number}_v${bordereau.version}_r${revision.revision}.pdf`,
  };
}
