import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { basePrisma } from "../../lib/prisma-base.js";
import { ApiError } from "../../middleware/error-handler.js";
import { getRequestContext } from "../../middleware/prisma-rls.js";

export interface CorrectPointageInput {
  quantity?: number;
  activityId?: string;
  date?: Date;
  correctionReason: string;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function correctPointage(
  id: string,
  input: CorrectPointageInput,
  auditMeta?: { ip?: string; userAgent?: string },
) {
  if (input.correctionReason.trim().length < 10) {
    throw new ApiError(
      422,
      "CORRECTION_REASON_REQUIRED",
      "Correction reason must be at least 10 characters",
    );
  }

  const before = await prisma.pointage.findUniqueOrThrow({ where: { id } });
  const correctionReason = input.correctionReason.trim();

  const updateData: Record<string, unknown> = {};

  if (input.date !== undefined) {
    updateData.date = input.date;
  }

  let unitRate = Number(before.unitRateSnapshot);
  let quantity = Number(before.quantity);

  if (input.activityId !== undefined) {
    const activity = await prisma.activity.findUniqueOrThrow({
      where: { id: input.activityId },
    });
    updateData.activityId = input.activityId;
    updateData.unitRateSnapshot = activity.unitRate;
    unitRate = Number(activity.unitRate);
  }

  if (input.quantity !== undefined) {
    updateData.quantity = input.quantity;
    quantity = input.quantity;
  }

  if (input.quantity !== undefined || input.activityId !== undefined) {
    updateData.amount = quantity * unitRate;
  }

  const ctx = getRequestContext();

  return prisma.$transaction(async (tx) => {
    const after = await tx.pointage.update({
      where: { id },
      data: updateData,
    });

    await basePrisma.auditLog.create({
      data: {
        userId: ctx?.userId ?? null,
        action: "CORRECT",
        entityType: "Pointage",
        entityId: id,
        before: toJson({ ...before, correctionReason }),
        after: toJson({ ...after, correctionReason }),
        ip: auditMeta?.ip ?? ctx?.ip ?? null,
        userAgent: auditMeta?.userAgent ?? ctx?.userAgent ?? null,
      },
    });

    return after;
  });
}
