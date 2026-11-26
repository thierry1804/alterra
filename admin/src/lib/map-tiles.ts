export interface ClientBasemap {
  apiKey?: string | null;
  tileUrl?: string | null;
  imageUrl?: string | null;
  imageBounds?: [[number, number], [number, number]] | null;
}

export function tileConfig(mapTilerKey?: string | null, basemap?: ClientBasemap | null) {
  if (basemap?.tileUrl) {
    return {
      url: basemap.tileUrl,
      attribution: "Fond du client",
    };
  }
  if (mapTilerKey) {
    return {
      url: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${mapTilerKey}`,
      attribution:
        '&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    };
  }
  return {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  };
}
