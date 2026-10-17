import type { Prisma, Pointage } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { basePrisma } from "../../lib/prisma-base.js";
import { ApiError } from "../../middleware/error-handler.js";
import { getRequestContext } from "../../middleware/prisma-rls.js";

export interface PointageEditInput {
  quantity?: number;
  subActivityId?: string;
  date?: Date;
  photoKey?: string;
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

/** Calcule les champs à mettre à jour (montant recalculé, retour à PENDING si c'était rejeté). */
async function buildEditData(
  before: Pointage,
  input: PointageEditInput,
): Promise<Record<string, unknown>> {
  const updateData: Record<string, unknown> = {};

  if (before.status === "REJECTED") {
    updateData.status = "PENDING";
    updateData.rejectionReason = null;
    updateData.validatedById = null;
    updateData.validatedAt = null;
  }

  if (input.date !== undefined) updateData.date = input.date;
  if (input.photoKey?.startsWith("pointages/")) updateData.photoKey = input.photoKey;

  let unitRate = Number(before.unitRateSnapshot);
  let quantity = Number(before.quantity);

  if (input.subActivityId !== undefined) {
    const subActivity = await prisma.activitySubActivity.findUniqueOrThrow({
      where: { id: input.subActivityId },
    });
    updateData.subActivityId = input.subActivityId;
    updateData.unitRateSnapshot = subActivity.unitRate;
    unitRate = Number(subActivity.unitRate);
  }

  if (input.quantity !== undefined) {
    updateData.quantity = input.quantity;
    quantity = input.quantity;
  }

  if (input.quantity !== undefined || input.subActivityId !== undefined) {
    updateData.amount = quantity * unitRate;
  }

  return updateData;
}

async function writeEditAudit(params: {
  action: string;
  pointageId: string;
  userId: string;
  reasonField: string;
  reason: string;
  before: Pointage;
  after: Pointage;
  auditMeta?: { ip?: string; userAgent?: string };
}): Promise<void> {
  const ctx = getRequestContext();
  await basePrisma.auditLog.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: "Pointage",
      entityId: params.pointageId,
      before: toJson({ ...params.before, [params.reasonField]: params.reason }),
      after: toJson({ ...params.after, [params.reasonField]: params.reason }),
      ip: params.auditMeta?.ip ?? ctx?.ip ?? null,
      userAgent: params.auditMeta?.userAgent ?? ctx?.userAgent ?? null,
    },
  });
}

export interface CorrectPointageInput extends PointageEditInput {
  correctionReason: string;
}

/** Correction admin — n'importe quel pointage non encore validé, toute activité/site. */
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
  if (before.status === "VALIDATED") {
    throw new ApiError(
      409,
      "INVALID_STATUS",
      "Pointage déjà validé (potentiellement payé) — correction impossible",
    );
  }

  const correctionReason = input.correctionReason.trim();
  const updateData = await buildEditData(before, input);
  const ctx = getRequestContext();

  return prisma.$transaction(async (tx) => {
    const after = await tx.pointage.update({ where: { id }, data: updateData });
    await writeEditAudit({
      action: "CORRECT",
      pointageId: id,
      userId: ctx?.userId ?? "",
      reasonField: "correctionReason",
      reason: correctionReason,
      before,
      after,
      auditMeta,
    });
    return after;
  });
}

export interface ResubmitPointageInput extends PointageEditInput {
  resubmitReason: string;
}

/**
 * Le CDE répare son propre pointage rejeté et le repasse en attente de validation — seul moyen pour
 * lui de corriger une saisie déjà synchronisée (il n'a aucun autre droit d'écriture dessus).
 */
export async function resubmitPointage(
  id: string,
  userId: string,
  input: ResubmitPointageInput,
  auditMeta?: { ip?: string; userAgent?: string },
) {
  if (input.resubmitReason.trim().length < 10) {
    throw new ApiError(
      422,
      "RESUBMIT_REASON_REQUIRED",
      "Resubmit reason must be at least 10 characters",
    );
  }

  const before = await prisma.pointage.findUniqueOrThrow({ where: { id } });
  if (before.enteredById !== userId) {
    throw new ApiError(403, "FORBIDDEN", "Vous ne pouvez rectifier que vos propres saisies");
  }
  if (before.status !== "REJECTED") {
    throw new ApiError(
      409,
      "INVALID_STATUS",
      "Seul un pointage rejeté peut être rectifié et renvoyé",
    );
  }

  const resubmitReason = input.resubmitReason.trim();
  const updateData = await buildEditData(before, input);

  return prisma.$transaction(async (tx) => {
    const after = await tx.pointage.update({ where: { id }, data: updateData });
    await writeEditAudit({
      action: "RESUBMIT",
      pointageId: id,
      userId,
      reasonField: "resubmitReason",
      reason: resubmitReason,
      before,
      after,
      auditMeta,
    });
    return after;
  });
}
