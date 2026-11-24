import { useEffect, useState } from "react";
import { api } from "../lib/api";

export interface AppSettings {
  appName: string;
  iconUpdatedAt: string | null;
  loginBackgroundUpdatedAt: string | null;
  loginBranchUpdatedAt: string | null;
  loginLeafUpdatedAt: string | null;
  bioValidationRequired: boolean;
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  appName: "ALTERRA",
  iconUpdatedAt: null,
  loginBackgroundUpdatedAt: null,
  loginBranchUpdatedAt: null,
  loginLeafUpdatedAt: null,
  bioValidationRequired: true,
};

const STORAGE_KEY = "alterra:app-settings";

/** Dernier réglage connu d'une session précédente : le nom de l'application s'affiche aussi hors ligne. */
function readStored(): AppSettings | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_APP_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) } : null;
  } catch {
    return null;
  }
}

function writeStored(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Stockage indisponible : le nom revient au défaut hors ligne, rien de plus.
  }
}

let cached: AppSettings | null = readStored();
let inFlight: Promise<AppSettings> | null = null;

function fetchAppSettings(): Promise<AppSettings> {
  inFlight ??= api
    .get<AppSettings>("/app-settings")
    .then((r) => {
      cached = r.data;
      writeStored(r.data);
      return r.data;
    })
    .catch(() => cached ?? DEFAULT_APP_SETTINGS)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export const APP_ICON_URL = "/api/v1/app-settings/icon";
export const LOGIN_BACKGROUND_URL = "/api/v1/app-settings/login-background";
export const LOGIN_BRANCH_URL = "/api/v1/app-settings/login-branch";
export const LOGIN_LEAF_URL = "/api/v1/app-settings/login-leaf";

function withCacheBust(url: string, updatedAt: string | null): string {
  return updatedAt ? `${url}?v=${encodeURIComponent(updatedAt)}` : url;
}

export interface AppSettingsWithUrls extends AppSettings {
  iconUrl: string;
  loginBackgroundUrl: string;
  loginBranchUrl: string;
  loginLeafUrl: string;
}

/** Nom/icône/visuels de login de l'application, modifiables depuis l'Admin — appel public, utilisable avant connexion. */
export function useAppSettings(): AppSettingsWithUrls {
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

  return {
    ...settings,
    iconUrl: withCacheBust(APP_ICON_URL, settings.iconUpdatedAt),
    loginBackgroundUrl: withCacheBust(LOGIN_BACKGROUND_URL, settings.loginBackgroundUpdatedAt),
    loginBranchUrl: withCacheBust(LOGIN_BRANCH_URL, settings.loginBranchUpdatedAt),
    loginLeafUrl: withCacheBust(LOGIN_LEAF_URL, settings.loginLeafUpdatedAt),
  };
}
