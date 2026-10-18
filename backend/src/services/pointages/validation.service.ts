import { BioResult, PointageStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../middleware/error-handler.js";
import { getIsoWeekString } from "../../lib/week-iso.js";

// Seuls ces statuts peuvent encore être validés/rejetés — un VALIDATED (potentiellement déjà payé)
// ou un REJECTED repassent par la correction admin, pas par un nouveau valider/rejeter direct.
const ACTIONABLE_STATUSES: PointageStatus[] = ["PENDING", "NEEDS_CLARIFICATION"];

function assertActionable(status: PointageStatus): void {
  if (!ACTIONABLE_STATUSES.includes(status)) {
    throw new ApiError(
      409,
      "INVALID_STATUS",
      "Ce pointage est déjà traité (validé ou rejeté) — action impossible",
    );
  }
}

export async function assertBioOkForValidation(
  workerId: string,
  pointageDate: Date,
): Promise<void> {
  const setting = await prisma.appSetting.findUnique({ where: { id: "singleton" } });
  // Le contrôle biométrique n'est pas encore fiable sur le terrain — l'admin peut désactiver
  // temporairement cette exigence (Paramètres) le temps de sa mise au point.
  if (setting && !setting.bioValidationRequired) return;

  const weekIso = getIsoWeekString(pointageDate);

  const latestBioCheck = await prisma.biometricCheck.findFirst({
    where: {
      workerId,
      weekIso,
    },
    orderBy: { performedAt: "desc" },
  });

  if (!latestBioCheck || latestBioCheck.result !== BioResult.OK) {
    throw new ApiError(
      422,
      "BIO_NOT_OK",
      "Biometric check OK required for validation in the pointage week",
    );
  }
}

export async function validatePointage(id: string, validatedById: string) {
  const existing = await prisma.pointage.findUniqueOrThrow({ where: { id } });
  assertActionable(existing.status);
  await assertBioOkForValidation(existing.workerId, existing.date);

  return prisma.pointage.update({
    where: { id },
    data: {
      status: "VALIDATED",
      validatedById,
      validatedAt: new Date(),
      rejectionReason: null,
    },
  });
}

export async function rejectPointage(id: string, validatedById: string, rejectionReason: string) {
  if (rejectionReason.trim().length < 3) {
    throw new ApiError(
      422,
      "REJECTION_REASON_REQUIRED",
      "Rejection reason must be at least 3 characters",
    );
  }

  const existing = await prisma.pointage.findUniqueOrThrow({ where: { id } });
  assertActionable(existing.status);

  return prisma.pointage.update({
    where: { id },
    data: {
      status: "REJECTED",
      rejectionReason: rejectionReason.trim(),
      validatedById,
      validatedAt: new Date(),
    },
  });
}
