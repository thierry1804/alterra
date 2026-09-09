import ExcelJS from "exceljs";

export interface ExportColumn<T> {
  header: string;
  accessor: (row: T) => string | number | null | undefined;
  width?: number;
}

function timestampSuffix(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** Génère un classeur .xlsx côté navigateur à partir de lignes déjà en mémoire, et déclenche le téléchargement. */
export async function exportToExcel<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  filename: string,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Export");

  sheet.columns = columns.map((col) => ({
    header: col.header,
    width: col.width ?? Math.max(col.header.length + 2, 14),
  }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(columns.map((col) => col.accessor(row) ?? ""));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const base = filename.endsWith(".xlsx") ? filename.slice(0, -5) : filename;
  link.download = `${base}${timestampSuffix()}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
