import { useEffect } from "react";
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  collectGeoBounds,
  geoPolygonToLatLngs,
  type SiteGeo,
} from "../../lib/geo";

const DEFAULT_CENTER: [number, number] = [-18.91, 47.52];
const DEFAULT_ZOOM = 6;

export function tileConfig() {
  const mapTilerKey = import.meta.env.VITE_MAPTILER_KEY as string | undefined;
  if (mapTilerKey) {
    return {
      url: `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${mapTilerKey}`,
      attribution:
        '&copy; <a href="https://www.maptiler.com/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    };
  }
  return {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  };
}

interface MapBoundsUpdaterProps {
  sites: SiteGeo[];
  selectedSiteId: string;
  showZones: boolean;
  showParcels: boolean;
}

function MapBoundsUpdater({
  sites,
  selectedSiteId,
  showZones,
  showParcels,
}: MapBoundsUpdaterProps) {
  const map = useMap();

  useEffect(() => {
    const points = collectGeoBounds(sites, {
      siteId: selectedSiteId || undefined,
      includeZones: showZones,
      includeParcels: showParcels,
    });

    if (points.length === 0) {
      map.setView(DEFAULT_CENTER, selectedSiteId ? 11 : DEFAULT_ZOOM);
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }

    const bounds = points as LatLngBoundsExpression;
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
  }, [map, sites, selectedSiteId, showZones, showParcels]);

  return null;
}

export interface SiteMapProps {
  sites: SiteGeo[];
  selectedSiteId: string;
  showZones: boolean;
  showParcels: boolean;
  onSiteSelect: (siteId: string) => void;
}

export default function SiteMap({
  sites,
  selectedSiteId,
  showZones,
  showParcels,
  onSiteSelect,
}: SiteMapProps) {
  const tiles = tileConfig();
  const visibleSites = selectedSiteId
    ? sites.filter((site) => site.id === selectedSiteId)
    : sites;

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      className="h-full w-full"
    >
      <TileLayer url={tiles.url} attribution={tiles.attribution} />
      <MapBoundsUpdater
        sites={sites}
        selectedSiteId={selectedSiteId}
        showZones={showZones}
        showParcels={showParcels}
      />

      {visibleSites.map((site) => {
        if (site.geoLat == null || site.geoLng == null) return null;
        const position: [number, number] = [site.geoLat, site.geoLng];
        const zoneCount = site.zones.length;
        const parcelCount = site.zones.reduce((sum, zone) => sum + zone.parcelles.length, 0);

        return (
          <CircleMarker
            key={site.id}
            center={position}
            radius={selectedSiteId === site.id ? 10 : 8}
            pathOptions={{
              color: "#27272a",
              fillColor: selectedSiteId === site.id ? "#52525b" : "#71717a",
              fillOpacity: 0.9,
              weight: 2,
            }}
            eventHandlers={{
              click: () => onSiteSelect(site.id),
            }}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-medium">{site.name}</p>
                <p className="text-zinc-600">{site.shortCode}</p>
                <p className="text-xs text-zinc-500">
                  {zoneCount} zone{zoneCount > 1 ? "s" : ""} · {parcelCount} parcelle
                  {parcelCount > 1 ? "s" : ""}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}

      {showZones &&
        visibleSites.flatMap((site) =>
          site.zones.map((zone) => {
            const positions = geoPolygonToLatLngs(zone.geoPolygon);
            if (positions.length < 3) return null;
            return (
              <Polygon
                key={`zone-${zone.id}`}
                positions={positions}
                pathOptions={{
                  color: "#52525b",
                  weight: 2,
                  fillColor: "#a1a1aa",
                  fillOpacity: 0.2,
                }}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-medium">
                      Zone {zone.name}
                      {zone.code ? ` (${zone.code})` : ""}
                    </p>
                    <p className="text-xs text-zinc-500">{site.shortCode}</p>
                  </div>
                </Popup>
              </Polygon>
            );
          }),
        )}

      {showParcels &&
        visibleSites.flatMap((site) =>
          site.zones.flatMap((zone) =>
            zone.parcelles.map((parcel) => {
              const positions = geoPolygonToLatLngs(parcel.geoPolygon);
              if (positions.length < 3) return null;
              return (
                <Polygon
                  key={`parcel-${parcel.id}`}
                  positions={positions}
                  pathOptions={{
                    color: "#3f3f46",
                    weight: 1.5,
                    fillColor: "#d4d4d8",
                    fillOpacity: 0.35,
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <p className="font-medium">
                        {parcel.name}
                        {parcel.code ? ` (${parcel.code})` : ""}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {zone.name}
                        {parcel.surfaceHa
                          ? ` · ${Number(parcel.surfaceHa).toLocaleString("fr-MG")} ha`
                          : ""}
                      </p>
                    </div>
                  </Popup>
                </Polygon>
              );
            }),
          ),
        )}
    </MapContainer>
  );
}
