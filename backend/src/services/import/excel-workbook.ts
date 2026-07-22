import ExcelJS from "exceljs";

/** Load xlsx bytes — exceljs Buffer types differ from Node 22 @types/node. */
export async function loadXlsxWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  return workbook;
}
