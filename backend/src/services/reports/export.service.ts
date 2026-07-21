import ExcelJS from "exceljs";
import type { ReportResult } from "./reports.service.js";

export type ExportFormat = "csv" | "xlsx" | "pdf";

export interface ExportedReport {
  buffer: Buffer;
  contentType: string;
  filename: string;
}

function escapeCsv(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function exportReport(
  report: ReportResult,
  format: ExportFormat,
): Promise<ExportedReport> {
  const baseName = `ALTERRA_${report.meta.type}_${report.meta.dateFrom}_${report.meta.dateTo}`;

  if (format === "csv") {
    const header = report.columns.join(",");
    const lines = report.rows.map((row) =>
      report.columns.map((column) => escapeCsv(row[column])).join(","),
    );
    const csv = [header, ...lines].join("\n");
    return {
      buffer: Buffer.from(csv, "utf-8"),
      contentType: "text/csv; charset=utf-8",
      filename: `${baseName}.csv`,
    };
  }

  if (format === "xlsx") {
    return exportXlsx(report, baseName);
  }

  return exportHtmlPdf(report, baseName);
}

async function exportXlsx(report: ReportResult, baseName: string): Promise<ExportedReport> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(report.meta.title.slice(0, 31));

  sheet.addRow(report.columns);
  report.rows.forEach((row) => {
    sheet.addRow(report.columns.map((column) => row[column] ?? ""));
  });

  sheet.getRow(1).font = { bold: true };

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  return {
    buffer,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    filename: `${baseName}.xlsx`,
  };
}

function exportHtmlPdf(report: ReportResult, baseName: string): ExportedReport {
  const headerCells = report.columns.map((column) => `<th>${column}</th>`).join("");
  const bodyRows = report.rows
    .map((row) => {
      const cells = report.columns.map((column) => `<td>${row[column] ?? ""}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>${report.meta.title}</title>
  <style>
    body { font-family: system-ui, sans-serif; font-size: 12px; color: #18181b; padding: 24px; }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { margin: 0 0 16px; color: #52525b; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d4d4d8; padding: 6px 8px; text-align: left; }
    th { background: #f4f4f5; }
  </style>
</head>
<body>
  <h1>${report.meta.title}</h1>
  <p>Période : ${report.meta.dateFrom} → ${report.meta.dateTo} · ${report.meta.rowCount} ligne(s)</p>
  <table>
    <thead><tr>${headerCells}</tr></thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;

  return {
    buffer: Buffer.from(html, "utf-8"),
    contentType: "text/html; charset=utf-8",
    filename: `${baseName}.html`,
  };
}
