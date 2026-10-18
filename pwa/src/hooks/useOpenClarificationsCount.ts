import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { fetchAllClarificationRequests } from "../lib/workflows";
import { isSocketConnected } from "../lib/socket";

const POLL_INTERVAL_MS = 60_000;

/** Diffusé après qu'une demande de précision change d'état (réponse envoyée / event socket). */
export const CLARIFICATIONS_UPDATED_EVENT = "alterra:clarifications-updated";

/** Compteur OPEN pour le CDE — rafraîchi via socket (+ poll fallback si déconnecté). */
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
    const interval = setInterval(() => {
      if (!isSocketConnected()) void refresh();
    }, POLL_INTERVAL_MS);
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
