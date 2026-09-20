import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";

const EMPTY_ACCESSORS: Record<string, (row: never) => unknown> = {};

/** Tri d'un tableau en mémoire — utilisable seul quand plusieurs listes partagent le même état de tri. */
export function sortRows<T>(
  rows: T[],
  key: string | null,
  dir: SortDir,
  /** Pour une colonne dont l'affichage est une valeur résolue (ex. nom de site depuis un id) plutôt qu'un champ brut. */
  accessors: Record<string, (row: T) => unknown> = EMPTY_ACCESSORS as Record<
    string,
    (row: T) => unknown
  >,
): T[] {
  if (!key) return rows;
  const factor = dir === "asc" ? 1 : -1;
  const accessor = accessors[key] ?? ((row: T) => (row as Record<string, unknown>)[key]);
  return [...rows].sort((a, b) => {
    const av = accessor(a);
    const bv = accessor(b);
    if (av == null && bv == null) return 0;
    if (av == null) return -1 * factor;
    if (bv == null) return 1 * factor;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
    return String(av).localeCompare(String(bv), "fr") * factor;
  });
}

/** État de tri seul (colonne + sens) — un clic sur la colonne active inverse le sens. */
export function useSortState(defaultKey: string | null = null) {
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

/** Tri en mémoire — pour les tables chargées intégralement (pas de pagination serveur). */
export function useClientSort<T>(
  rows: T[],
  defaultKey: string | null = null,
  accessors: Record<string, (row: T) => unknown> = EMPTY_ACCESSORS as Record<
    string,
    (row: T) => unknown
  >,
) {
  const { sortKey, sortDir, toggleSort } = useSortState(defaultKey);
  const sorted = useMemo(
    () => sortRows(rows, sortKey, sortDir, accessors),
    [rows, sortKey, sortDir, accessors],
  );
  return { sorted, sortKey, sortDir, toggleSort };
}
