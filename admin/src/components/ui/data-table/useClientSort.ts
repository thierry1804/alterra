import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

/** Tri en mémoire — pour les tables chargées intégralement (pas de pagination serveur). */
export function useClientSort<T>(rows: T[], defaultKey: string | null = null) {
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

  const sorted = useMemo(() => {
    if (!key) return rows;
    const factor = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = (a as Record<string, unknown>)[key];
      const bv = (b as Record<string, unknown>)[key];
      if (av == null && bv == null) return 0;
      if (av == null) return -1 * factor;
      if (bv == null) return 1 * factor;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      return String(av).localeCompare(String(bv), "fr") * factor;
    });
  }, [rows, key, dir]);

  return { sorted, sortKey: key, sortDir: dir, toggleSort: toggle };
}
