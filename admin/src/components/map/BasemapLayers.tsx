import { ImageOverlay, TileLayer } from "react-leaflet";
import { tileConfig, type BasemapStyle, type ClientBasemap } from "../../lib/map-tiles";

/** Tuiles (flux client, sinon MapTiler, sinon OSM) et image de référence si aucun flux n'est branché. */
export function BasemapLayers({
  basemap,
  style = "plan",
}: {
  basemap: ClientBasemap;
  style?: BasemapStyle;
}) {
  const tiles = tileConfig(basemap.apiKey, basemap, style);
  const showImage = !basemap.tileUrl && basemap.imageUrl && basemap.imageBounds;
  return (
    <>
      <TileLayer key={tiles.url} url={tiles.url} attribution={tiles.attribution} />
      {showImage && (
        <ImageOverlay url={basemap.imageUrl!} bounds={basemap.imageBounds!} opacity={0.85} />
      )}
    </>
  );
}
