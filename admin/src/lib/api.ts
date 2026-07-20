import axios from "axios";
import { useAuthStore } from "./auth-store";

export const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true, // sends the httpOnly refresh cookie
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing: Promise<string> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      refreshing ??= api
        .post("/auth/refresh")
        .then((res) => {
          useAuthStore.getState().setAccessToken(res.data.accessToken);
          return res.data.accessToken as string;
        })
        .finally(() => {
          refreshing = null;
        });

      const token = await refreshing.catch(() => null);
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);
