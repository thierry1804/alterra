import ExcelJS from "exceljs";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolvePeriod } from "../../lib/period-iso.js";
import { ApiError } from "../../middleware/error-handler.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { BUCKETS, minioClient } from "../storage/minio.js";
import { isValidMvolaNumber } from "./mvola-description.js";
import { generateActivityInvoices } from "./activity-invoices.service.js";

/**
 * Format du fichier MVola (docs/cadrage/mvola-format.md §3.2) : `spec5` = 5 colonnes de la spécification
 * (défaut) ; `compact3` = 3 colonnes (téléphone, description, montant) si MVola refuse les colonnes internes.
 */
const MVOLA_EXPORT_FORMAT = process.env.MVOLA_EXPORT_FORMAT === "compact3" ? "compact3" : "spec5";

export interface ExportMvolaResult {
  filename: string;
  buffer: Buffer;
  exportedCount: number;
  minioKey: string;
  excludedCount: number;
}

function formatExportTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export async function exportMvolaPayments(
  periodIso: string,
  options: {
    userId: string;
    ip?: string;
    userAgent?: string;
    referenceYear?: number;
    includeHeader?: boolean;
    /** Site du travailleur (sélecteur de site global du back-office). */
    siteId?: string;
  },
): Promise<ExportMvolaResult> {
  const { shortPeriod, referenceYear, weekIso, dateFrom, dateTo } = resolvePeriod(
    periodIso,
    undefined,
    options.referenceYear,
  );

  const pendingPayments = await prisma.payment.findMany({
    where: {
      periodIso: shortPeriod,
      referenceYear,
      status: PaymentStatus.PENDING,
      ...(options.siteId ? { worker: { siteId: options.siteId } } : {}),
    },
    include: { worker: true },
  });

  const exportable = pendingPayments.filter((payment) => payment.bioValid && payment.amount.gt(0));
  const excludedCount = pendingPayments.length - exportable.length;

  if (exportable.length === 0) {
    throw new ApiError(
      422,
      "NO_EXPORTABLE_PAYMENTS",
      "Aucune ligne exportable (bio OK requise, montant > 0)",
      { excludedCount },
    );
  }

  const invalidMvola = exportable.filter(
    (payment) => !isValidMvolaNumber(payment.worker.mvolaNumber),
  );
  if (invalidMvola.length > 0) {
    throw new ApiError(
      422,
      "INVALID_MVOLA_NUMBER",
      "Numéros MVola invalides sur des lignes exportables",
      {
        workerIds: invalidMvola.map((payment) => payment.workerId),
      },
    );
  }

  // Revendique les lignes AVANT de construire le fichier (pas après) : la condition `status:
  // PENDING` dans le where fait de ce updateMany un verrou atomique — si un autre export concurrent
  // a déjà basculé ces lignes en EXPORTED entre notre lecture et ici, `count` sera inférieur à ce
  // qu'on attend et on abandonne avant de produire un second fichier MVola identique (double virement).
  const exportedAt = new Date();
  const claimed = await prisma.payment.updateMany({
    where: { id: { in: exportable.map((payment) => payment.id) }, status: PaymentStatus.PENDING },
    data: { status: PaymentStatus.EXPORTED, exportedAt },
  });
  if (claimed.count !== exportable.length) {
    throw new ApiError(
      409,
      "EXPORT_CONFLICT",
      "Un export MVola est déjà en cours ou vient d'avoir lieu pour cette période — rafraîchissez avant de réessayer",
    );
  }

  let buffer: Buffer;
  let filename: string;
  let minioKey: string;

  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Paiements");

    const compact = MVOLA_EXPORT_FORMAT === "compact3";
    sheet.columns = compact
      ? [
          { header: "Numéro téléphone", key: "phone", width: 18 },
          { header: "Description", key: "description", width: 32 },
          { header: "Montant", key: "amount", width: 12 },
        ]
      : [
          { header: "Numéro téléphone", key: "phone", width: 18 },
          { header: "Description", key: "description", width: 32 },
          { header: "Période", key: "period", width: 10 },
          { header: "Montant", key: "amount", width: 12 },
          { header: "Bio Validée", key: "bio", width: 12 },
        ];

    for (const payment of exportable) {
      const row = sheet.addRow({
        phone: payment.worker.mvolaNumber,
        description: payment.description,
        period: shortPeriod,
        amount: Math.round(Number(payment.amount)),
        // Seules les lignes bio OK sont exportables (RG-03) : la colonne vaut toujours OUI.
        bio: "OUI",
      });
      row.getCell("phone").numFmt = "@";
    }

    if (!options.includeHeader) {
      sheet.spliceRows(1, 1);
    }

    const rawBuffer = await workbook.xlsx.writeBuffer();
    buffer = Buffer.from(rawBuffer);
    filename = `ALTERRA_MVola_${shortPeriod}_${formatExportTimestamp()}.xlsx`;
    minioKey = `mvola/${filename}`;

    await minioClient.putObject(BUCKETS.reports, minioKey, buffer, buffer.length, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  } catch (err) {
    // La revendication a déjà eu lieu : si le fichier n'a pas pu être produit/envoyé, les lignes
    // ne doivent pas rester bloquées en EXPORTED sans qu'aucun fichier n'existe réellement.
    await prisma.payment.updateMany({
      where: { id: { in: exportable.map((payment) => payment.id) }, status: PaymentStatus.EXPORTED, exportedAt },
      data: { status: PaymentStatus.PENDING, exportedAt: null },
    });
    throw err;
  }

  await writeAuditLog({
    userId: options.userId,
    action: "EXPORT",
    entityType: "Payment",
    after: {
      periodIso: shortPeriod,
      exportedCount: exportable.length,
      filename,
      minioKey,
    },
    ip: options.ip,
    userAgent: options.userAgent,
  });

  // Facture par activité générée dès l'export, pour consultation immédiate dans l'admin — non
  // bloquant : une facture ratée (rendu PDF, MinIO) ne doit jamais faire échouer l'export réel.
  try {
    await generateActivityInvoices({
      shortPeriod,
      referenceYear,
      weekIso,
      dateFrom,
      dateTo,
      workerIds: exportable.map((payment) => payment.workerId),
      createdById: options.userId,
    });
  } catch (err) {
    console.error("generateActivityInvoices failed for export", shortPeriod, referenceYear, err);
  }

  return {
    filename,
    buffer,
    exportedCount: exportable.length,
    minioKey,
    excludedCount,
  };
}
