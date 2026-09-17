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
}

export type SyncPointageResultStatus = "created" | "already_exists" | "rejected";

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
        },
      });
      results.push({ clientUuid: item.clientUuid, status: "created", id: created.id });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const existing = await prisma.pointage.findUnique({
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
