import type { GeoPolygon } from "../../lib/geo-json.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../middleware/error-handler.js";
import { escapeKmlText, geometryToKml } from "./kml.js";

function isoDate(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isGeoPolygon(value: unknown): value is NonNullable<GeoPolygon> {
  if (!value || typeof value !== "object") return false;
  const geometry = value as { type?: string };
  return geometry.type === "Polygon" || geometry.type === "MultiPolygon";
}

function simpleData(name: string, value: string | number | null): string {
  if (value == null || value === "") return "";
  return `<SimpleData name="${name}">${escapeKmlText(String(value))}</SimpleData>`;
}

/** KML des parcelles d'un site, avec l'activité, l'effectif et les dates des pointages. */
export async function exportParcelsKml(siteId: string): Promise<{
  filename: string;
  body: string;
  count: number;
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

  const placemarks = parcels.map((parcel) => {
    const code = parcel.code ?? parcel.name;
    const activities = [
      ...new Set(parcel.pointages.map((row) => row.subActivity.label).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "fr"));
    const workers = new Set(parcel.pointages.map((row) => row.workerId));
    const dates = parcel.pointages.map((row) => row.date.getTime());
    const surface = parcel.surfaceHa == null ? null : Number(parcel.surfaceHa);
    const fields = [
      simpleData("code_site", site.shortCode),
      simpleData("code_parcelle", code),
      simpleData("surface", surface),
      simpleData("activites", activities.join(", ")),
      simpleData("nb_travailleurs", workers.size),
      simpleData("date_min", dates.length === 0 ? null : isoDate(new Date(Math.min(...dates)))),
      simpleData("date_max", dates.length === 0 ? null : isoDate(new Date(Math.max(...dates)))),
    ].join("");
    const geometry = isGeoPolygon(parcel.geoPolygon) ? geometryToKml(parcel.geoPolygon) : "";
    return `<Placemark><name>${escapeKmlText(code)}</name><ExtendedData><SchemaData schemaUrl="#parcelles">${fields}</SchemaData></ExtendedData>${geometry}</Placemark>`;
  });

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
<name>parcelles_${escapeKmlText(site.shortCode)}</name>
<Schema name="parcelles" id="parcelles">
<SimpleField name="code_site" type="string"/>
<SimpleField name="code_parcelle" type="string"/>
<SimpleField name="surface" type="double"/>
<SimpleField name="activites" type="string"/>
<SimpleField name="nb_travailleurs" type="int"/>
<SimpleField name="date_min" type="string"/>
<SimpleField name="date_max" type="string"/>
</Schema>
<Folder><name>parcelle_plantee</name>${placemarks.join("")}</Folder>
</Document>
</kml>`;

  return {
    filename: `parcelles_${site.shortCode}.kml`,
    body,
    count: parcels.length,
  };
}
