import { Prisma, PresenceSource } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

export interface SyncPresenceItem {
  clientUuid: string;
  workerId: string;
  date: Date;
  arrivalTime: Date;
  badgeNfcTagId: string;
  source: PresenceSource;
  parcelleId?: string;
  createdByClientAt: Date;
}

export type SyncPresenceResultStatus = "created" | "already_exists" | "rejected";

export interface SyncPresenceResult {
  clientUuid: string;
  status: SyncPresenceResultStatus;
  id?: string;
  reason?: string;
}

export async function syncPresenceBatch(
  batch: SyncPresenceItem[],
  scannedById: string,
): Promise<SyncPresenceResult[]> {
  const results: SyncPresenceResult[] = [];

  for (const item of batch) {
    try {
      const worker = await prisma.worker.findFirst({
        where: { id: item.workerId, deletedAt: null },
        select: { id: true },
      });
      if (!worker) {
        results.push({
          clientUuid: item.clientUuid,
          status: "rejected",
          reason: "WORKER_NOT_FOUND",
        });
        continue;
      }

      const duplicateDay = await prisma.presenceRecord.findFirst({
        where: {
          workerId: item.workerId,
          date: item.date,
          clientUuid: { not: item.clientUuid },
        },
        select: { id: true },
      });
      if (duplicateDay) {
        results.push({
          clientUuid: item.clientUuid,
          status: "rejected",
          reason: "DUPLICATE_DAY",
        });
        continue;
      }

      const created = await prisma.presenceRecord.create({
        data: {
          clientUuid: item.clientUuid,
          workerId: item.workerId,
          date: item.date,
          arrivalTime: item.arrivalTime,
          badgeNfcTagId: item.badgeNfcTagId,
          scannedById,
          source: item.source,
          parcelleId: item.parcelleId,
          createdByClientAt: item.createdByClientAt,
        },
      });

      results.push({ clientUuid: item.clientUuid, status: "created", id: created.id });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existing = await prisma.presenceRecord.findUnique({
          where: { clientUuid: item.clientUuid },
        });
        results.push({
          clientUuid: item.clientUuid,
          status: "already_exists",
          id: existing?.id,
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
