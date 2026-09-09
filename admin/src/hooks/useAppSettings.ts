import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface AppSettings {
  appName: string;
  iconUpdatedAt: string | null;
}

const DEFAULT_APP_SETTINGS: AppSettings = { appName: "ALTERRA", iconUpdatedAt: null };

export const APP_ICON_URL = "/api/v1/app-settings/icon";

/** Nom/icône de l'application, modifiables depuis l'Admin — route publique, utilisable avant connexion. */
export function useAppSettings() {
  const { data } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => api.get<AppSettings>("/app-settings").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const settings = data ?? DEFAULT_APP_SETTINGS;
  const iconUrl = settings.iconUpdatedAt
    ? `${APP_ICON_URL}?v=${encodeURIComponent(settings.iconUpdatedAt)}`
    : APP_ICON_URL;

  return { ...settings, iconUrl };
}
