import { isAxiosError } from "axios";
import { db, type RequestOutboxKind, type RequestOutboxRecord } from "../db/db";
import { api } from "./api";
import { getMemoryUser } from "./session";
import { isNetworkError } from "./offline-cache";
import { uploadWorkflowPhoto } from "./workflows";

export type NewOutboxRequest = Pick<
  RequestOutboxRecord,
  "clientUuid" | "kind" | "payload" | "targetId" | "photo" | "photoKey"
>;

export function newClientUuid(): string {
  return crypto.randomUUID();
}

/** Envoie une demande au serveur (téléverse d'abord la photo si besoin). Idempotent via `clientUuid`. */
async function sendRequest(record: NewOutboxRequest): Promise<void> {
  const { kind, clientUuid, payload } = record;

  if (kind === "activity") {
    await api.post("/activity-requests", { ...payload, clientUuid });
    return;
  }
  if (kind === "clarification") {
    await api.post("/clarification-requests", { ...payload, clientUuid });
    return;
  }

  const photoEndpoint =
    kind === "worker" ? "/worker-requests/photo" : "/clarification-requests/photo";
  if (record.photo && !record.photoKey) {
    record.photoKey = await uploadWorkflowPhoto(record.photo, photoEndpoint);
    // Mémorisé tout de suite : une reprise après coupure ne téléverse pas la photo deux fois.
    await db.requestsOutbox.update(clientUuid, { photoKey: record.photoKey }).catch(() => 0);
  }

  if (kind === "worker") {
    await api.post("/worker-requests", {
      ...payload,
      clientUuid,
      proposedPhotoKey: record.photoKey,
    });
    return;
  }

  await api.patch(`/clarification-requests/${record.targetId}/answer`, {
    ...payload,
    answerPhotoKey: record.photoKey,
  });
}

async function queueRequest(record: NewOutboxRequest): Promise<void> {
  const userId = getMemoryUser()?.id;
  if (!userId) throw new Error("Session expirée");
  await db.requestsOutbox.put({
    ...record,
    userId,
    status: "pending",
    createdAt: new Date().toISOString(),
  });
}

/**
 * Envoie la demande tout de suite si le réseau répond ; sinon (hors ligne ou coupure) la range dans la
 * file locale, envoyée à la reconnexion par `syncRequestsOutbox`. Une erreur du serveur (validation,
 * droits…) est relancée pour être affichée : elle ne se résoudrait pas en réessayant.
 */
export async function submitOrQueue(record: NewOutboxRequest): Promise<"sent" | "queued"> {
  if (!navigator.onLine) {
    await queueRequest(record);
    return "queued";
  }
  try {
    await sendRequest(record);
    return "sent";
  } catch (err) {
    if (!isNetworkError(err)) throw err;
    await queueRequest(record);
    return "queued";
  }
}

export async function discardQueuedRequest(clientUuid: string): Promise<void> {
  await db.requestsOutbox.delete(clientUuid);
}

export async function countPendingRequests(): Promise<number> {
  const userId = getMemoryUser()?.id;
  return db.requestsOutbox
    .where("status")
    .anyOf("pending", "syncing")
    .filter((record) => record.userId === userId)
    .count();
}

function rejectionMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const message = (err.response?.data as { message?: string } | undefined)?.message;
    if (message) return message;
  }
  return "Refusée par le serveur";
}

export interface RequestsOutboxResult {
  synced: number;
  rejected: number;
}

/** Envoie les demandes en attente, dans l'ordre de saisie. S'arrête à la première panne réseau. */
export async function syncRequestsOutbox(): Promise<RequestsOutboxResult> {
  const totals: RequestsOutboxResult = { synced: 0, rejected: 0 };

  // Reprise après interruption (onglet fermé en plein envoi).
  await db.requestsOutbox.where("status").equals("syncing").modify({ status: "pending" });

  const userId = getMemoryUser()?.id;
  if (!userId) return totals;

  const pending = (
    await db.requestsOutbox.where("status").equals("pending").sortBy("createdAt")
  ).filter((record) => record.userId === userId);

  for (const record of pending) {
    await db.requestsOutbox.update(record.clientUuid, { status: "syncing" });
    try {
      await sendRequest(record);
      await db.requestsOutbox.delete(record.clientUuid);
      totals.synced++;
    } catch (err) {
      const status = isAxiosError(err) ? err.response?.status : undefined;
      // Réseau, 5xx, 429 et 401 (jeton en cours de renouvellement) sont transitoires : on réessaiera.
      const transient =
        isNetworkError(err) ||
        status === undefined ||
        status >= 500 ||
        status === 429 ||
        status === 401;
      if (transient) {
        await db.requestsOutbox.update(record.clientUuid, { status: "pending" });
        break;
      }
      await db.requestsOutbox.update(record.clientUuid, {
        status: "rejected",
        error: rejectionMessage(err),
      });
      totals.rejected++;
    }
  }

  return totals;
}

export type { RequestOutboxKind };
