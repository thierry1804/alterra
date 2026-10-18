import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { fetchMyPointages } from "../lib/pointages";
import { isSocketConnected } from "../lib/socket";

const POLL_INTERVAL_MS = 60_000;

/** Diffusé après une action locale ou un event socket sur les pointages du CDE. */
export const POINTAGES_UPDATED_EVENT = "alterra:my-pointages-updated";

/** Nombre de pointages rejetés du CDE — socket + poll fallback. */
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
    const interval = setInterval(() => {
      if (!isSocketConnected()) void refresh();
    }, POLL_INTERVAL_MS);
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
