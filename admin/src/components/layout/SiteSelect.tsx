import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { ChevronDown, MapPin } from "lucide-react";
import { api } from "../../lib/api";
import type { Site } from "../../lib/referentials";
import { isSiteScopedPath, useSiteScope } from "../../lib/site-scope";
import { cn } from "../../lib/utils";

/** Sélecteur de site global : filtre toutes les pages qui savent filtrer par site. */
export default function SiteSelect() {
  const { pathname } = useLocation();
  const [siteId, setSiteId] = useSiteScope();
  const scoped = isSiteScopedPath(pathname);

  const { data: sites = [] } = useQuery({
    queryKey: ["sites", "select"],
    queryFn: () => api.get<{ data: Site[] }>("/sites").then((r) => r.data.data),
    staleTime: 5 * 60_000,
  });

  const activeSites = sites.filter((site) => site.active || site.id === siteId);

  return (
    <label
      className={cn(
        "relative hidden items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm sm:flex",
        scoped ? "text-zinc-800" : "text-zinc-400",
      )}
      title={scoped ? undefined : "Sans effet sur cette page"}
    >
      <MapPin className="h-4 w-4 shrink-0" aria-hidden />
      <span className="sr-only">Site</span>
      <select
        value={siteId}
        disabled={!scoped}
        onChange={(event) => setSiteId(event.target.value)}
        aria-label="Site affiché"
        className="alterra-focus max-w-[11rem] cursor-pointer appearance-none truncate bg-transparent pr-1 font-medium outline-none disabled:cursor-not-allowed"
      >
        <option value="">Tous les sites</option>
        {activeSites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name} ({site.shortCode})
          </option>
        ))}
      </select>
      <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
    </label>
  );
}
