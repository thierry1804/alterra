import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { fetchAllClarificationRequests } from "../lib/workflows";

const POLL_INTERVAL_MS = 60_000;

/** Diffusé après qu'une demande de précision change d'état (réponse envoyée), pour que ce bandeau
 * se mette à jour tout de suite plutôt que d'attendre jusqu'à 60s. */
export const CLARIFICATIONS_UPDATED_EVENT = "alterra:clarifications-updated";

/** Nombre de demandes de précisions ouvertes pour l'équipe du CDE courant — pas de push, donc on
 * repolle en tâche de fond (même pattern que useRejectedCount). */
export function useOpenClarificationsCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user || user.role !== "CHEF_EQUIPE") {
      setCount(0);
      return;
    }
    try {
      const rows = await fetchAllClarificationRequests("OPEN");
      setCount(rows.length);
    } catch {
      // Silencieux — pas critique, le prochain poll réessaiera.
    }
  }, [user]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    window.addEventListener(CLARIFICATIONS_UPDATED_EVENT, refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(CLARIFICATIONS_UPDATED_EVENT, refresh);
    };
  }, [refresh]);

  return count;
}
