import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../middleware/error-handler.js";
import { writeAuditLog } from "../audit/audit.service.js";
import type { KmlParcelFeature } from "./kml.js";
import type { ParcelImportResult } from "./parcel-import.service.js";

export const PLANTED_ZONE_NAME = "Parcelles plantées";

class DryRunRollback extends Error {}

export async function importParcelFeatures(
  features: KmlParcelFeature[],
  options: { dryRun: boolean; userId: string; ip?: string; userAgent?: string },
): Promise<ParcelImportResult> {
  if (features.length === 0) {
    throw new ApiError(422, "EMPTY_FILE", "Aucune parcelle géométrique dans le fichier");
  }

  const sites = await prisma.site.findMany({ select: { id: true, shortCode: true } });
  const siteByCode = new Map(sites.map((site) => [site.shortCode.toUpperCase(), site.id]));
  const unknown = [
    ...new Set(
      features
        .map((feature) => feature.codeSite)
        .filter((code) => code !== "" && !siteByCode.has(code)),
    ),
  ];
  if (unknown.length > 0) {
    throw new ApiError(422, "UNKNOWN_SITE", `Site inconnu : ${unknown.join(", ")}`);
  }

  const result: ParcelImportResult = {
    dryRun: options.dryRun,
    rows: features.length,
    zonesCreated: 0,
    parcellesCreated: 0,
    parcellesUpdated: 0,
    errors: [],
  };

  const run = async (tx: Pick<typeof prisma, "zone" | "parcelle">) => {
    const zoneCache = new Map<string, string>();
    const seen = new Set<string>();

    for (const feature of features) {
      if (!feature.codeSite || !siteByCode.has(feature.codeSite)) {
        result.errors.push({
          line: feature.index,
          message: "Code site manquant",
        });
        continue;
      }
      if (!feature.codeParcelle || feature.codeParcelle.length > 20) {
        result.errors.push({
          line: feature.index,
          message: "Code parcelle manquant ou trop long",
        });
        continue;
      }
      const key = `${feature.codeSite}|${feature.codeParcelle}`;
      if (seen.has(key)) {
        result.errors.push({
          line: feature.index,
          message: `Code en double dans le fichier : ${feature.codeParcelle} (la première géométrie est conservée)`,
        });
        continue;
      }
      seen.add(key);

      const siteId = siteByCode.get(feature.codeSite)!;
      let zoneId = zoneCache.get(siteId);
      if (!zoneId) {
        const existingZone = await tx.zone.findFirst({
          where: {
            siteId,
            name: { equals: PLANTED_ZONE_NAME, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (existingZone) {
          zoneId = existingZone.id;
        } else {
          const created = await tx.zone.create({
            data: { siteId, name: PLANTED_ZONE_NAME },
          });
          zoneId = created.id;
          result.zonesCreated += 1;
        }
        zoneCache.set(siteId, zoneId);
      }

      const existing = await tx.parcelle.findFirst({
        where: { zoneId, code: feature.codeParcelle },
        select: { id: true },
      });
      const data = {
        name: feature.codeParcelle,
        code: feature.codeParcelle,
        kind: "PARCELLE" as const,
        surfaceHa: feature.surfaceHa,
        geoPolygon: feature.geometry as Prisma.InputJsonValue,
      };
      if (existing) {
        await tx.parcelle.update({ where: { id: existing.id }, data });
        result.parcellesUpdated += 1;
      } else {
        await tx.parcelle.create({ data: { zoneId, ...data } });
        result.parcellesCreated += 1;
      }
    }
  };

  try {
    await prisma.$transaction(
      async (tx) => {
        await run(tx);
        if (options.dryRun) throw new DryRunRollback();
      },
      { timeout: 120_000, maxWait: 10_000 },
    );
  } catch (err) {
    if (!(err instanceof DryRunRollback)) throw err;
  }

  if (!options.dryRun && (result.parcellesCreated > 0 || result.parcellesUpdated > 0)) {
    await writeAuditLog({
      userId: options.userId,
      action: "IMPORT",
      entityType: "Parcelle",
      after: {
        rows: result.rows,
        zonesCreated: result.zonesCreated,
        parcellesCreated: result.parcellesCreated,
        parcellesUpdated: result.parcellesUpdated,
        errors: result.errors.length,
      },
      ip: options.ip,
      userAgent: options.userAgent,
    });
  }

  return result;
}
