import { useEffect, type ReactNode } from "react";
import { CircleMarker, MapContainer, Polygon, Popup, useMap } from "react-leaflet";
import type { LatLngBoundsExpression, LeafletMouseEvent, Polygon as LeafletPolygon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { collectGeoBounds, geoGeometryToLeaflet, type SiteGeo } from "../../lib/geo";
import { BasemapLayers } from "./BasemapLayers";
import type { BasemapStyle } from "../../lib/map-tiles";
import { useMapTilerKey } from "../../hooks/useAppSettings";

const DEFAULT_CENTER: [number, number] = [-18.91, 47.52];
const DEFAULT_ZOOM = 6;

interface MapBoundsUpdaterProps {
  sites: SiteGeo[];
  selectedSiteId: string;
  showZones: boolean;
  showParcels: boolean;
  fitParcelsOnly: boolean;
}

function MapBoundsUpdater({
  sites,
  selectedSiteId,
  showZones,
  showParcels,
  fitParcelsOnly,
}: MapBoundsUpdaterProps) {
  const map = useMap();

  useEffect(() => {
    const points = collectGeoBounds(sites, {
      siteId: selectedSiteId || undefined,
      includeZones: showZones && !fitParcelsOnly,
      includeParcels: showParcels,
      includeSitePoint: !fitParcelsOnly,
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
  }, [map, sites, selectedSiteId, showZones, showParcels, fitParcelsOnly]);

  return null;
}

function zoomToParcel(map: ReturnType<typeof useMap>, event: LeafletMouseEvent) {
  const layer = event.target as LeafletPolygon;
  map.fitBounds(layer.getBounds(), { padding: [32, 32], maxZoom: 18 });
  layer.openPopup();
}

function ParcelPolygon({
  positions,
  children,
}: {
  positions: [number, number][][][];
  children: ReactNode;
}) {
  const map = useMap();
  return (
    <Polygon
      positions={positions}
      pathOptions={{
        color: "#3f3f46",
        weight: 1.5,
        fillColor: "#d4d4d8",
        fillOpacity: 0.35,
      }}
      eventHandlers={{
        click: (event) => zoomToParcel(map, event),
      }}
    >
      {children}
    </Polygon>
  );
}

export interface SiteMapProps {
  sites: SiteGeo[];
  selectedSiteId: string;
  showZones: boolean;
  showParcels: boolean;
  fitParcelsOnly?: boolean;
  basemapStyle?: BasemapStyle;
  onSiteSelect: (siteId: string) => void;
}

export default function SiteMap({
  sites,
  selectedSiteId,
  showZones,
  showParcels,
  fitParcelsOnly = false,
  basemapStyle = "plan",
  onSiteSelect,
}: SiteMapProps) {
  const basemap = useMapTilerKey();
  const visibleSites = selectedSiteId ? sites.filter((site) => site.id === selectedSiteId) : sites;

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      className="h-full w-full"
    >
      <BasemapLayers basemap={basemap} style={basemapStyle} />
      <MapBoundsUpdater
        sites={sites}
        selectedSiteId={selectedSiteId}
        showZones={showZones}
        showParcels={showParcels}
        fitParcelsOnly={fitParcelsOnly}
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
            const positions = geoGeometryToLeaflet(zone.geoPolygon);
            if (!positions) return null;
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
              const positions = geoGeometryToLeaflet(parcel.geoPolygon);
              if (!positions) return null;
              return (
                <ParcelPolygon key={`parcel-${parcel.id}`} positions={positions}>
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
                </ParcelPolygon>
              );
            }),
          ),
        )}
    </MapContainer>
  );
}
