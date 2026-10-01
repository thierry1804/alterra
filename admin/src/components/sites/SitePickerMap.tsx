import { useEffect } from "react";
import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { tileConfig } from "../../lib/map-tiles";
import { cn } from "../../lib/utils";

const MADAGASCAR_CENTER: [number, number] = [-18.9, 46.8];
const MADAGASCAR_ZOOM = 6;

function InvalidateSizeOnMount() {
  const map = useMap();
  useEffect(() => {
    // Carte montée pendant l'animation d'ouverture du Dialog (scale/opacity) : Leaflet capture
    // la taille du conteneur à l'init et ne la recalcule pas seul sans ce coup de pouce.
    const timer = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Recentre la carte quand la position change par un autre biais qu'un clic direct (ex. recherche). */
function RecenterOnChange({ value }: { value: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.setView([value.lat, value.lng], Math.max(map.getZoom(), 9));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.lat, value?.lng]);
  return null;
}

export interface SitePickerMapProps {
  value: { lat: number; lng: number } | null;
  onPick: (lat: number, lng: number) => void;
  className?: string;
}

/** Carte de Madagascar : cliquer pose un repère et renvoie les coordonnées choisies. */
export default function SitePickerMap({ value, onPick, className }: SitePickerMapProps) {
  const tiles = tileConfig();
  return (
    <div className={cn("h-64 w-full overflow-hidden rounded-md border border-zinc-300", className)}>
      <MapContainer
        center={value ? [value.lat, value.lng] : MADAGASCAR_CENTER}
        zoom={value ? 9 : MADAGASCAR_ZOOM}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer url={tiles.url} attribution={tiles.attribution} />
        <InvalidateSizeOnMount />
        <ClickHandler onPick={onPick} />
        <RecenterOnChange value={value} />
        {value && (
          <CircleMarker
            center={[value.lat, value.lng]}
            radius={8}
            pathOptions={{
              color: "#27272a",
              fillColor: "#52525b",
              fillOpacity: 0.9,
              weight: 2,
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
