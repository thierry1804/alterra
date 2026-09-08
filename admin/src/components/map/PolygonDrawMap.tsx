import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import type { GeoPolygon } from "../../lib/geo";
import { tileConfig } from "./SiteMap";

function layerToGeoPolygon(layer: L.Polygon): GeoPolygon {
  const geojson = layer.toGeoJSON();
  const geometry = "geometry" in geojson ? geojson.geometry : geojson;
  return geometry as GeoPolygon;
}

function geoPolygonToLatLngRings(polygon: GeoPolygon): L.LatLngExpression[][] {
  return polygon.coordinates.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number]));
}

interface GeomanLayerProps {
  initialValue: GeoPolygon | null;
  onChange: (polygon: GeoPolygon | null) => void;
}

/**
 * Pilote leaflet-geoman de façon impérative (pas d'API React officielle) :
 * un seul polygone à la fois — dessiner en crée un nouveau (et retire
 * l'ancien), éditer les sommets ou supprimer met à jour/efface la valeur.
 */
function GeomanLayer({ initialValue, onChange }: GeomanLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.Polygon | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    // La carte est montée pendant l'animation d'ouverture du Dialog (scale/opacity) :
    // Leaflet capture la taille du conteneur à l'init et ne la recalcule pas seul, ce
    // qui fausse la traduction pixel -> lat/lng tant qu'on ne force pas un recalcul.
    const invalidateTimer = setTimeout(() => map.invalidateSize(), 250);

    map.pm.addControls({
      position: "topleft",
      drawMarker: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawRectangle: false,
      drawCircle: false,
      drawText: false,
      drawPolygon: true,
      editMode: true,
      dragMode: false,
      cutPolygon: false,
      removalMode: true,
      rotateMode: false,
    });
    map.pm.setGlobalOptions({ allowSelfIntersection: false });

    function bindLayerEvents(layer: L.Polygon) {
      const emit = () => onChangeRef.current(layerToGeoPolygon(layer));
      layer.on("pm:edit", emit);
      layer.on("pm:markerdragend", emit);
      layer.pm.enable();
    }

    function handleCreate(e: { shape: string; layer: L.Layer }) {
      if (e.shape !== "Polygon" || !(e.layer instanceof L.Polygon)) return;
      if (layerRef.current) map.removeLayer(layerRef.current);
      layerRef.current = e.layer;
      bindLayerEvents(e.layer);
      onChangeRef.current(layerToGeoPolygon(e.layer));
    }

    function handleRemove(e: { layer: L.Layer }) {
      if (e.layer === layerRef.current) {
        layerRef.current = null;
        onChangeRef.current(null);
      }
    }

    map.on("pm:create", handleCreate);
    map.on("pm:remove", handleRemove);

    if (initialValue) {
      const layer = L.polygon(geoPolygonToLatLngRings(initialValue)).addTo(map);
      layerRef.current = layer;
      bindLayerEvents(layer);
      map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 17 });
    }

    return () => {
      clearTimeout(invalidateTimer);
      map.off("pm:create", handleCreate);
      map.off("pm:remove", handleRemove);
      map.pm.removeControls();
      if (layerRef.current) map.removeLayer(layerRef.current);
      layerRef.current = null;
    };
    // Montage unique par instance (le parent remonte le composant via `key` pour changer de cible).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}

export interface PolygonDrawMapProps {
  value: GeoPolygon | null;
  onChange: (polygon: GeoPolygon | null) => void;
  center: [number, number];
  zoom?: number;
}

/** Carte avec outils de dessin/édition de polygone (leaflet-geoman) synchronisée sur `value`. */
export default function PolygonDrawMap({ value, onChange, center, zoom = 14 }: PolygonDrawMapProps) {
  const tiles = tileConfig();
  return (
    <div className="h-72 w-full overflow-hidden rounded-md border border-zinc-300">
      <MapContainer center={center} zoom={zoom} scrollWheelZoom className="h-full w-full">
        <TileLayer url={tiles.url} attribution={tiles.attribution} />
        <GeomanLayer initialValue={value} onChange={onChange} />
      </MapContainer>
    </div>
  );
}
