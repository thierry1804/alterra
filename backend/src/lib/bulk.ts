import { z } from "zod";
import { ApiError } from "../middleware/error-handler.js";

export interface BulkItemResult {
  id: string;
  status: "ok" | "error";
  error?: string;
}

/**
 * Exécute `fn` pour chaque id, séquentiellement, sans transaction globale :
 * les règles métier (ex. contrôle biométrique par travailleur) diffèrent
 * ligne par ligne, donc un échec ne doit jamais annuler les autres lignes
 * du lot. Chaque appel journalise son propre avant/après si besoin (à faire
 * dans `fn`) — pas de writeAuditLog batch ici.
 */
export async function runBulk(
  ids: string[],
  fn: (id: string) => Promise<void>,
): Promise<BulkItemResult[]> {
  const results: BulkItemResult[] = [];
  for (const id of ids) {
    try {
      await fn(id);
      results.push({ id, status: "ok" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Erreur inattendue";
      results.push({ id, status: "error", error: message });
    }
  }
  return results;
}

export const bulkIdsSchema = z.array(z.string().uuid()).min(1).max(200);
