import { prisma } from "../../lib/prisma.js";
import { loadXlsxWorkbook } from "./excel-workbook.js";
import {
  buildHeaderMap,
  missingHeaders,
  rowValues,
  type ImportRowError,
} from "./excel-utils.js";

export interface ValidSiteRow {
  row: number;
  shortCode: string;
  name: string;
  location?: string;
}

export interface SitesImportPreview {
  valid: ValidSiteRow[];
  errors: ImportRowError[];
}

const REQUIRED_HEADERS = ["shortCode", "name"] as const;
const SHORT_CODE_RE = /^[A-Z]{2,3}$/;

function detectDuplicateShortCodes(rows: ValidSiteRow[]): ImportRowError[] {
  const errors: ImportRowError[] = [];
  const byCode = new Map<string, number[]>();

  for (const row of rows) {
    const list = byCode.get(row.shortCode) ?? [];
    list.push(row.row);
    byCode.set(row.shortCode, list);
  }

  for (const [code, rowNumbers] of byCode) {
    if (rowNumbers.length <= 1) continue;
    for (const row of rowNumbers) {
      errors.push({
        row,
        field: "shortCode",
        message: `Code site dupliqué dans le fichier (${code})`,
      });
    }
  }

  return errors;
}

export async function parseSitesWorkbook(buffer: Buffer): Promise<SitesImportPreview> {
  const workbook = await loadXlsxWorkbook(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return {
      valid: [],
      errors: [{ row: 0, field: "sheet", message: "Feuille Excel introuvable", sheet: "sites" }],
    };
  }

  const headerMap = buildHeaderMap(sheet);
  const errors: ImportRowError[] = missingHeaders(headerMap, REQUIRED_HEADERS).map((error) => ({
    ...error,
    sheet: "sites",
  }));

  if (errors.length > 0) return { valid: [], errors };

  const valid: ValidSiteRow[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const values = rowValues(sheet, rowNumber, headerMap);
    const hasData = Object.values(values).some((value) => value.length > 0);
    if (!hasData) continue;

    const rowErrors: ImportRowError[] = [];
    const shortCode = values.shortCode.toUpperCase();

    if (!shortCode) {
      rowErrors.push({ row: rowNumber, field: "shortCode", message: "Requis", sheet: "sites" });
    } else if (!SHORT_CODE_RE.test(shortCode)) {
      rowErrors.push({
        row: rowNumber,
        field: "shortCode",
        message: "Code site : 2 à 3 lettres majuscules (ex. MNK)",
        sheet: "sites",
      });
    }

    if (!values.name || values.name.length < 2) {
      rowErrors.push({ row: rowNumber, field: "name", message: "Nom requis (min 2)", sheet: "sites" });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    valid.push({
      row: rowNumber,
      shortCode,
      name: values.name,
      location: values.location || undefined,
    });
  }

  errors.push(...detectDuplicateShortCodes(valid));

  const invalidRows = new Set(errors.map((error) => error.row));
  return { valid: valid.filter((row) => !invalidRows.has(row.row)), errors };
}

export async function importSitesRows(rows: ValidSiteRow[], dryRun: boolean) {
  if (dryRun) {
    return rows.map((row) => ({ shortCode: row.shortCode, action: "would_upsert" as const }));
  }

  const results = [];
  for (const row of rows) {
    const site = await prisma.site.upsert({
      where: { shortCode: row.shortCode },
      update: { name: row.name, location: row.location ?? null },
      create: {
        shortCode: row.shortCode,
        name: row.name,
        location: row.location ?? null,
      },
    });
    results.push({ id: site.id, shortCode: site.shortCode, action: "upserted" as const });
  }
  return results;
}
