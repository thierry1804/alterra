import xlsx from "node-xlsx";
import { ApiError } from "../../middleware/error-handler.js";
import {
  indexToColumnLetter,
  columnLetterToIndex,
  type DetectedColumn,
} from "../import/excel-utils.js";
import { suggestColumnMappingGeneric } from "../import/suggest-column-mapping.js";
import {
  MVOLA_RELEVE_FIELDS,
  MVOLA_RELEVE_FIELD_ALIASES,
  type MvolaReleveFieldKey,
} from "./mvola-releve-fields.js";
import type { MvolaRawRow } from "./mvola-classify.service.js";

const DEFAULT_HEADER_ROW = 7;
const HEADER_ROW_SCAN_LIMIT = 15;

export type MvolaReleveColumnMapping = Partial<Record<MvolaReleveFieldKey, string>>;

export interface DetectMvolaReleveColumnsResult {
  columns: DetectedColumn[];
  fields: typeof MVOLA_RELEVE_FIELDS;
  suggestedMapping: MvolaReleveColumnMapping;
  referenceRowNumber: number;
}

export interface ParseMvolaReleveOptions {
  hasHeaderRow?: boolean;
  referenceRowNumber?: number;
  mapping?: MvolaReleveColumnMapping;
}

/** Numéro MVola avec l'apostrophe texte Excel retirée (ex. "'0341234567" → "0341234567"). */
export function normalizeMvolaPhone(value: string): string {
  return value?.replace(/^'/, "").trim() ?? "";
}

/** Montant conservant le signe (débit/crédit) — porteur de sens, ne jamais l'annuler avant classification. */
export function normalizeMvolaAmount(value: string): number {
  return parseFloat(value.replace(/\s/g, ""));
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

const XLSX_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // « PK » : classeur .xlsx (zip)
const XLS_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // classeur .xls (OLE2)

/** SheetJS lit aussi les CSV et le texte brut : on refuse tout ce qui n'est pas un vrai classeur Excel. */
function assertExcelWorkbook(buffer: Buffer): void {
  const isExcel =
    buffer.subarray(0, XLSX_SIGNATURE.length).equals(XLSX_SIGNATURE) ||
    buffer.subarray(0, XLS_SIGNATURE.length).equals(XLS_SIGNATURE);
  if (!isExcel) {
    throw new ApiError(
      422,
      "IMPORT_BADFORMAT",
      "Le fichier n'est pas un classeur Excel (.xls ou .xlsx) : exportez le relevé MVola au format Excel",
    );
  }
}

function loadSheetRows(buffer: Buffer): unknown[][] {
  assertExcelWorkbook(buffer);
  const sheets = xlsx.parse(buffer);
  const sheet = sheets[0];
  if (!sheet) {
    throw new ApiError(422, "IMPORT_BADFORMAT", "Le relevé MVola ne contient aucune feuille");
  }
  return sheet.data as unknown[][];
}

function detectColumnsFromRows(
  rows: unknown[][],
  hasHeaderRow: boolean,
  referenceRowNumber: number,
): DetectedColumn[] {
  const headerRowIndex = referenceRowNumber - 1;
  const dataStartIndex = hasHeaderRow ? headerRowIndex + 1 : headerRowIndex;
  const headerRow = (rows[headerRowIndex] as unknown[] | undefined) ?? [];
  const columnCount = Math.max(headerRow.length, ...rows.map((r) => r?.length ?? 0));

  const columns: DetectedColumn[] = [];
  for (let col = 0; col < columnCount; col++) {
    const headerText = hasHeaderRow ? cellText(headerRow[col]) : "";
    const letter = indexToColumnLetter(col + 1);
    const samples: string[] = [];

    for (let row = dataStartIndex; row < rows.length && samples.length < 2; row++) {
      const value = cellText((rows[row] as unknown[] | undefined)?.[col]);
      if (value) samples.push(value);
    }

    if (!headerText && samples.length === 0) continue;

    columns.push({ column: letter, label: headerText || `Colonne ${letter}`, samples });
  }

  return columns;
}

function suggestMvolaReleveMapping(columns: DetectedColumn[]): MvolaReleveColumnMapping {
  return suggestColumnMappingGeneric(columns, MVOLA_RELEVE_FIELDS, MVOLA_RELEVE_FIELD_ALIASES);
}

function detectHeaderRowNumber(rows: unknown[][]): number {
  const scanLimit = Math.min(HEADER_ROW_SCAN_LIMIT, rows.length || HEADER_ROW_SCAN_LIMIT);
  let best = DEFAULT_HEADER_ROW;
  let bestScore = -1;
  for (let row = 1; row <= scanLimit; row++) {
    const columns = detectColumnsFromRows(rows, true, row);
    const score = Object.keys(suggestMvolaReleveMapping(columns)).length;
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return best;
}

export function detectMvolaReleveColumns(
  buffer: Buffer,
  hasHeaderRow = true,
  referenceRowNumber?: number,
): DetectMvolaReleveColumnsResult {
  const rows = loadSheetRows(buffer);
  const resolvedRowNumber =
    referenceRowNumber ?? (hasHeaderRow ? detectHeaderRowNumber(rows) : DEFAULT_HEADER_ROW);
  const columns = detectColumnsFromRows(rows, hasHeaderRow, resolvedRowNumber);
  const suggestedMapping = hasHeaderRow ? suggestMvolaReleveMapping(columns) : {};

  return {
    columns,
    fields: MVOLA_RELEVE_FIELDS,
    suggestedMapping,
    referenceRowNumber: resolvedRowNumber,
  };
}

export function parseMvolaReleveWorkbook(
  buffer: Buffer,
  options: ParseMvolaReleveOptions = {},
): MvolaRawRow[] {
  const rows = loadSheetRows(buffer);
  const hasHeaderRow = options.hasHeaderRow ?? true;
  const referenceRowNumber =
    options.referenceRowNumber ?? (hasHeaderRow ? detectHeaderRowNumber(rows) : DEFAULT_HEADER_ROW);

  const mapping =
    options.mapping ??
    suggestMvolaReleveMapping(detectColumnsFromRows(rows, hasHeaderRow, referenceRowNumber));

  const missing = MVOLA_RELEVE_FIELDS.filter((field) => field.required && !mapping[field.key]);
  if (missing.length > 0) {
    throw new ApiError(
      422,
      "IMPORT_BADFORMAT",
      `Colonnes non associées : ${missing.map((f) => f.label).join(", ")}`,
    );
  }

  const columnIndex = new Map(
    Object.entries(mapping).map(([key, column]) => [key, columnLetterToIndex(column!) - 1]),
  );

  const dataStartIndex = hasHeaderRow ? referenceRowNumber : referenceRowNumber - 1;
  const parsed: MvolaRawRow[] = [];

  for (let i = dataStartIndex; i < rows.length; i++) {
    const raw = rows[i] as unknown[] | undefined;
    if (!raw || raw.every((cell) => cell == null || cell === "")) continue;

    const get = (key: MvolaReleveFieldKey) => cellText(raw[columnIndex.get(key)!]);
    const description = get("description");

    parsed.push({
      dateHeure: get("dateHeure"),
      reference: get("reference"),
      initiateur: get("initiateur"),
      destinataire: get("destinataire"),
      type: get("type"),
      description: description || null,
      montant: get("montant"),
    });
  }

  return parsed;
}
