import { Prisma } from "@prisma/client";
import { ApiError } from "../../middleware/error-handler.js";

/**
 * Création idempotente pour les envois hors ligne de la PWA : le même `clientUuid` renvoyé après une
 * coupure (réponse perdue, nouvelle tentative) retourne la ligne déjà créée au lieu d'un doublon.
 * Sans `clientUuid` (admin, anciens clients), c'est une création ordinaire.
 */
export async function createOnce<T extends { requestedById: string }>(
  clientUuid: string | undefined,
  userId: string,
  find: (clientUuid: string) => Promise<T | null>,
  create: () => Promise<T>,
): Promise<T> {
  if (!clientUuid) return create();

  const reuse = (existing: T): T => {
    if (existing.requestedById !== userId) {
      throw new ApiError(409, "CLIENT_UUID_CONFLICT", "Identifiant client déjà utilisé");
    }
    return existing;
  };

  const existing = await find(clientUuid);
  if (existing) return reuse(existing);

  try {
    return await create();
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const raced = await find(clientUuid);
      if (raced) return reuse(raced);
    }
    throw err;
  }
}
