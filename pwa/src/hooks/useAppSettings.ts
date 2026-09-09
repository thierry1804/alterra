import { useEffect, useState } from "react";
import { api } from "../lib/api";

export interface AppSettings {
  appName: string;
  iconUpdatedAt: string | null;
}

const DEFAULT_APP_SETTINGS: AppSettings = { appName: "ALTERRA", iconUpdatedAt: null };

let cached: AppSettings | null = null;
let inFlight: Promise<AppSettings> | null = null;

function fetchAppSettings(): Promise<AppSettings> {
  inFlight ??= api
    .get<AppSettings>("/app-settings")
    .then((r) => {
      cached = r.data;
      return r.data;
    })
    .catch(() => DEFAULT_APP_SETTINGS)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export const APP_ICON_URL = "/api/v1/app-settings/icon";

/** Nom/icône de l'application, modifiables depuis l'Admin — appel public, utilisable avant connexion. */
export function useAppSettings(): AppSettings & { iconUrl: string } {
  const [settings, setSettings] = useState<AppSettings>(cached ?? DEFAULT_APP_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    fetchAppSettings().then((data) => {
      if (!cancelled) setSettings(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const iconUrl = settings.iconUpdatedAt
    ? `${APP_ICON_URL}?v=${encodeURIComponent(settings.iconUpdatedAt)}`
    : APP_ICON_URL;

  return { ...settings, iconUrl };
}
