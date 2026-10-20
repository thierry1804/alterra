import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import { useSiteScope } from "../lib/site-scope";
import type { SiteGeo } from "../lib/geo";
import PageHeader from "../components/shared/PageHeader";
import SiteMap from "../components/map/SiteMap";
import { Button } from "../components/ui/button";
import { IconButton } from "../components/ui/IconButton";
import { cn } from "../lib/utils";
import { formatPercent, type DashboardSummary } from "../lib/dashboard";

export default function MapPage() {
  const [selectedSiteId, setSelectedSiteId] = useSiteScope();
  const [showZones, setShowZones] = useState(true);
  const [showParcels, setShowParcels] = useState(true);

  const {
    data: sites = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["sites-geo"],
    queryFn: () =>
      api.get<{ data: SiteGeo[] }>("/sites/geo").then((response) => response.data.data),
  });

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) ?? null,
    [sites, selectedSiteId],
  );

  const siteKpis = useQuery({
    queryKey: ["dashboard", "kpis", selectedSiteId],
    queryFn: () =>
      api
        .get<DashboardSummary>("/dashboard/kpis", { params: { siteId: selectedSiteId } })
        .then((r) => r.data),
    enabled: Boolean(selectedSiteId),
  });

  const sitesWithCoords = sites.filter((site) => site.geoLat != null && site.geoLng != null);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cartographie"
        description="Sites ALTERRA, zones et parcelles sur fond OSM."
        action={
          <IconButton
            icon={RefreshCw}
            label="Actualiser"
            loading={isFetching}
            onClick={() => void refetch()}
          />
        }
      />

      <div
        className="flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Couches affichées"
      >
        {[
          { label: "Zones", on: showZones, set: setShowZones },
          { label: "Parcelles", on: showParcels, set: setShowParcels },
        ].map((layer) => (
          <button
            key={layer.label}
            type="button"
            aria-pressed={layer.on}
            onClick={() => layer.set(!layer.on)}
            className={cn(
              "alterra-focus rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
              layer.on
                ? "border-zinc-900 bg-zinc-900 text-white"
                : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
            )}
          >
            {layer.label}
          </button>
        ))}
        {selectedSite && (
          <button
            type="button"
            onClick={() => setSelectedSiteId("")}
            className="alterra-focus rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            {selectedSite.name} ✕
          </button>
        )}
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

        <aside className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
          {!selectedSite && (
            <>
              <h2 className="alterra-display text-base font-bold text-zinc-900">Sites</h2>
              <ul className="divide-y divide-zinc-100">
                {sites.map((site) => (
                  <li key={site.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedSiteId(site.id)}
                      className="alterra-focus flex w-full items-center justify-between gap-3 py-2 text-left text-sm hover:text-brand"
                    >
                      <span className="font-medium">{site.name}</span>
                      <span className="alterra-num text-xs text-muted">{site.shortCode}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted">
                Choisissez un site dans la liste ou cliquez un marqueur sur la carte.
              </p>
            </>
          )}
          {selectedSite && (
            <div className="space-y-4 text-sm">
              <div>
                <h2 className="alterra-display text-lg font-extrabold text-zinc-900">
                  {selectedSite.name}
                </h2>
                <p className="alterra-num text-xs text-muted">{selectedSite.shortCode}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-brand-tint p-3">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-brand">
                    Effectif actif
                  </p>
                  <p className="alterra-display alterra-num text-2xl font-extrabold text-brand">
                    {siteKpis.data?.kpis.activeWorkers ?? "—"}
                  </p>
                </div>
                <div className="rounded-lg bg-surface p-3">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-subtle">
                    Présence
                  </p>
                  <p className="alterra-display alterra-num text-2xl font-extrabold text-zinc-900">
                    {siteKpis.data ? formatPercent(siteKpis.data.kpis.presenceRate) : "—"}
                  </p>
                </div>
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
                  <dd className="alterra-num">{selectedSite.zones.length}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt>Parcelles</dt>
                  <dd className="alterra-num">
                    {selectedSite.zones.reduce((sum, zone) => sum + zone.parcelles.length, 0)}
                  </dd>
                </div>
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link to="/zones">Zones et parcelles</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/workers">Travailleurs</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/pointages">Pointages</Link>
                </Button>
              </div>
            </div>
          )}

          <div className="border-t border-zinc-200 pt-4">
            <p className="text-xs font-medium text-zinc-500">Sites géolocalisés</p>
            <p className="alterra-num mt-1 text-sm text-zinc-800">
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
