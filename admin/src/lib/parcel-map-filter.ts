import type { ParcelleKind, SiteGeo } from "./geo";

export interface ParcelMapFilter {
  query: string;
  surfaceMin: string;
  surfaceMax: string;
  kind: "" | ParcelleKind;
}

export const EMPTY_PARCEL_FILTER: ParcelMapFilter = {
  query: "",
  surfaceMin: "",
  surfaceMax: "",
  kind: "",
};

export function parcelFilterActive(filter: ParcelMapFilter): boolean {
  return Boolean(
    filter.query.trim() || filter.surfaceMin.trim() || filter.surfaceMax.trim() || filter.kind,
  );
}

function parseHa(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function countParcels(sites: SiteGeo[]): number {
  return sites.reduce(
    (sum, site) => sum + site.zones.reduce((zoneSum, zone) => zoneSum + zone.parcelles.length, 0),
    0,
  );
}

/** Ne garde que les parcelles dont le code, le nom, la zone, la surface et le type correspondent. */
export function filterSiteParcels(sites: SiteGeo[], filter: ParcelMapFilter): SiteGeo[] {
  if (!parcelFilterActive(filter)) return sites;
  const query = filter.query.trim().toLowerCase();
  const min = parseHa(filter.surfaceMin);
  const max = parseHa(filter.surfaceMax);

  return sites.map((site) => ({
    ...site,
    zones: site.zones.map((zone) => ({
      ...zone,
      parcelles: zone.parcelles.filter((parcel) => {
        if (query) {
          const haystack = `${parcel.code ?? ""} ${parcel.name} ${zone.name}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        if (filter.kind && parcel.kind !== filter.kind) return false;
        if (min != null || max != null) {
          const surface = parcel.surfaceHa == null ? null : Number(parcel.surfaceHa);
          if (surface == null || !Number.isFinite(surface)) return false;
          if (min != null && surface < min) return false;
          if (max != null && surface > max) return false;
        }
        return true;
      }),
    })),
  }));
}
