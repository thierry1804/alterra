import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export interface AppSettings {
  appName: string;
  iconUpdatedAt: string | null;
  loginBackgroundUpdatedAt: string | null;
  loginBranchUpdatedAt: string | null;
  loginLeafUpdatedAt: string | null;
}

const DEFAULT_APP_SETTINGS: AppSettings = {
  appName: "ALTERRA",
  iconUpdatedAt: null,
  loginBackgroundUpdatedAt: null,
  loginBranchUpdatedAt: null,
  loginLeafUpdatedAt: null,
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

  return {
    ...settings,
    iconUrl: withCacheBust(APP_ICON_URL, settings.iconUpdatedAt),
    loginBackgroundUrl: withCacheBust(LOGIN_BACKGROUND_URL, settings.loginBackgroundUpdatedAt),
    loginBranchUrl: withCacheBust(LOGIN_BRANCH_URL, settings.loginBranchUpdatedAt),
    loginLeafUrl: withCacheBust(LOGIN_LEAF_URL, settings.loginLeafUpdatedAt),
  };
}
