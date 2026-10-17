import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { fetchMyRejectedPointages } from "../lib/pointages";

const POLL_INTERVAL_MS = 60_000;

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
      const rows = await fetchMyRejectedPointages(user.id);
      setCount(rows.length);
    } catch {
      // Silencieux — pas critique, le prochain poll réessaiera.
    }
  }, [user]);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  return count;
}
