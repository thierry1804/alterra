import axios, { isAxiosError, type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "./auth-store";

export const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

const AUTH_PATHS = ["/auth/login", "/auth/refresh", "/auth/logout"];

function isAuthPath(url: string | undefined): boolean {
  if (!url) return false;
  return AUTH_PATHS.some((path) => url.includes(path));
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await api.post("/auth/refresh");
    const token = res.data.accessToken as string;
    useAuthStore.getState().setAccessToken(token);
    return token;
  } catch (err) {
    // Seul un 401 du serveur signifie un refresh token vraiment invalide/expiré/révoqué — une
    // coupure réseau, un 5xx ou un 429 sont transitoires : ne jamais déconnecter pour ça, la
    // session reste valide et un prochain appel retentera le refresh normalement.
    if (isAxiosError(err) && err.response?.status === 401) {
      useAuthStore.getState().logout();
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
