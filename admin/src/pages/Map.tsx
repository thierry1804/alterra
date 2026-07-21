import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { SiteGeo } from "../lib/geo";
import PageHeader from "../components/shared/PageHeader";
import SiteMap from "../components/map/SiteMap";
import { Button } from "../components/ui/button";
import { Label } from "../components/ui/label";

export default function MapPage() {
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [showZones, setShowZones] = useState(true);
  const [showParcels, setShowParcels] = useState(true);

  const { data: sites = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["sites-geo"],
    queryFn: () => api.get<{ data: SiteGeo[] }>("/sites/geo").then((response) => response.data.data),
  });

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) ?? null,
    [sites, selectedSiteId],
  );

  const sitesWithCoords = sites.filter(
    (site) => site.geoLat != null && site.geoLng != null,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cartographie"
        description="Sites ALTERRA, zones et parcelles sur fond OSM."
        action={
          <Button type="button" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? "Actualisation…" : "Actualiser"}
          </Button>
        }
      />

      <div className="flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 p-4">
        <div className="space-y-2">
          <Label htmlFor="map-site">Site</Label>
          <select
            id="map-site"
            value={selectedSiteId}
            onChange={(event) => setSelectedSiteId(event.target.value)}
            className="w-56 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Tous les sites</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name} ({site.shortCode})
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={showZones}
            onChange={(event) => setShowZones(event.target.checked)}
          />
          Zones
        </label>

        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <input
            type="checkbox"
            checked={showParcels}
            onChange={(event) => setShowParcels(event.target.checked)}
          />
          Parcelles
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="h-[min(70vh,640px)] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-600">
              Chargement de la carte…
            </div>
          ) : sites.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              Aucun site actif à afficher.
            </div>
          ) : (
            <SiteMap
              sites={sites}
              selectedSiteId={selectedSiteId}
              showZones={showZones}
              showParcels={showParcels}
              onSiteSelect={setSelectedSiteId}
            />
          )}
        </div>

        <aside className="rounded-lg border border-zinc-200 bg-white p-4">
          <h2 className="text-sm font-medium text-zinc-900">Site sélectionné</h2>
          {!selectedSite && (
            <p className="mt-3 text-sm text-zinc-500">
              Choisissez un site dans la liste ou cliquez un marqueur sur la carte.
            </p>
          )}
          {selectedSite && (
            <div className="mt-3 space-y-3 text-sm">
              <div>
                <p className="font-medium text-zinc-900">{selectedSite.name}</p>
                <p className="text-zinc-600">{selectedSite.shortCode}</p>
              </div>
              <dl className="space-y-2 text-zinc-700">
                <div className="flex justify-between gap-3">
                  <dt>Coordonnées</dt>
                  <dd className="text-right font-mono text-xs">
                    {selectedSite.geoLat != null && selectedSite.geoLng != null
                      ? `${selectedSite.geoLat.toFixed(4)}, ${selectedSite.geoLng.toFixed(4)}`
                      : "Non définies"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Zones</dt>
                  <dd>{selectedSite.zones.length}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Parcelles</dt>
                  <dd>
                    {selectedSite.zones.reduce((sum, zone) => sum + zone.parcelles.length, 0)}
                  </dd>
                </div>
              </dl>
              <Button asChild variant="ghost" size="sm">
                <Link to="/zones">Gérer zones et parcelles</Link>
              </Button>
            </div>
          )}

          <div className="mt-6 border-t border-zinc-200 pt-4">
            <p className="text-xs font-medium text-zinc-500">Sites géolocalisés</p>
            <p className="mt-1 text-sm text-zinc-800">
              {sitesWithCoords.length} / {sites.length}
            </p>
            {sitesWithCoords.length < sites.length && (
              <p className="mt-2 text-xs text-zinc-500">
                Complétez geoLat/geoLng dans la fiche site pour afficher tous les marqueurs.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
