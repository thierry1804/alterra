import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../middleware/error-handler.js";
import { writeAuditLog } from "../audit/audit.service.js";

const MAX_LINES = 5000;

export interface ParcelImportError {
  line: number;
  message: string;
}

export interface ParcelImportResult {
  dryRun: boolean;
  rows: number;
  zonesCreated: number;
  parcellesCreated: number;
  parcellesUpdated: number;
  errors: ParcelImportError[];
}

class DryRunRollback extends Error {}

const HEADER_ALIASES: Record<string, string> = {
  site: "site",
  zone: "zone",
  code: "code",
  nom: "name",
  name: "name",
  type: "kind",
  surface: "surface",
};

const DEFAULT_COLUMNS = ["site", "zone", "code", "name", "kind"];

function detectDelimiter(line: string): string {
  return line.includes(";") ? ";" : line.includes("\t") ? "\t" : ",";
}

function splitLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, "").trim());
}

function parseKind(value: string): "PARCELLE" | "PEPINIERE" | null {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (normalized === "") return "PARCELLE";
  if (normalized === "parcelle") return "PARCELLE";
  if (normalized === "pepiniere" || normalized === "pep") return "PEPINIERE";
  return null;
}

export async function importParcelsCsv(
  csv: string,
  options: { dryRun: boolean; userId: string; ip?: string; userAgent?: string },
): Promise<ParcelImportResult> {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line, index) => ({ line, number: index + 1 }))
    .filter((entry) => entry.line.trim() !== "");

  if (lines.length === 0) throw new ApiError(422, "EMPTY_FILE", "Le fichier est vide");
  if (lines.length > MAX_LINES) {
    throw new ApiError(422, "FILE_TOO_LARGE", `Le fichier dépasse ${MAX_LINES} lignes`);
  }

  const delimiter = detectDelimiter(lines[0].line);
  const firstCells = splitLine(lines[0].line, delimiter).map((cell) => cell.toLowerCase());
  const hasHeader =
    firstCells.includes("site") && firstCells.some((cell) => cell in HEADER_ALIASES);
  const columns = hasHeader
    ? firstCells.map((cell) => HEADER_ALIASES[cell] ?? cell)
    : DEFAULT_COLUMNS;
  for (const required of ["site", "zone", "name"]) {
    if (!columns.includes(required)) {
      throw new ApiError(
        422,
        "MISSING_COLUMN",
        "Colonnes attendues : site, zone, code, nom (et type facultatif : parcelle ou pépinière)",
      );
    }
  }
  const dataLines = hasHeader ? lines.slice(1) : lines;

  const result: ParcelImportResult = {
    dryRun: options.dryRun,
    rows: dataLines.length,
    zonesCreated: 0,
    parcellesCreated: 0,
    parcellesUpdated: 0,
    errors: [],
  };

  const sites = await prisma.site.findMany({ select: { id: true, shortCode: true } });
  const siteByCode = new Map(sites.map((site) => [site.shortCode.toUpperCase(), site.id]));

  const run = async (tx: Pick<typeof prisma, "zone" | "parcelle">) => {
    const zoneCache = new Map<string, string>();

    for (const entry of dataLines) {
      const cells = splitLine(entry.line, delimiter);
      const get = (column: string) => cells[columns.indexOf(column)] ?? "";
      const siteCode = get("site").toUpperCase();
      const zoneValue = get("zone");
      const name = get("name");
      const code = get("code").toUpperCase();
      const kind = parseKind(get("kind"));

      const siteId = siteByCode.get(siteCode);
      if (!siteId) {
        result.errors.push({ line: entry.number, message: `Site inconnu : « ${get("site")} »` });
        continue;
      }
      if (!zoneValue || !name) {
        result.errors.push({ line: entry.number, message: "Zone et nom sont obligatoires" });
        continue;
      }
      if (!kind) {
        result.errors.push({
          line: entry.number,
          message: `Type inconnu : « ${get("kind")} » (parcelle ou pépinière)`,
        });
        continue;
      }
      if (code.length > 20 || name.length > 120) {
        result.errors.push({ line: entry.number, message: "Code ou nom trop long" });
        continue;
      }

      const zoneKey = `${siteId}|${zoneValue.toLowerCase()}`;
      let zoneId = zoneCache.get(zoneKey);
      if (!zoneId) {
        const existingZone = await tx.zone.findFirst({
          where: {
            siteId,
            OR: [
              { name: { equals: zoneValue, mode: "insensitive" } },
              { code: zoneValue.toUpperCase() },
            ],
          },
          select: { id: true },
        });
        if (existingZone) {
          zoneId = existingZone.id;
        } else {
          const created = await tx.zone.create({ data: { siteId, name: zoneValue } });
          zoneId = created.id;
          result.zonesCreated += 1;
        }
        zoneCache.set(zoneKey, zoneId);
      }

      const existing = await tx.parcelle.findFirst({
        where: code ? { zoneId, code } : { zoneId, name },
        select: { id: true },
      });
      try {
        if (existing) {
          await tx.parcelle.update({
            where: { id: existing.id },
            data: { name, kind, ...(code ? { code } : {}) },
          });
          result.parcellesUpdated += 1;
        } else {
          await tx.parcelle.create({ data: { zoneId, name, kind, code: code || undefined } });
          result.parcellesCreated += 1;
        }
      } catch {
        result.errors.push({
          line: entry.number,
          message: "Une parcelle avec ce nom ou ce code existe déjà dans la zone",
        });
      }
    }
  };

  try {
    await prisma.$transaction(
      async (tx) => {
        await run(tx);
        if (options.dryRun || result.errors.length > 0) throw new DryRunRollback();
      },
      { timeout: 60_000, maxWait: 10_000 },
    );
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err;
  }

  if (!options.dryRun && result.errors.length === 0) {
    await writeAuditLog({
      userId: options.userId,
      action: "IMPORT",
      entityType: "Parcelle",
      after: {
        rows: result.rows,
        zonesCreated: result.zonesCreated,
        parcellesCreated: result.parcellesCreated,
        parcellesUpdated: result.parcellesUpdated,
      },
      ip: options.ip,
      userAgent: options.userAgent,
    });
  }

  return result;
}
