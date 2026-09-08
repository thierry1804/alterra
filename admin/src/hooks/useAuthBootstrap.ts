import { useEffect } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/auth-store";

/**
 * Au premier montage, tente de restaurer la session via le cookie httpOnly
 * refreshToken (le token d'accès ne vit qu'en mémoire, donc il est perdu à
 * chaque rechargement de page). Sans ça, ProtectedRoute renvoie vers /login
 * à chaque F5 même si le refresh cookie est encore valide.
 */
export function useAuthBootstrap() {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const refreshRes = await api.post("/auth/refresh");
        const accessToken = refreshRes.data.accessToken as string;
        useAuthStore.getState().setAccessToken(accessToken);

        const meRes = await api.get("/me");
        if (!cancelled) {
          useAuthStore.getState().setSession(accessToken, meRes.data);
        }
      } catch {
        if (!cancelled) {
          useAuthStore.getState().logout();
        }
      } finally {
        if (!cancelled) {
          useAuthStore.getState().setReady();
        }
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ready: status === "ready" };
}
