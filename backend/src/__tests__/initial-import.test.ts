import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { parseActivitiesWorkbook } from "../services/import/activities-import.service.js";
import { parseSitesWorkbook } from "../services/import/sites-import.service.js";
import { parseInitialWorkersWorkbook } from "../services/import/workers-initial-import.service.js";

vi.mock("../lib/prisma.js", () => ({
  prisma: {
    site: { findMany: vi.fn() },
    team: { findMany: vi.fn() },
    worker: { findMany: vi.fn() },
  },
}));

import { prisma } from "../lib/prisma.js";

async function buildWorkbook(headers: string[], rows: string[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("data");
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe("initial import parsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.site.findMany).mockResolvedValue([
      { id: "site-1", shortCode: "MNK" },
    ] as never);
    vi.mocked(prisma.team.findMany).mockResolvedValue([
      { id: "team-1", name: "MNK-1", siteId: "site-1" },
    ] as never);
    vi.mocked(prisma.worker.findMany).mockResolvedValue([]);
  });

  it("parseSitesWorkbook validates shortCode format", async () => {
    const buffer = await buildWorkbook(
      ["shortCode", "name", "location"],
      [["mnk", "Manankazo", "Région A"]],
    );

    const result = await parseSitesWorkbook(buffer);
    expect(result.valid[0]?.shortCode).toBe("MNK");
  });

  it("parseSitesWorkbook rejects duplicate shortCode in file", async () => {
    const buffer = await buildWorkbook(
      ["shortCode", "name"],
      [
        ["MNK", "Site A"],
        ["MNK", "Site B"],
      ],
    );

    const result = await parseSitesWorkbook(buffer);
    expect(result.valid).toHaveLength(0);
    expect(result.errors.some((error) => error.field === "shortCode")).toBe(true);
  });

  it("parseActivitiesWorkbook accepts global activity without site", async () => {
    const buffer = await buildWorkbook(
      ["label", "unit", "unitRate", "validFrom", "siteShortCode"],
      [["Désherbage", "m2", "150", "2026-01-01", ""]],
    );

    const result = await parseActivitiesWorkbook(buffer);
    expect(result.valid).toHaveLength(1);
    expect(result.valid[0]?.siteShortCode).toBeUndefined();
  });

  it("parseInitialWorkersWorkbook resolves siteShortCode and teamName", async () => {
    const buffer = await buildWorkbook(
      ["matricule", "firstName", "lastName", "mvolaNumber", "siteShortCode", "teamName", "hiredAt"],
      [["MOC-1", "Jean", "Rakoto", "0340000001", "MNK", "MNK-1", "2025-01-01"]],
    );

    const result = await parseInitialWorkersWorkbook(buffer);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it("parseInitialWorkersWorkbook rejects unknown team on site", async () => {
    const buffer = await buildWorkbook(
      ["matricule", "firstName", "lastName", "mvolaNumber", "siteShortCode", "teamName", "hiredAt"],
      [["MOC-1", "Jean", "Rakoto", "0340000001", "MNK", "UNKNOWN", "2025-01-01"]],
    );

    const result = await parseInitialWorkersWorkbook(buffer);
    expect(result.valid).toHaveLength(0);
    expect(result.errors.some((error) => error.field === "teamName")).toBe(true);
  });
});
