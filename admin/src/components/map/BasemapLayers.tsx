import { ImageOverlay, TileLayer } from "react-leaflet";
import { tileConfig, type ClientBasemap } from "../../lib/map-tiles";

/** Tuiles (flux client, sinon MapTiler, sinon OSM) et image de référence si aucun flux n'est branché. */
export function BasemapLayers({ basemap }: { basemap: ClientBasemap }) {
  const tiles = tileConfig(basemap.apiKey, basemap);
  const showImage = !basemap.tileUrl && basemap.imageUrl && basemap.imageBounds;
  return (
    <>
      <TileLayer url={tiles.url} attribution={tiles.attribution} />
      {showImage && (
        <ImageOverlay url={basemap.imageUrl!} bounds={basemap.imageBounds!} opacity={0.85} />
      )}
    </>
  );
}
