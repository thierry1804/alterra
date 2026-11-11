import { useLiveQuery } from "dexie-react-hooks";
import { db, type RequestOutboxKind, type RequestOutboxRecord } from "../db/db";
import { getMemoryUser } from "../lib/session";

/** Demandes de l'utilisateur courant encore stockées sur l'appareil (en attente ou refusées). */
export function useQueuedRequests(kinds: RequestOutboxKind[]): RequestOutboxRecord[] {
  const userId = getMemoryUser()?.id;
  const rows = useLiveQuery(
    () =>
      db.requestsOutbox
        .where("kind")
        .anyOf(kinds)
        .filter((record) => record.userId === userId)
        .sortBy("createdAt"),
    [kinds.join(","), userId],
  );
  return rows ?? [];
}
