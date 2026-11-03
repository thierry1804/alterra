import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

export interface SyncPointageItem {
  clientUuid: string;
  workerId: string;
  subActivityId: string;
  quantity: number;
  date: Date;
  parcelleId?: string;
  geoLat?: number;
  geoLng?: number;
  notes?: string;
  createdByClientAt: Date;
  photoKey?: string;
}

export type SyncPointageResultStatus = "created" | "already_exists" | "rejected" | "retry";

/** Codes Prisma transitoires (pool saturé, DB injoignable un instant) — jamais un rejet métier
 * définitif : la PWA doit garder l'item en file et retenter, pas l'abandonner. */
const TRANSIENT_PRISMA_CODES = new Set([
  "P1001", // Can't reach database server
  "P1002", // Database server timed out
  "P1008", // Operations timed out
  "P1017", // Server has closed the connection
  "P2024", // Timed out fetching a new connection from the pool
  "P2028", // Transaction API error
]);

function isTransientError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return TRANSIENT_PRISMA_CODES.has(err.code);
  }
  return false;
}

export interface SyncPointageResult {
  clientUuid: string;
  status: SyncPointageResultStatus;
  id?: string;
  reason?: string;
}

export async function syncPointageBatch(
  batch: SyncPointageItem[],
  enteredById: string,
): Promise<SyncPointageResult[]> {
  const results: SyncPointageResult[] = [];

  for (const item of batch) {
    try {
      // Même travailleur, même activité, même jour : un seul pointage actif à la fois — sinon
      // double comptage au paiement. Un REJECTED ne compte pas (sa réparation passe par /resubmit).
      const duplicate = await prisma.pointage.findFirst({
        where: {
          workerId: item.workerId,
          subActivityId: item.subActivityId,
          date: item.date,
          status: { not: "REJECTED" },
          clientUuid: { not: item.clientUuid },
        },
        select: { id: true },
      });
      if (duplicate) {
        results.push({
          clientUuid: item.clientUuid,
          status: "rejected",
          reason: "Ce travailleur a déjà un pointage pour cette activité ce jour-là",
        });
        continue;
      }

      const subActivity = await prisma.activitySubActivity.findUniqueOrThrow({
        where: { id: item.subActivityId },
      });
      const amount = item.quantity * Number(subActivity.unitRate);

      const created = await prisma.pointage.create({
        data: {
          clientUuid: item.clientUuid,
          workerId: item.workerId,
          subActivityId: item.subActivityId,
          quantity: item.quantity,
          unitRateSnapshot: subActivity.unitRate,
          amount,
          date: item.date,
          parcelleId: item.parcelleId,
          geoLat: item.geoLat,
          geoLng: item.geoLng,
          notes: item.notes,
          enteredById,
          createdByClientAt: item.createdByClientAt,
          // Préfixe vérifié pour empêcher qu'un client pointe vers une clé MinIO arbitraire.
          photoKey: item.photoKey?.startsWith("pointages/") ? item.photoKey : undefined,
        },
      });
      results.push({ clientUuid: item.clientUuid, status: "created", id: created.id });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = err.meta?.target;
        if (Array.isArray(target) && target.includes("clientUuid")) {
          const existing = await prisma.pointage.findUnique({
            where: { clientUuid: item.clientUuid },
          });
          results.push({
            clientUuid: item.clientUuid,
            status: "already_exists",
            id: existing?.id,
          });
        } else {
          // Course gagnée par une autre requête concurrente sur le même (worker, sous-activité, jour) :
          // le findFirst ci-dessus les avait tous les deux laissés passer, l'index partiel tranche.
          results.push({
            clientUuid: item.clientUuid,
            status: "rejected",
            reason: "Ce travailleur a déjà un pointage pour cette activité ce jour-là",
          });
        }
      } else if (isTransientError(err)) {
        results.push({
          clientUuid: item.clientUuid,
          status: "retry",
          reason: err instanceof Error ? err.message : "unknown_error",
        });
      } else {
        results.push({
          clientUuid: item.clientUuid,
          status: "rejected",
          reason: err instanceof Error ? err.message : "unknown_error",
        });
      }
    }
  }

  return results;
}
