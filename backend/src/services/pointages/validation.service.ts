import { BioResult } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../middleware/error-handler.js";
import { getIsoWeekString } from "../../lib/week-iso.js";

export async function assertBioOkForValidation(workerId: string, pointageDate: Date): Promise<void> {
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

export async function rejectPointage(
  id: string,
  validatedById: string,
  rejectionReason: string,
) {
  if (rejectionReason.trim().length < 3) {
    throw new ApiError(422, "REJECTION_REASON_REQUIRED", "Rejection reason must be at least 3 characters");
  }

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
