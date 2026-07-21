import { describe, expect, it } from "vitest";
import { exportReport } from "../services/reports/export.service.js";
import type { ReportResult } from "../services/reports/reports.service.js";
import { resolveMonthRange } from "../services/reports/reports.service.js";

const sampleReport: ReportResult = {
  meta: {
    type: "pointages",
    title: "Pointages sur période",
    dateFrom: "2026-07-01",
    dateTo: "2026-07-31",
    siteId: null,
    rowCount: 1,
  },
  columns: ["date", "worker", "amount"],
  rows: [{ date: "2026-07-15", worker: "Rakoto Jean", amount: 12500 }],
};

describe("reports helpers", () => {
  it("resolveMonthRange returns UTC month bounds", () => {
    const { dateFrom, dateTo } = resolveMonthRange("2026-07");
    expect(dateFrom.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(dateTo.getUTCMonth()).toBe(6);
    expect(dateTo.getUTCDate()).toBe(31);
  });

  it("exportReport produces csv buffer", async () => {
    const exported = await exportReport(sampleReport, "csv");
    expect(exported.filename.endsWith(".csv")).toBe(true);
    expect(exported.buffer.toString("utf-8")).toContain("Rakoto Jean");
  });

  it("exportReport produces xlsx buffer", async () => {
    const exported = await exportReport(sampleReport, "xlsx");
    expect(exported.filename.endsWith(".xlsx")).toBe(true);
    expect(exported.buffer.length).toBeGreaterThan(100);
  });
});
