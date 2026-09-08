import { WorkerStatus } from "@prisma/client";
import type ExcelJS from "exceljs";
import { prisma } from "../../lib/prisma.js";
import { loadXlsxWorkbook } from "./excel-workbook.js";
import {
  columnLetterToIndex,
  detectColumns,
  parseOptionalIntField,
  type DetectedColumn,
} from "./excel-utils.js";
import {
  WORKER_IMPORT_FIELDS,
  WORKER_IMPORT_REQUIRED_FIELDS,
  type WorkerImportColumnMapping,
  type WorkerImportFieldKey,
} from "./worker-import-fields.js";
import { suggestColumnMapping } from "./suggest-column-mapping.js";

export interface ImportRowError {
  row: number;
  field: string;
  message: string;
}

export interface ParseWorkersOptions {
  hasHeaderRow?: boolean;
  referenceRowNumber?: number;
  mapping?: WorkerImportColumnMapping;
}

export interface ValidImportRow {
  row: number;
  matricule: string;
  legacyMocId?: number;
  firstName: string;
  lastName: string;
  mvolaNumber: string;
  siteId: string;
  teamId?: string;
  cinNumber?: string;
  address?: string;
  hiredAt: Date;
  status: WorkerStatus;
  existingWorkerId?: string;
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
    return new Date();
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    errors.push({ row, field: "hiredAt", message: "Date d'embauche invalide" });
    return null;
  }
  return parsed;
}

async function nextFallbackMatriculeNumber(
  siteCode: string,
  counters: Map<string, number>,
): Promise<number> {
  if (!counters.has(siteCode)) {
    const site = await prisma.site.findFirst({
      where: { shortCode: siteCode },
      select: { id: true },
    });
    const existingCount = site
      ? await prisma.worker.count({ where: { siteId: site.id, deletedAt: null } })
      : 0;
    counters.set(siteCode, existingCount);
  }
  const next = counters.get(siteCode)! + 1;
  counters.set(siteCode, next);
  return next;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function detectFileDuplicates(rows: ValidImportRow[]): ImportRowError[] {
  const errors: ImportRowError[] = [];
  const matriculeRows = new Map<string, number[]>();
  const mvolaRows = new Map<string, number[]>();

  for (const row of rows) {
    const matriculeKey = row.matricule.toLowerCase();
    const matriculeList = matriculeRows.get(matriculeKey) ?? [];
    matriculeList.push(row.row);
    matriculeRows.set(matriculeKey, matriculeList);

    const mvolaList = mvolaRows.get(row.mvolaNumber) ?? [];
    mvolaList.push(row.row);
    mvolaRows.set(row.mvolaNumber, mvolaList);
  }

  for (const [matricule, rowNumbers] of matriculeRows) {
    if (rowNumbers.length <= 1) continue;
    for (const row of rowNumbers) {
      errors.push({
        row,
        field: "matricule",
        message: `Matricule dupliqué dans le fichier (${matricule})`,
      });
    }
  }

  for (const [mvola, rowNumbers] of mvolaRows) {
    if (rowNumbers.length <= 1) continue;
    for (const row of rowNumbers) {
      errors.push({
        row,
        field: "mvolaNumber",
        message: `Numéro MVola dupliqué dans le fichier (${mvola})`,
      });
    }
  }

  return errors;
}

async function validateRowsAgainstDb(rows: ValidImportRow[]): Promise<ImportRowError[]> {
  if (rows.length === 0) return [];

  const errors: ImportRowError[] = [];
  const siteIds = [...new Set(rows.map((r) => r.siteId))];
  const teamIds = [...new Set(rows.map((r) => r.teamId).filter(Boolean))] as string[];
  const matricules = rows.map((r) => r.matricule);
  const mvolaNumbers = rows.map((r) => r.mvolaNumber);

  const [sites, teams, existingWorkers] = await Promise.all([
    prisma.site.findMany({ where: { id: { in: siteIds } }, select: { id: true } }),
    teamIds.length > 0
      ? prisma.team.findMany({ where: { id: { in: teamIds } }, select: { id: true } })
      : Promise.resolve([]),
    prisma.worker.findMany({
      where: {
        deletedAt: null,
        OR: [{ matricule: { in: matricules } }, { mvolaNumber: { in: mvolaNumbers } }],
      },
      select: { id: true, matricule: true, mvolaNumber: true },
    }),
  ]);

  const knownSiteIds = new Set(sites.map((s) => s.id));
  const knownTeamIds = new Set(teams.map((t) => t.id));
  const workerByMvola = new Map(existingWorkers.map((w) => [w.mvolaNumber, w]));
  const workerByMatricule = new Map(
    existingWorkers.map((w) => [w.matricule.toLowerCase(), w]),
  );

  for (const row of rows) {
    if (!knownSiteIds.has(row.siteId)) {
      errors.push({ row: row.row, field: "siteId", message: "Site introuvable" });
    }
    if (row.teamId && !knownTeamIds.has(row.teamId)) {
      errors.push({ row: row.row, field: "teamId", message: "Équipe introuvable" });
    }

    const existingByMvola = workerByMvola.get(row.mvolaNumber);
    const existingByMatricule = workerByMatricule.get(row.matricule.toLowerCase());

    if (existingByMvola) {
      if (existingByMatricule && existingByMatricule.id !== existingByMvola.id) {
        errors.push({
          row: row.row,
          field: "matricule",
          message: "Matricule déjà utilisé par un autre travailleur",
        });
      } else {
        row.existingWorkerId = existingByMvola.id;
      }
    } else if (existingByMatricule) {
      errors.push({ row: row.row, field: "matricule", message: "Matricule déjà en base" });
    }
  }

  return errors;
}

async function resolveSiteShortCodes(rows: ValidImportRow[]): Promise<ImportRowError[]> {
  const codes = [...new Set(rows.map((r) => r.siteId))];
  const sites = await prisma.site.findMany({
    where: { shortCode: { in: codes } },
    select: { id: true, shortCode: true },
  });
  const byCode = new Map(sites.map((s) => [s.shortCode, s.id]));

  const errors: ImportRowError[] = [];
  for (const row of rows) {
    const resolved = byCode.get(row.siteId);
    if (!resolved) {
      errors.push({
        row: row.row,
        field: "siteShortCode",
        message: `Site introuvable (${row.siteId})`,
      });
      continue;
    }
    row.siteId = resolved;
  }
  return errors;
}

export async function parseWorkersWorkbook(
  buffer: Buffer,
  options: ParseWorkersOptions = {},
): Promise<ImportPreviewResult> {
  const workbook = await loadXlsxWorkbook(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { valid: [], errors: [{ row: 0, field: "sheet", message: "Feuille Excel introuvable" }] };
  }

  const { mapping } = options;
  const usingSiteShortCode = Boolean(mapping);
  const hasHeaderRow = options.hasHeaderRow ?? true;
  const referenceRowNumber = options.referenceRowNumber ?? 1;
  const headerMap = new Map<string, number>();
  const errors: ImportRowError[] = [];
  let dataStartRow: number;

  if (mapping) {
    dataStartRow = hasHeaderRow ? referenceRowNumber + 1 : referenceRowNumber;

    const missingRequired = WORKER_IMPORT_REQUIRED_FIELDS.filter((field) => !mapping[field]);
    errors.push(
      ...missingRequired.map((field) => ({
        row: 1,
        field,
        message: `Colonne obligatoire non mappée: ${field}`,
      })),
    );

    for (const { key } of WORKER_IMPORT_FIELDS) {
      const letter = mapping[key];
      if (!letter) continue;
      const colIndex = columnLetterToIndex(letter);
      if (colIndex < 1) {
        errors.push({ row: 1, field: key, message: `Lettre de colonne invalide (${letter})` });
        continue;
      }
      headerMap.set(key, colIndex);
    }

    if (errors.length > 0) {
      return { valid: [], errors };
    }
  } else {
    dataStartRow = 2;
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell, col) => {
      const key = normalizeHeader(cellText(cell.value));
      if (key) headerMap.set(key, col);
    });

    const missingHeaders = REQUIRED_HEADERS.filter((h) => !headerMap.has(h));
    errors.push(
      ...missingHeaders.map((field) => ({
        row: 1,
        field,
        message: `Colonne obligatoire manquante: ${field}`,
      })),
    );

    if (missingHeaders.length > 0) {
      return { valid: [], errors };
    }
  }

  const valid: ValidImportRow[] = [];
  const fallbackMatriculeCounters = new Map<string, number>();

  for (let rowNumber = dataStartRow; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber);
    const values = Object.fromEntries(
      [...headerMap.entries()].map(([key, col]) => [key, cellText(row.getCell(col).value)]),
    ) as Record<string, string>;

    const hasData = Object.values(values).some((v) => v.length > 0);
    if (!hasData) continue;

    const rowErrors: ImportRowError[] = [];

    if (!usingSiteShortCode && !values.matricule) {
      rowErrors.push({ row: rowNumber, field: "matricule", message: "Requis" });
    }
    if (!values.firstName) rowErrors.push({ row: rowNumber, field: "firstName", message: "Requis" });
    if (!values.lastName) rowErrors.push({ row: rowNumber, field: "lastName", message: "Requis" });
    if (!values.mvolaNumber || values.mvolaNumber.length < 9) {
      rowErrors.push({ row: rowNumber, field: "mvolaNumber", message: "Numéro MVola invalide (min 9)" });
    }
    let siteCode = "";
    if (usingSiteShortCode) {
      siteCode = values.siteShortCode?.trim().toUpperCase();
      if (!siteCode || !/^[A-Z]{2,3}$/.test(siteCode)) {
        rowErrors.push({
          row: rowNumber,
          field: "siteShortCode",
          message: "Code site invalide (2-3 lettres, ex. MNK)",
        });
      }
    } else if (!values.siteId || !isUuid(values.siteId)) {
      rowErrors.push({ row: rowNumber, field: "siteId", message: "UUID site invalide" });
    }
    if (values.teamId && !isUuid(values.teamId)) {
      rowErrors.push({ row: rowNumber, field: "teamId", message: "UUID équipe invalide" });
    }

    const legacyMocId = parseOptionalIntField(values.legacyMocId, rowNumber, "legacyMocId", rowErrors);
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

    let matricule = values.matricule;
    if (!matricule && usingSiteShortCode) {
      matricule =
        legacyMocId !== undefined
          ? `MOC-${siteCode}-L${legacyMocId}`
          : `MOC-${siteCode}-R${String(await nextFallbackMatriculeNumber(siteCode, fallbackMatriculeCounters)).padStart(3, "0")}`;
    }

    valid.push({
      row: rowNumber,
      matricule,
      legacyMocId,
      firstName: values.firstName,
      lastName: values.lastName,
      mvolaNumber: values.mvolaNumber,
      siteId: usingSiteShortCode ? siteCode : values.siteId,
      teamId: values.teamId || undefined,
      cinNumber: values.cinNumber || undefined,
      address: values.address || undefined,
      hiredAt: hiredAt!,
      status: status ?? WorkerStatus.ACTIVE,
    });
  }

  if (usingSiteShortCode && valid.length > 0) {
    errors.push(...(await resolveSiteShortCodes(valid)));
  }

  errors.push(...detectFileDuplicates(valid));

  const rowsWithoutFileDupes = valid.filter(
    (row) =>
      !errors.some(
        (e) =>
          e.row === row.row &&
          (e.field === "matricule" || e.field === "mvolaNumber" || e.field === "siteShortCode"),
      ),
  );

  const dbErrors = await validateRowsAgainstDb(rowsWithoutFileDupes);
  errors.push(...dbErrors);

  const invalidRows = new Set(errors.map((e) => e.row));
  const finalValid = valid.filter((row) => !invalidRows.has(row.row));

  return { valid: finalValid, errors };
}

export interface DetectWorkersColumnsResult {
  columns: DetectedColumn[];
  fields: typeof WORKER_IMPORT_FIELDS;
  suggestedMapping: Partial<Record<WorkerImportFieldKey, string>>;
}

export async function detectWorkersImportColumns(
  buffer: Buffer,
  hasHeaderRow: boolean,
  referenceRowNumber = 1,
): Promise<DetectWorkersColumnsResult> {
  const workbook = await loadXlsxWorkbook(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return { columns: [], fields: WORKER_IMPORT_FIELDS, suggestedMapping: {} };
  }
  const columns = detectColumns(sheet, hasHeaderRow, referenceRowNumber);
  const suggestedMapping = hasHeaderRow ? suggestColumnMapping(columns) : {};
  return {
    columns,
    fields: WORKER_IMPORT_FIELDS,
    suggestedMapping,
  };
}

export async function importWorkersRows(rows: ValidImportRow[]) {
  return prisma.$transaction(async (tx) => {
    const created = [];
    const updated = [];
    for (const row of rows) {
      const data = {
        matricule: row.matricule,
        legacyMocId: row.legacyMocId,
        firstName: row.firstName,
        lastName: row.lastName,
        mvolaNumber: row.mvolaNumber,
        siteId: row.siteId,
        teamId: row.teamId,
        cinNumber: row.cinNumber,
        address: row.address,
        hiredAt: row.hiredAt,
        status: row.status,
      };

      if (row.existingWorkerId) {
        const worker = await tx.worker.update({ where: { id: row.existingWorkerId }, data });
        updated.push(worker);
      } else {
        const worker = await tx.worker.create({ data });
        created.push(worker);
      }
    }
    return { created, updated };
  });
}
