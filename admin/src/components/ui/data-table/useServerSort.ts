import { useState } from "react";
import type { SortDir } from "./useClientSort";

/** État de tri {orderBy, dir} à propager en paramètres de requête (endpoints paginés). */
export function useServerSort(defaultKey: string | null = null) {
  const [key, setKey] = useState<string | null>(defaultKey);
  const [dir, setDir] = useState<SortDir>("asc");

  function toggle(nextKey: string) {
    if (key !== nextKey) {
      setKey(nextKey);
      setDir("asc");
      return;
    }
    setDir((d) => (d === "asc" ? "desc" : "asc"));
  }

  return { sortKey: key, sortDir: dir, toggleSort: toggle };
}
