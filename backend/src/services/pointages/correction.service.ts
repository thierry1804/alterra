import { Prisma, type Pointage } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { basePrisma } from "../../lib/prisma-base.js";
import { ApiError } from "../../middleware/error-handler.js";
import { getRequestContext } from "../../middleware/prisma-rls.js";
import { DAY_RULE_DB_ERROR, dayConflictMessage, findDayConflict, type Db } from "./day-rule.js";

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

/** Refuse une édition qui ferait cohabiter deux pointages actifs du même travailleur le même jour. */
async function assertNoDayConflict(
  tx: Db,
  before: Pointage,
  updateData: Record<string, unknown>,
  id: string,
): Promise<void> {
  const conflict = await findDayConflict(tx, {
    workerId: before.workerId,
    date: (updateData.date as Date | undefined) ?? before.date,
    excludeId: id,
  });
  if (conflict) {
    throw new ApiError(
      409,
      "DUPLICATE_SLOT",
      dayConflictMessage(
        conflict,
        (updateData.subActivityId as string | undefined) ?? before.subActivityId,
      ),
    );
  }
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

  try {
    return await prisma.$transaction(async (tx) => {
      await assertNoDayConflict(tx, before, updateData, id);
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
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ApiError(409, "DUPLICATE_SLOT", DAY_RULE_DB_ERROR);
    }
    throw err;
  }
}

/**
 * Rattache a posteriori une photo dont l'envoi avait échoué au moment de la synchro initiale du
 * pointage (texte parti, photo pas encore uploadée) — pas une "correction" métier, donc pas de motif
 * exigé. Idempotent sur la même clé pour tolérer un retry réseau côté PWA après un succès non confirmé.
 */
export async function attachPointagePhoto(id: string, userId: string, photoKey: string) {
  const before = await prisma.pointage.findUniqueOrThrow({ where: { id } });

  if (before.enteredById !== userId) {
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Vous ne pouvez rattacher une photo qu'à votre propre saisie",
    );
  }
  if (before.status === "VALIDATED") {
    throw new ApiError(
      409,
      "INVALID_STATUS",
      "Pointage déjà validé (potentiellement payé) — photo ne peut plus être rattachée",
    );
  }
  if (before.photoKey) {
    if (before.photoKey === photoKey) return before;
    throw new ApiError(409, "PHOTO_ALREADY_SET", "Ce pointage a déjà une photo");
  }

  return prisma.pointage.update({ where: { id }, data: { photoKey } });
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

  try {
    return await prisma.$transaction(async (tx) => {
      await assertNoDayConflict(tx, before, updateData, id);

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
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ApiError(409, "DUPLICATE_SLOT", DAY_RULE_DB_ERROR);
    }
    throw err;
  }
}
