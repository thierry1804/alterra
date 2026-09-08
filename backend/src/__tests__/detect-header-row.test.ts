import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { detectWorkersImportColumns } from "../services/import/workers-import.service.js";

async function buildXlsx(rows: string[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Sheet1");
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("detectWorkersImportColumns — header row auto-detection", () => {
  it("uses row 1 when headers are on row 1", async () => {
    const buffer = await buildXlsx([
      ["Site", "Nom", "Prénoms", "Numéro MVola"],
      ["MNK", "Rakoto", "Jean", "0340000000"],
    ]);
    const result = await detectWorkersImportColumns(buffer, true);
    expect(result.referenceRowNumber).toBe(1);
    expect(Object.keys(result.suggestedMapping)).toHaveLength(4);
  });

  it("skips a title row and detects the real header on row 2", async () => {
    const buffer = await buildXlsx([
      ["Import MOC - Septembre 2026"],
      ["Site", "ID MOT", "Nom", "Prénoms", "CIN", "Adresse", "N°M'vola"],
      ["MNK", "12345", "Rakoto", "Jean", "101012345678", "Lot A", "0340000000"],
    ]);
    const result = await detectWorkersImportColumns(buffer, true);
    expect(result.referenceRowNumber).toBe(2);
    expect(Object.keys(result.suggestedMapping)).toHaveLength(7);
  });

  it("respects an explicit referenceRowNumber instead of auto-detecting", async () => {
    const buffer = await buildXlsx([
      ["Import MOC - Septembre 2026"],
      ["Site", "Nom", "Prénoms", "Numéro MVola"],
      ["MNK", "Rakoto", "Jean", "0340000000"],
    ]);
    const result = await detectWorkersImportColumns(buffer, true, 1);
    expect(result.referenceRowNumber).toBe(1);
    expect(Object.keys(result.suggestedMapping)).toHaveLength(0);
  });
});
