import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { Check, ChevronDown, MapPin } from "lucide-react";
import { api } from "../../lib/api";
import type { Site } from "../../lib/referentials";
import { isSiteScopedPath, useSiteScope } from "../../lib/site-scope";
import { cn } from "../../lib/utils";

/** Sélecteur de site global : filtre toutes les pages qui savent filtrer par site. */
export default function SiteSelect() {
  const { pathname } = useLocation();
  const [siteId, setSiteId] = useSiteScope();
  const scoped = isSiteScopedPath(pathname);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: sites = [] } = useQuery({
    queryKey: ["sites", "select"],
    queryFn: () => api.get<{ data: Site[] }>("/sites").then((r) => r.data.data),
    staleTime: 5 * 60_000,
  });

  const activeSites = sites.filter((site) => site.active || site.id === siteId);
  const currentLabel = siteId
    ? (activeSites.find((site) => site.id === siteId)?.name ?? "Tous les sites")
    : "Tous les sites";

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function choose(nextSiteId: string) {
    setSiteId(nextSiteId);
    setOpen(false);
  }

  return (
    <div className="relative hidden sm:block" ref={containerRef}>
      <button
        type="button"
        disabled={!scoped}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={scoped ? undefined : "Sans effet sur cette page"}
        className={cn(
          "alterra-focus flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm",
          "disabled:cursor-not-allowed",
          scoped ? "text-zinc-800 hover:border-zinc-300" : "text-zinc-400",
        )}
      >
        <MapPin className="h-4 w-4 shrink-0" aria-hidden />
        <span className="max-w-[11rem] truncate font-medium">{currentLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-11 z-dropdown w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white py-1 shadow-overlay"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => choose("")}
            className="alterra-focus flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50"
          >
            <Check
              className={cn("h-4 w-4 shrink-0", siteId === "" ? "opacity-100" : "opacity-0")}
              aria-hidden
            />
            <span
              className={cn(
                "truncate",
                siteId === "" ? "font-medium text-zinc-900" : "text-zinc-700",
              )}
            >
              Tous les sites
            </span>
          </button>
          {activeSites.map((site) => (
            <button
              key={site.id}
              type="button"
              role="menuitem"
              onClick={() => choose(site.id)}
              className="alterra-focus flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-50"
            >
              <Check
                className={cn("h-4 w-4 shrink-0", siteId === site.id ? "opacity-100" : "opacity-0")}
                aria-hidden
              />
              <span
                className={cn(
                  "truncate",
                  siteId === site.id ? "font-medium text-zinc-900" : "text-zinc-700",
                )}
              >
                {site.name} ({site.shortCode})
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
