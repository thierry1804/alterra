import type ExcelJS from "exceljs";

export interface ImportRowError {
  row: number;
  field: string;
  message: string;
  sheet?: string;
}

export function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object" && "text" in value && typeof value.text === "string") {
    return value.text.trim();
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

export function normalizeHeader(value: string): string {
  return value.trim().replace(/\s+/g, "");
}

export function buildHeaderMap(sheet: ExcelJS.Worksheet): Map<string, number> {
  const headerMap = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, col) => {
    const key = normalizeHeader(cellText(cell.value));
    if (key) headerMap.set(key, col);
  });
  return headerMap;
}

export function rowValues(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  headerMap: Map<string, number>,
): Record<string, string> {
  const row = sheet.getRow(rowNumber);
  return Object.fromEntries(
    [...headerMap.entries()].map(([key, col]) => [key, cellText(row.getCell(col).value)]),
  );
}

export function missingHeaders(
  headerMap: Map<string, number>,
  required: readonly string[],
): ImportRowError[] {
  return required
    .filter((field) => !headerMap.has(field))
    .map((field) => ({
      row: 1,
      field,
      message: `Colonne obligatoire manquante: ${field}`,
    }));
}

export function parseDateField(
  raw: string,
  row: number,
  field: string,
  errors: ImportRowError[],
): Date | null {
  if (!raw) {
    errors.push({ row, field, message: "Date requise" });
    return null;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    errors.push({ row, field, message: "Date invalide (YYYY-MM-DD)" });
    return null;
  }
  return parsed;
}

export function parseDecimalField(
  raw: string,
  row: number,
  field: string,
  errors: ImportRowError[],
): string | null {
  if (!raw) {
    errors.push({ row, field, message: "Valeur requise" });
    return null;
  }
  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    errors.push({ row, field, message: "Nombre invalide" });
    return null;
  }
  return normalized;
}
