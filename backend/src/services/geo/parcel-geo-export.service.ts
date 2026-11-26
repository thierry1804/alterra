import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../middleware/error-handler.js";

function isoDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** GeoJSON des parcelles d'un site, avec l'activité, l'effectif et les dates des pointages. */
export async function exportParcelsGeoJson(siteId: string): Promise<{
  filename: string;
  body: string;
}> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { shortCode: true },
  });
  if (!site) throw new ApiError(404, "NOT_FOUND", "Site introuvable");

  const parcels = await prisma.parcelle.findMany({
    where: { zone: { siteId } },
    orderBy: [{ code: "asc" }, { name: "asc" }],
    include: {
      pointages: {
        where: { status: { not: "REJECTED" } },
        select: {
          workerId: true,
          date: true,
          subActivity: { select: { label: true } },
        },
      },
    },
  });

  const features = parcels.map((parcel) => {
    const activities = [
      ...new Set(parcel.pointages.map((row) => row.subActivity.label).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "fr"));
    const workers = new Set(parcel.pointages.map((row) => row.workerId));
    const dates = parcel.pointages.map((row) => row.date.getTime());
    return {
      type: "Feature" as const,
      geometry: parcel.geoPolygon,
      properties: {
        code_parcelle: parcel.code ?? parcel.name,
        code_site: site.shortCode,
        surface: parcel.surfaceHa == null ? null : Number(parcel.surfaceHa),
        activites: activities.join(", "),
        nb_travailleurs: workers.size,
        date_min: dates.length === 0 ? null : isoDate(new Date(Math.min(...dates))),
        date_max: dates.length === 0 ? null : isoDate(new Date(Math.max(...dates))),
      },
    };
  });

  return {
    filename: `parcelles_${site.shortCode}.geojson`,
    body: JSON.stringify({ type: "FeatureCollection", features }),
  };
}
