import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../middleware/error-handler.js";
import { getRequestContext } from "../../middleware/prisma-rls.js";
import { writeAuditLog } from "../audit/audit.service.js";

export interface CorrectPointageInput {
  quantity?: number;
  activityId?: string;
  date?: Date;
  correctionReason: string;
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

  const after = await prisma.pointage.update({
    where: { id },
    data: updateData,
  });

  const ctx = getRequestContext();
  await writeAuditLog({
    userId: ctx?.userId,
    action: "CORRECT",
    entityType: "Pointage",
    entityId: id,
    before,
    after,
    ip: auditMeta?.ip ?? ctx?.ip,
    userAgent: auditMeta?.userAgent ?? ctx?.userAgent,
  });

  return after;
}
