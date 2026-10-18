import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { fetchMyPointages } from "../lib/pointages";

const POLL_INTERVAL_MS = 60_000;

/** Diffusé après une action qui change l'état des pointages du CDE (ex. correction d'un rejet),
 * pour que ce bandeau — qui vit indépendamment de la page "Mes pointages" — se mette à jour tout
 * de suite au lieu d'attendre jusqu'à 60s, ce qui donnait l'impression qu'un renvoi n'avait rien fait. */
export const POINTAGES_UPDATED_EVENT = "alterra:my-pointages-updated";

/** Nombre de pointages rejetés du CDE courant — pas de push, donc on repolle en tâche de fond. */
export function useRejectedCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user || user.role !== "CHEF_EQUIPE") {
      setCount(0);
      return;
    }
    try {
      const rows = await fetchMyPointages(user.id);
      setCount(rows.filter((p) => p.status === "REJECTED").length);
    } catch {
      // Silencieux — pas critique, le prochain poll réessaiera.
    }
  }, [user]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    window.addEventListener(POINTAGES_UPDATED_EVENT, refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(POINTAGES_UPDATED_EVENT, refresh);
    };
  }, [refresh]);

  return count;
}
