import { isAxiosError } from "axios";
import { db } from "../db/db";

const PREFIX = "cache:";

/** Vrai quand la requête n'a obtenu aucune réponse du serveur (hors ligne, coupure, timeout). */
export function isNetworkError(err: unknown): boolean {
  return isAxiosError(err) && !err.response;
}

/**
 * Charge une donnée via le réseau et en garde une copie locale ; sans réseau, renvoie la dernière
 * copie connue (`stale: true`). Les copies sont purgées à la déconnexion (`purgeLocalData`).
 */
export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<{ data: T; stale: boolean }> {
  try {
    const data = await fetcher();
    await db.settings
      .put({ key: PREFIX + key, value: JSON.stringify(data) })
      .catch(() => undefined);
    return { data, stale: false };
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    const stored = await db.settings.get(PREFIX + key).catch(() => undefined);
    if (!stored) throw err;
    return { data: JSON.parse(stored.value) as T, stale: true };
  }
}
