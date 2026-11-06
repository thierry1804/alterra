import ExcelJS from "exceljs";
import type { Payment, Worker } from "@prisma/client";
import { PaymentReconciliationStatus, PaymentStatus } from "@prisma/client";
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
  version: number;
}

function formatExportTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}`;
}

type PaymentWithWorker = Payment & { worker: Worker };

/** Construit le classeur MVola (mêmes colonnes pour un export initial et une régénération). */
async function buildMvolaWorkbook(
  payments: PaymentWithWorker[],
  shortPeriod: string,
  includeHeader: boolean | undefined,
): Promise<Buffer> {
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

  for (const payment of payments) {
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

  if (!includeHeader) {
    sheet.spliceRows(1, 1);
  }

  const rawBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(rawBuffer);
}

/** Numéro de version suivant pour un bordereau (1 au premier export de la période). */
async function nextBatchVersion(periodIso: string, referenceYear?: number): Promise<number> {
  const last = await prisma.mvolaExportBatch.findFirst({
    where: { periodIso, referenceYear },
    orderBy: { version: "desc" },
  });
  return (last?.version ?? 0) + 1;
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
  const exportableIds = exportable.map((payment) => payment.id);
  const claimed = await prisma.payment.updateMany({
    where: { id: { in: exportableIds }, status: PaymentStatus.PENDING },
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
  let version: number;
  let batchId: string | undefined;

  try {
    buffer = await buildMvolaWorkbook(exportable, shortPeriod, options.includeHeader);
    filename = `ALTERRA_MVola_${shortPeriod}_${formatExportTimestamp()}.xlsx`;
    minioKey = `mvola/${filename}`;

    await minioClient.putObject(BUCKETS.reports, minioKey, buffer, buffer.length, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    version = await nextBatchVersion(shortPeriod, referenceYear);
    const batch = await prisma.mvolaExportBatch.create({
      data: {
        periodIso: shortPeriod,
        referenceYear,
        version,
        fileKey: minioKey,
        filename,
        exportedCount: exportable.length,
        excludedCount,
        createdById: options.userId,
      },
    });
    batchId = batch.id;

    await prisma.payment.updateMany({
      where: { id: { in: exportableIds } },
      data: { exportBatchId: batch.id },
    });
  } catch (err) {
    // La revendication a déjà eu lieu : si le fichier ou le bordereau n'a pas pu être produit,
    // les lignes ne doivent pas rester bloquées en EXPORTED sans qu'aucun fichier n'existe réellement.
    await prisma.payment.updateMany({
      where: { id: { in: exportableIds }, status: PaymentStatus.EXPORTED, exportedAt },
      data: { status: PaymentStatus.PENDING, exportedAt: null, exportBatchId: null },
    });
    if (batchId) {
      await prisma.mvolaExportBatch.deleteMany({ where: { id: batchId } }).catch(() => undefined);
    }
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
      version,
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
    version,
  };
}

/**
 * Régénère le bordereau MVola d'une période déjà exportée : reprend les lignes non confirmées
 * payées (EXPORTED ou FAILED, hors réconciliation CONFIRME), régénère le fichier avec les
 * données actuelles et crée une nouvelle version. Le bordereau précédent n'est ni modifié ni
 * supprimé — son fichier reste téléchargeable, c'est ainsi que l'historique complet est gardé.
 */
export async function regenerateMvolaExport(
  periodIso: string,
  options: {
    userId: string;
    ip?: string;
    userAgent?: string;
    referenceYear?: number;
    includeHeader?: boolean;
  },
): Promise<ExportMvolaResult> {
  const { shortPeriod, referenceYear } = resolvePeriod(periodIso, undefined, options.referenceYear);

  const previousBatch = await prisma.mvolaExportBatch.findFirst({
    where: { periodIso: shortPeriod, referenceYear },
    orderBy: { version: "desc" },
  });
  if (!previousBatch) {
    throw new ApiError(
      404,
      "NO_PREVIOUS_EXPORT",
      "Aucun bordereau déjà exporté pour cette période — faites un premier export MVola.",
    );
  }

  // reconciliationStatus est nullable : un simple `{ not: CONFIRME }` Prisma exclurait aussi les
  // lignes jamais rapprochées (NULL n'est jamais "distinct" de rien en SQL à trois valeurs). D'où
  // le filtre explicite ci-dessous plutôt que `{ not: ... }` dans le where.
  const candidates = await prisma.payment.findMany({
    where: {
      periodIso: shortPeriod,
      referenceYear,
      status: { in: [PaymentStatus.EXPORTED, PaymentStatus.FAILED] },
    },
    include: { worker: true },
  });
  const eligible = candidates.filter(
    (payment) => payment.reconciliationStatus !== PaymentReconciliationStatus.CONFIRME,
  );

  if (eligible.length === 0) {
    throw new ApiError(
      422,
      "NOTHING_TO_REGENERATE",
      "Toutes les lignes de cette période sont déjà confirmées payées — rien à régénérer.",
    );
  }

  const invalidMvola = eligible.filter((payment) => !isValidMvolaNumber(payment.worker.mvolaNumber));
  if (invalidMvola.length > 0) {
    throw new ApiError(
      422,
      "INVALID_MVOLA_NUMBER",
      "Numéros MVola invalides sur des lignes à régénérer",
      { workerIds: invalidMvola.map((payment) => payment.workerId) },
    );
  }

  const buffer = await buildMvolaWorkbook(eligible, shortPeriod, options.includeHeader);
  const filename = `ALTERRA_MVola_${shortPeriod}_v${previousBatch.version + 1}_${formatExportTimestamp()}.xlsx`;
  const minioKey = `mvola/${filename}`;

  await minioClient.putObject(BUCKETS.reports, minioKey, buffer, buffer.length, {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const version = previousBatch.version + 1;
  const batch = await prisma.mvolaExportBatch.create({
    data: {
      periodIso: shortPeriod,
      referenceYear,
      version,
      fileKey: minioKey,
      filename,
      exportedCount: eligible.length,
      excludedCount: 0,
      createdById: options.userId,
    },
  });

  await prisma.payment.updateMany({
    where: { id: { in: eligible.map((payment) => payment.id) } },
    data: {
      status: PaymentStatus.EXPORTED,
      exportedAt: new Date(),
      failureReason: null,
      exportBatchId: batch.id,
    },
  });

  await writeAuditLog({
    userId: options.userId,
    action: "REGENERATE_EXPORT",
    entityType: "Payment",
    after: {
      periodIso: shortPeriod,
      exportedCount: eligible.length,
      filename,
      minioKey,
      version,
      previousVersion: previousBatch.version,
    },
    ip: options.ip,
    userAgent: options.userAgent,
  });

  return {
    filename,
    buffer,
    exportedCount: eligible.length,
    minioKey,
    excludedCount: 0,
    version,
  };
}
