import axios, { isAxiosError, type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { clearPersistedSession, getMemoryAccessToken, updatePersistedAccessToken } from "./session";

export const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const AUTH_PATHS = ["/auth/login", "/auth/refresh", "/auth/logout"];

function isAuthPath(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_PATHS.some((path) => url.includes(path));
}

let refreshPromise: Promise<string | null> | null = null;

api.interceptors.request.use((config) => {
  const token = getMemoryAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await api.post<{ accessToken: string }>("/auth/refresh");
    const token = res.data.accessToken;
    await updatePersistedAccessToken(token);
    return token;
  } catch (err) {
    // Seul un 401 du serveur signifie un refresh token vraiment invalide/expiré/révoqué — une
    // coupure réseau, un 5xx ou un 429 sont transitoires : ne jamais déconnecter pour ça (la PWA
    // doit rester utilisable hors-ligne), un prochain appel retentera le refresh normalement.
    if (isAxiosError(err) && err.response?.status === 401) {
      await clearPersistedSession().catch(() => undefined);
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as RetryConfig | undefined;
    if (!original || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    if (isAuthPath(original.url) || original._retry) {
      return Promise.reject(error);
    }

    original._retry = true;
    refreshPromise ??= refreshAccessToken().finally(() => {
      refreshPromise = null;
    });

    const token = await refreshPromise;
    if (!token) {
      return Promise.reject(error);
    }

    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  },
);

export type { AuthUser } from "./session";
