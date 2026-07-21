import { WorkerStatus } from "@prisma/client";
import ExcelJS from "exceljs";
import { prisma } from "../../lib/prisma.js";

export interface ImportRowError {
  row: number;
  field: string;
  message: string;
}

export interface ValidImportRow {
  row: number;
  matricule: string;
  firstName: string;
  lastName: string;
  mvolaNumber: string;
  siteId: string;
  teamId?: string;
  cinNumber?: string;
  hiredAt: Date;
  status: WorkerStatus;
}

export interface ImportPreviewResult {
  valid: ValidImportRow[];
  errors: ImportRowError[];
}

const REQUIRED_HEADERS = [
  "matricule",
  "firstName",
  "lastName",
  "mvolaNumber",
  "siteId",
  "hiredAt",
] as const;

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function normalizeHeader(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

function parseStatus(raw: string): WorkerStatus | null {
  const upper = raw.toUpperCase();
  if (upper in WorkerStatus) return upper as WorkerStatus;
  return null;
}

function parseHiredAt(raw: string, row: number, errors: ImportRowError[]): Date | null {
  if (!raw) {
    errors.push({ row, field: "hiredAt", message: "Date d'embauche requise" });
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    errors.push({ row, field: "hiredAt", message: "Date d'embauche invalide" });
    return null;
  }
  return parsed;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function parseWorkersWorkbook(buffer: Buffer): Promise<ImportPreviewResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { valid: [], errors: [{ row: 0, field: "sheet", message: "Feuille Excel introuvable" }] };
  }

  const headerRow = sheet.getRow(1);
  const headerMap = new Map<string, number>();
  headerRow.eachCell((cell, col) => {
    const key = normalizeHeader(cellText(cell.value));
    if (key) headerMap.set(key, col);
  });

  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headerMap.has(h));
  const errors: ImportRowError[] = missingHeaders.map((field) => ({
    row: 1,
    field,
    message: `Colonne obligatoire manquante: ${field}`,
  }));

  if (missingHeaders.length > 0) {
    return { valid: [], errors };
  }

  const valid: ValidImportRow[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const values = Object.fromEntries(
      [...headerMap.entries()].map(([key, col]) => [key, cellText(row.getCell(col).value)]),
    ) as Record<string, string>;

    const hasData = Object.values(values).some((v) => v.length > 0);
    if (!hasData) continue;

    const rowErrors: ImportRowError[] = [];

    if (!values.matricule) rowErrors.push({ row: rowNumber, field: "matricule", message: "Requis" });
    if (!values.firstName) rowErrors.push({ row: rowNumber, field: "firstName", message: "Requis" });
    if (!values.lastName) rowErrors.push({ row: rowNumber, field: "lastName", message: "Requis" });
    if (!values.mvolaNumber || values.mvolaNumber.length < 9) {
      rowErrors.push({ row: rowNumber, field: "mvolaNumber", message: "Numéro MVola invalide (min 9)" });
    }
    if (!values.siteId || !isUuid(values.siteId)) {
      rowErrors.push({ row: rowNumber, field: "siteId", message: "UUID site invalide" });
    }
    if (values.teamId && !isUuid(values.teamId)) {
      rowErrors.push({ row: rowNumber, field: "teamId", message: "UUID équipe invalide" });
    }

    const hiredAt = parseHiredAt(values.hiredAt, rowNumber, rowErrors);
    const statusRaw = values.status?.trim();
    const status = statusRaw ? parseStatus(statusRaw) : WorkerStatus.ACTIVE;
    if (statusRaw && !status) {
      rowErrors.push({ row: rowNumber, field: "status", message: "Statut invalide" });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    valid.push({
      row: rowNumber,
      matricule: values.matricule,
      firstName: values.firstName,
      lastName: values.lastName,
      mvolaNumber: values.mvolaNumber,
      siteId: values.siteId,
      teamId: values.teamId || undefined,
      cinNumber: values.cinNumber || undefined,
      hiredAt: hiredAt!,
      status: status ?? WorkerStatus.ACTIVE,
    });
  }

  return { valid, errors };
}

export async function importWorkersRows(rows: ValidImportRow[]) {
  return prisma.$transaction(async (tx) => {
    const created = [];
    for (const row of rows) {
      const worker = await tx.worker.create({
        data: {
          matricule: row.matricule,
          firstName: row.firstName,
          lastName: row.lastName,
          mvolaNumber: row.mvolaNumber,
          siteId: row.siteId,
          teamId: row.teamId,
          cinNumber: row.cinNumber,
          hiredAt: row.hiredAt,
          status: row.status,
        },
      });
      created.push(worker);
    }
    return created;
  });
}
