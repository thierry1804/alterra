import { describe, expect, it } from "vitest";
import { exportReport } from "../services/reports/export.service.js";
import type { ReportResult } from "../services/reports/reports.service.js";

const report = {
  meta: { type: "pointages", title: "Pointages <b>", dateFrom: "2026-09-01", dateTo: "2026-09-30", rowCount: 1 },
  columns: ["MOC"],
  rows: [{ MOC: "<script>alert(1)</script>" }],
} as unknown as ReportResult;

describe("export « PDF » des rapports (A12)", () => {
  it("livre un fichier .pdf, pas une page HTML", async () => {
    const out = await exportReport(report, "pdf");
    expect(out.contentType).toBe("application/pdf");
    expect(out.filename).toMatch(/\.pdf$/);
    expect(out.buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
