export interface ClientBasemap {
  apiKey?: string | null;
  tileUrl?: string | null;
  imageUrl?: string | null;
  imageBounds?: [[number, number], [number, number]] | null;
}

export type BasemapStyle = "plan" | "satellite";

/** La vue satellite vient du style MapTiler hybrid. Un flux client reste prioritaire. */
export function satelliteAvailable(basemap?: ClientBasemap | null): boolean {
  return Boolean(basemap?.apiKey) && !basemap?.tileUrl;
}

export function tileConfig(
  mapTilerKey?: string | null,
  basemap?: ClientBasemap | null,
  style: BasemapStyle = "plan",
) {
  if (basemap?.tileUrl) {
    return {
      url: basemap.tileUrl,
      attribution: "Fond du client",
    };
  }
  if (mapTilerKey) {
    const mapId = style === "satellite" ? "hybrid" : "streets-v2";
    return {
      url: `https://api.maptiler.com/maps/${mapId}/{z}/{x}/{y}.png?key=${mapTilerKey}`,
      attribution:
        '&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    };
  }
  return {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  };
}
