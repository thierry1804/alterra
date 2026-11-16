import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolvePeriod } from "../../lib/period-iso.js";
import { INVOICE_CLIENT, ISI_WITHHOLDING_RATE } from "../../lib/invoice-client.js";
import { ApiError } from "../../middleware/error-handler.js";
import { BUCKETS, minioClient } from "../storage/minio.js";
import { getReportStream } from "../storage/presigned-url.service.js";
import { htmlToPdfBuffer, renderBordereauInvoiceHtml } from "../reports/pdf-render.service.js";
import { writeAuditLog } from "../audit/audit.service.js";
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
    const key = `${pointage.workerId}|${pointage.subActivityId}|${pointage.unitRateSnapshot.toString()}`;
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

  const rate = new Prisma.Decimal(ISI_WITHHOLDING_RATE);
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
          const lineIsi = entry.amount.mul(rate);
          subtotal = subtotal.add(entry.amount);
          isiSubtotal = isiSubtotal.add(lineIsi);
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
            isiAmount: formatMoney(lineIsi),
            netAmount: formatMoney(entry.amount.sub(lineIsi)),
          };
        });
      gross = gross.add(subtotal);
      isi = isi.add(isiSubtotal);
      return {
        code,
        label: entries[0].category.label,
        isiRate: String(Number(ISI_WITHHOLDING_RATE) * 100),
        lines,
        subtotal: formatMoney(subtotal),
        isiSubtotal: formatMoney(isiSubtotal),
        netSubtotal: formatMoney(subtotal.sub(isiSubtotal)),
      };
    });

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
      isiRate: String(Number(ISI_WITHHOLDING_RATE) * 100),
    },
    totals: {
      gross: gross.toString(),
      isi: isi.toString(),
      net: net.toString(),
      workerCount: workerIds.size,
    },
  };
}

export async function ensureInvoice(bordereauId: string, options: { force?: boolean } = {}) {
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

  return prisma.bordereauInvoice.upsert({
    where: { bordereauId },
    create: {
      bordereauId,
      fileKey,
      workerCount: data.totals.workerCount,
      gross: data.totals.gross,
      isi: data.totals.isi,
      net: data.totals.net,
    },
    update: {
      fileKey,
      workerCount: data.totals.workerCount,
      gross: data.totals.gross,
      isi: data.totals.isi,
      net: data.totals.net,
    },
  });
}

export async function ensureInvoiceQuietly(bordereauId: string): Promise<void> {
  try {
    await ensureInvoice(bordereauId);
  } catch (err) {
    console.error("bordereau invoice generation failed", bordereauId, err);
  }
}

export async function getInvoiceTotals(
  bordereauId: string,
): Promise<BordereauInvoiceTotals | null> {
  const stored = await prisma.bordereauInvoice.findUnique({ where: { bordereauId } });
  if (stored) {
    return {
      gross: stored.gross.toString(),
      isi: stored.isi.toString(),
      net: stored.net.toString(),
      workerCount: stored.workerCount,
    };
  }
  const data = await buildInvoiceData(bordereauId);
  return data ? data.totals : null;
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
  const invoice = await ensureInvoice(bordereauId, { force: true });
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
