import { useEffect } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../lib/auth-store";

/**
 * Au premier montage, tente de restaurer la session via le cookie httpOnly
 * refreshToken (le token d'accès ne vit qu'en mémoire, donc il est perdu à
 * chaque rechargement de page). Sans ça, ProtectedRoute renvoie vers /login
 * à chaque F5 même si le refresh cookie est encore valide.
 *
 * La promesse est mémoïsée au niveau module (pas dans useEffect) car le
 * refresh token est à usage unique (rotation) : en StrictMode, React invoque
 * l'effet deux fois au montage, ce qui enverrait deux requêtes /auth/refresh
 * avec le même cookie — la première consomme le token, la seconde reçoit un
 * 401 "revoked". Un singleton garantit un seul appel réseau quel que soit le
 * nombre d'exécutions de l'effet.
 */
let bootstrapPromise: Promise<void> | null = null;

function runBootstrap(): Promise<void> {
  bootstrapPromise ??= (async () => {
    try {
      const refreshRes = await api.post("/auth/refresh");
      const accessToken = refreshRes.data.accessToken as string;

      // Fixer accessToken et user d'un coup à la fin seulement : les fixer
      // séparément créerait une fenêtre où isAuthenticated=true et user=null,
      // que RoleGuard lirait comme "authentifié mais mauvais rôle" (redirect
      // /forbidden) au lieu de "chargement en cours".
      const meRes = await api.get("/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      useAuthStore.getState().setSession(accessToken, meRes.data);
    } catch {
      useAuthStore.getState().logout();
    } finally {
      useAuthStore.getState().setReady();
    }
  })();
  return bootstrapPromise;
}

export function useAuthBootstrap() {
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    void runBootstrap();
  }, []);

  return { ready: status === "ready" };
}
