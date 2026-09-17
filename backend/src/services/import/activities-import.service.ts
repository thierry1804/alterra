import { randomUUID } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { loadXlsxWorkbook } from "./excel-workbook.js";
import {
  buildHeaderMap,
  missingHeaders,
  parseDateField,
  parseDecimalField,
  rowValues,
  type ImportRowError,
} from "./excel-utils.js";

export interface ValidActivityRow {
  row: number;
  categoryCode: string;
  label: string;
  shortLabel: string;
  unitCode: string;
  unitRate: string;
  validFrom: Date;
  siteShortCode?: string;
}

export interface ActivitiesImportPreview {
  valid: ValidActivityRow[];
  errors: ImportRowError[];
}

const REQUIRED_HEADERS = ["categoryCode", "label", "unitCode", "unitRate", "validFrom"] as const;

async function validateCategoryCodes(rows: ValidActivityRow[]): Promise<ImportRowError[]> {
  const codes = [...new Set(rows.map((row) => row.categoryCode))];
  if (codes.length === 0) return [];

  const categories = await prisma.activityCategory.findMany({
    where: { code: { in: codes } },
    select: { code: true },
  });
  const known = new Set(categories.map((c) => c.code));

  const errors: ImportRowError[] = [];
  for (const row of rows) {
    if (!known.has(row.categoryCode)) {
      errors.push({
        row: row.row,
        field: "categoryCode",
        message: `Catégorie introuvable (${row.categoryCode})`,
        sheet: "activities",
      });
    }
  }
  return errors;
}

async function validateUnitCodes(rows: ValidActivityRow[]): Promise<ImportRowError[]> {
  const codes = [...new Set(rows.map((row) => row.unitCode))];
  if (codes.length === 0) return [];

  const units = await prisma.unit.findMany({
    where: { code: { in: codes } },
    select: { code: true },
  });
  const known = new Set(units.map((u) => u.code));

  const errors: ImportRowError[] = [];
  for (const row of rows) {
    if (!known.has(row.unitCode)) {
      errors.push({
        row: row.row,
        field: "unitCode",
        message: `Unité introuvable (${row.unitCode})`,
        sheet: "activities",
      });
    }
  }
  return errors;
}

function detectDuplicateActivities(rows: ValidActivityRow[]): ImportRowError[] {
  const errors: ImportRowError[] = [];
  const keyRows = new Map<string, number[]>();

  for (const row of rows) {
    const key = `${row.siteShortCode ?? "GLOBAL"}::${row.label.toLowerCase()}`;
    const list = keyRows.get(key) ?? [];
    list.push(row.row);
    keyRows.set(key, list);
  }

  for (const [key, rowNumbers] of keyRows) {
    if (rowNumbers.length <= 1) continue;
    for (const row of rowNumbers) {
      errors.push({
        row,
        field: "label",
        message: `Activité dupliquée dans le fichier (${key})`,
        sheet: "activities",
      });
    }
  }

  return errors;
}

async function validateSiteShortCodes(
  rows: ValidActivityRow[],
  knownSiteCodes: string[] = [],
): Promise<ImportRowError[]> {
  const codes = [...new Set(rows.map((row) => row.siteShortCode).filter(Boolean))] as string[];
  if (codes.length === 0) return [];

  const sites = await prisma.site.findMany({
    where: { shortCode: { in: codes } },
    select: { shortCode: true },
  });
  const known = new Set([...knownSiteCodes, ...sites.map((site) => site.shortCode)]);

  const errors: ImportRowError[] = [];
  for (const row of rows) {
    if (row.siteShortCode && !known.has(row.siteShortCode)) {
      errors.push({
        row: row.row,
        field: "siteShortCode",
        message: `Site introuvable (${row.siteShortCode})`,
        sheet: "activities",
      });
    }
  }
  return errors;
}

export async function parseActivitiesWorkbook(
  buffer: Buffer,
  options?: { knownSiteCodes?: string[] },
): Promise<ActivitiesImportPreview> {
  const workbook = await loadXlsxWorkbook(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return {
      valid: [],
      errors: [
        { row: 0, field: "sheet", message: "Feuille Excel introuvable", sheet: "activities" },
      ],
    };
  }

  const headerMap = buildHeaderMap(sheet);
  const errors: ImportRowError[] = missingHeaders(headerMap, REQUIRED_HEADERS).map((error) => ({
    ...error,
    sheet: "activities",
  }));
  if (errors.length > 0) return { valid: [], errors };

  const valid: ValidActivityRow[] = [];

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
    const values = rowValues(sheet, rowNumber, headerMap);
    const hasData = Object.values(values).some((value) => value.length > 0);
    if (!hasData) continue;

    const rowErrors: ImportRowError[] = [];

    if (!values.label)
      rowErrors.push({ row: rowNumber, field: "label", message: "Requis", sheet: "activities" });
    if (!values.unitCode)
      rowErrors.push({ row: rowNumber, field: "unitCode", message: "Requis", sheet: "activities" });

    const unitRate = parseDecimalField(values.unitRate, rowNumber, "unitRate", rowErrors);
    const validFrom = parseDateField(values.validFrom, rowNumber, "validFrom", rowErrors);
    rowErrors.forEach((error) => {
      error.sheet = "activities";
    });

    const siteShortCode = values.siteShortCode?.toUpperCase() || undefined;
    if (siteShortCode && !/^[A-Z]{2,3}$/.test(siteShortCode)) {
      rowErrors.push({
        row: rowNumber,
        field: "siteShortCode",
        message: "Code site invalide",
        sheet: "activities",
      });
    }

    if (!values.categoryCode) {
      rowErrors.push({
        row: rowNumber,
        field: "categoryCode",
        message: "Requis",
        sheet: "activities",
      });
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    valid.push({
      row: rowNumber,
      categoryCode: values.categoryCode.toUpperCase(),
      label: values.label,
      shortLabel: values.shortLabel || values.label.toLowerCase(),
      unitCode: values.unitCode.toUpperCase(),
      unitRate: unitRate!,
      validFrom: validFrom!,
      siteShortCode,
    });
  }

  errors.push(...detectDuplicateActivities(valid));

  const rowsWithoutDupes = valid.filter(
    (row) => !errors.some((error) => error.row === row.row && error.field === "label"),
  );
  errors.push(...(await validateSiteShortCodes(rowsWithoutDupes, options?.knownSiteCodes ?? [])));
  errors.push(...(await validateCategoryCodes(rowsWithoutDupes)));
  errors.push(...(await validateUnitCodes(rowsWithoutDupes)));

  const invalidRows = new Set(errors.map((error) => error.row));
  return { valid: valid.filter((row) => !invalidRows.has(row.row)), errors };
}

export async function importActivitiesRows(rows: ValidActivityRow[], dryRun: boolean) {
  if (dryRun) {
    return rows.map((row) => ({ label: row.label, action: "would_create" as const }));
  }

  const siteByCode = new Map(
    (
      await prisma.site.findMany({
        where: {
          shortCode: {
            in: [...new Set(rows.map((row) => row.siteShortCode).filter(Boolean))] as string[],
          },
        },
        select: { id: true, shortCode: true },
      })
    ).map((site) => [site.shortCode, site.id]),
  );

  const categoryByCode = new Map(
    (
      await prisma.activityCategory.findMany({
        where: { code: { in: [...new Set(rows.map((row) => row.categoryCode))] } },
        select: { id: true, code: true },
      })
    ).map((category) => [category.code, category.id]),
  );

  const unitByCode = new Map(
    (
      await prisma.unit.findMany({
        where: { code: { in: [...new Set(rows.map((row) => row.unitCode))] } },
        select: { id: true, code: true },
      })
    ).map((unit) => [unit.code, unit.id]),
  );

  const created = [];
  for (const row of rows) {
    const activity = await prisma.activitySubActivity.create({
      data: {
        categoryId: categoryByCode.get(row.categoryCode)!,
        label: row.label,
        shortLabel: row.shortLabel,
        unitId: unitByCode.get(row.unitCode)!,
        unitRate: row.unitRate,
        validFrom: row.validFrom,
        siteId: row.siteShortCode ? (siteByCode.get(row.siteShortCode) ?? null) : null,
        groupKey: randomUUID(),
      },
    });
    created.push({ id: activity.id, label: activity.label, action: "created" as const });
  }
  return created;
}
