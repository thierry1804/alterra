import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "../lib/api";
import { setAmountDecimals } from "../lib/money";

export interface AppSettings {
  appName: string;
  iconUpdatedAt: string | null;
  loginBackgroundUpdatedAt: string | null;
  loginBranchUpdatedAt: string | null;
  loginLeafUpdatedAt: string | null;
  mapTilerKeyConfigured: boolean;
  /** Nombre de décimales des montants de paiement (0 à 2). */
  amountDecimals: number;
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  appName: "ALTERRA",
  iconUpdatedAt: null,
  loginBackgroundUpdatedAt: null,
  loginBranchUpdatedAt: null,
  loginLeafUpdatedAt: null,
  mapTilerKeyConfigured: false,
  amountDecimals: 0,
};

export const APP_ICON_URL = "/api/v1/app-settings/icon";
export const LOGIN_BACKGROUND_URL = "/api/v1/app-settings/login-background";
export const LOGIN_BRANCH_URL = "/api/v1/app-settings/login-branch";
export const LOGIN_LEAF_URL = "/api/v1/app-settings/login-leaf";

function withCacheBust(url: string, updatedAt: string | null): string {
  return updatedAt ? `${url}?v=${encodeURIComponent(updatedAt)}` : url;
}

/** Nom/icône/visuels de login de l'application, modifiables depuis l'Admin — route publique, utilisable avant connexion. */
export function useAppSettings() {
  const { data } = useQuery({
    queryKey: ["app-settings"],
    queryFn: () => api.get<AppSettings>("/app-settings").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const settings = data ?? DEFAULT_APP_SETTINGS;

  useEffect(() => {
    if (data) setAmountDecimals(data.amountDecimals);
  }, [data]);

  return {
    ...settings,
    iconUrl: withCacheBust(APP_ICON_URL, settings.iconUpdatedAt),
    loginBackgroundUrl: withCacheBust(LOGIN_BACKGROUND_URL, settings.loginBackgroundUpdatedAt),
    loginBranchUrl: withCacheBust(LOGIN_BRANCH_URL, settings.loginBranchUpdatedAt),
    loginLeafUrl: withCacheBust(LOGIN_LEAF_URL, settings.loginLeafUpdatedAt),
  };
}

export interface MapTilerKeyResponse {
  apiKey: string | null;
  source: "database" | "env" | "none";
}

/** Clé MapTiler résolue (base > .env > aucune) — route authentifiée, jamais exposée publiquement. */
export function useMapTilerKey() {
  const { data } = useQuery({
    queryKey: ["app-settings", "map-key"],
    queryFn: () => api.get<MapTilerKeyResponse>("/app-settings/map-key").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  return data ?? { apiKey: null, source: "none" as const };
}
