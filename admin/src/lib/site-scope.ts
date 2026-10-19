import { create } from "zustand";

const STORAGE_KEY = "alterra-admin-site";

/** Pages dont les données suivent le sélecteur de site global (le reste n'est pas filtrable par site). */
export const SITE_SCOPED_PATHS = [
  "/",
  "/pointages",
  "/payments",
  "/workers",
  "/users",
  "/reports",
  "/zones",
  "/map",
];

export function isSiteScopedPath(pathname: string): boolean {
  return SITE_SCOPED_PATHS.some((path) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path),
  );
}

function readStoredSite(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

interface SiteScopeState {
  /** Identifiant du site choisi, chaîne vide = tous les sites. */
  siteId: string;
  setSiteId: (siteId: string) => void;
}

export const useSiteScopeStore = create<SiteScopeState>((set) => ({
  siteId: readStoredSite(),
  setSiteId: (siteId) => {
    try {
      if (siteId) window.localStorage.setItem(STORAGE_KEY, siteId);
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Stockage indisponible : le choix reste valable pour la session.
    }
    set({ siteId });
  },
}));

/** Même signature qu'un useState : la page et le sélecteur global partagent le même filtre de site. */
export function useSiteScope(): [string, (siteId: string) => void] {
  const siteId = useSiteScopeStore((state) => state.siteId);
  const setSiteId = useSiteScopeStore((state) => state.setSiteId);
  return [siteId, setSiteId];
}
