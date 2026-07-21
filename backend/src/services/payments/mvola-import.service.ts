import ExcelJS from "exceljs";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolvePeriod } from "../../lib/period-iso.js";
import { ApiError } from "../../middleware/error-handler.js";

export interface MvolaImportRow {
  line: number;
  phone: string;
  amount: number;
  success: boolean;
  failureReason?: string;
}

export interface ImportMvolaStatusResult {
  periodIso: string;
  paid: number;
  failed: number;
  skippedAlreadyFinal: number;
  unmatched: MvolaImportRow[];
  duplicates: Array<{ line: number; phone: string; amount: number; paymentIds: string[] }>;
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
  }
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function normalizePhone(value: string): string {
  return value.replace(/\s+/g, "").replace(/^\+261/, "0");
}

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const index = normalized.indexOf(normalizeHeader(candidate));
    if (index >= 0) return index;
  }
  return -1;
}

function parseSuccessStatus(raw: string): boolean | null {
  const value = raw.trim().toUpperCase();
  if (!value) return null;
  if (["SUCCESS", "SUCCES", "OK", "PAID", "PAYE", "PAYÉ"].includes(value)) return true;
  if (["FAILED", "FAIL", "ECHEC", "ÉCHEC", "REJECTED", "REJETE", "REJETÉ", "KO"].includes(value)) {
    return false;
  }
  return null;
}

export async function parseMvolaReturnWorkbook(buffer: Buffer): Promise<MvolaImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new ApiError(422, "IMPORT_BADFORMAT", "Workbook has no worksheet");
  }

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber - 1] = cellText(cell.value);
  });

  const phoneCol = findColumnIndex(headers, [
    "Numéro téléphone",
    "Numero telephone",
    "MSISDN",
    "Telephone",
  ]);
  const amountCol = findColumnIndex(headers, ["Montant", "Amount"]);
  const statusCol = findColumnIndex(headers, [
    "Statut transaction",
    "Statut",
    "Status",
    "Resultat",
  ]);
  const reasonCol = findColumnIndex(headers, ["Motif échec", "Motif echec", "Motif", "Reason"]);

  if (phoneCol < 0 || amountCol < 0 || statusCol < 0) {
    throw new ApiError(
      422,
      "IMPORT_BADFORMAT",
      "Missing required columns (phone, amount, status)",
      { headers },
    );
  }

  const rows: MvolaImportRow[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const phone = normalizePhone(cellText(row.getCell(phoneCol + 1).value));
    const amountRaw = cellText(row.getCell(amountCol + 1).value).replace(/[^\d.-]/g, "");
    const amount = Math.round(Number(amountRaw));
    const statusRaw = cellText(row.getCell(statusCol + 1).value);
    const success = parseSuccessStatus(statusRaw);

    if (!phone || !Number.isFinite(amount) || success === null) {
      throw new ApiError(422, "IMPORT_BADFORMAT", `Invalid row ${rowNumber}`, {
        line: rowNumber,
        phone,
        amount,
        status: statusRaw,
      });
    }

    const failureReason =
      success === false && reasonCol >= 0
        ? cellText(row.getCell(reasonCol + 1).value) || statusRaw
        : success === false
          ? statusRaw
          : undefined;

    rows.push({
      line: rowNumber,
      phone,
      amount,
      success,
      failureReason,
    });
  });

  return rows;
}

export async function importMvolaStatus(
  buffer: Buffer,
  periodIso: string,
  referenceYear?: number,
): Promise<ImportMvolaStatusResult> {
  const { shortPeriod } = resolvePeriod(periodIso, undefined, referenceYear);
  const parsedRows = await parseMvolaReturnWorkbook(buffer);

  const payments = await prisma.payment.findMany({
    where: {
      periodIso: shortPeriod,
      status: { in: [PaymentStatus.EXPORTED, PaymentStatus.PAID, PaymentStatus.FAILED] },
    },
    include: { worker: true },
  });

  let paid = 0;
  let failed = 0;
  let skippedAlreadyFinal = 0;
  const unmatched: MvolaImportRow[] = [];
  const duplicates: ImportMvolaStatusResult["duplicates"] = [];

  for (const row of parsedRows) {
    const matches = payments.filter(
      (payment) =>
        payment.worker.mvolaNumber === row.phone &&
        Math.round(Number(payment.amount)) === row.amount,
    );

    if (matches.length === 0) {
      unmatched.push(row);
      continue;
    }

    if (matches.length > 1) {
      duplicates.push({
        line: row.line,
        phone: row.phone,
        amount: row.amount,
        paymentIds: matches.map((payment) => payment.id),
      });
      continue;
    }

    const payment = matches[0];
    const targetStatus = row.success ? PaymentStatus.PAID : PaymentStatus.FAILED;

    if (payment.status === targetStatus) {
      skippedAlreadyFinal += 1;
      continue;
    }

    if (payment.status === PaymentStatus.PAID || payment.status === PaymentStatus.FAILED) {
      skippedAlreadyFinal += 1;
      continue;
    }

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: targetStatus,
        paidAt: targetStatus === PaymentStatus.PAID ? new Date() : null,
        failureReason:
          targetStatus === PaymentStatus.FAILED ? row.failureReason ?? "MVola failed" : null,
      },
    });

    payment.status = targetStatus;

    if (targetStatus === PaymentStatus.PAID) {
      paid += 1;
    } else {
      failed += 1;
    }
  }

  return {
    periodIso: shortPeriod,
    paid,
    failed,
    skippedAlreadyFinal,
    unmatched,
    duplicates,
  };
}
