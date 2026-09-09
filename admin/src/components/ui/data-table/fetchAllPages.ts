/**
 * Récupère la totalité d'un jeu de données paginé (au-delà de ce qui est déjà
 * chargé à l'écran), pour que le tri et l'export portent sur tout ce qui
 * correspond aux filtres actifs, pas seulement les lignes visibles.
 */

/** Pagination par curseur (Travailleurs, Utilisateurs, Pointages). */
export async function fetchAllCursorPages<T>(
  fetchPage: (cursor: string | null) => Promise<{ data: T[]; nextCursor: string | null; hasMore: boolean }>,
  maxPages = 200,
): Promise<T[]> {
  const all: T[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < maxPages; i++) {
    const page = await fetchPage(cursor);
    all.push(...page.data);
    if (!page.hasMore || !page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return all;
}

/** Pagination par numéro de page (Audit). */
export async function fetchAllOffsetPages<T>(
  fetchPage: (page: number) => Promise<{ data: T[]; hasMore: boolean }>,
  maxPages = 200,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const result = await fetchPage(page);
    all.push(...result.data);
    if (!result.hasMore) break;
  }
  return all;
}
