import { PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolvePeriod } from "../../lib/period-iso.js";
import { ApiError } from "../../middleware/error-handler.js";
import { writeAuditLog } from "../audit/audit.service.js";

export interface ListPaymentsFilters {
  periodIso: string;
  status?: PaymentStatus;
  referenceYear?: number;
  /** Site du travailleur (sélecteur de site global du back-office). */
  siteId?: string;
}

export async function listPayments(filters: ListPaymentsFilters) {
  const { shortPeriod, referenceYear } = resolvePeriod(
    filters.periodIso,
    undefined,
    filters.referenceYear,
  );

  const where: Prisma.PaymentWhereInput = {
    periodIso: shortPeriod,
    referenceYear,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.siteId ? { worker: { siteId: filters.siteId } } : {}),
  };

  const payments = await prisma.payment.findMany({
    where,
    include: {
      worker: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mvolaNumber: true,
          matricule: true,
        },
      },
    },
    orderBy: [{ worker: { lastName: "asc" } }, { worker: { firstName: "asc" } }],
  });

  return {
    periodIso: shortPeriod,
    data: payments.map((payment) => ({
      id: payment.id,
      workerId: payment.workerId,
      worker: payment.worker,
      periodIso: payment.periodIso,
      cycle: payment.cycle,
      amount: payment.amount.toString(),
      originalAmount: payment.originalAmount?.toString() ?? null,
      description: payment.description,
      bioValid: payment.bioValid,
      status: payment.status,
      exportedAt: payment.exportedAt?.toISOString() ?? null,
      paidAt: payment.paidAt?.toISOString() ?? null,
      failureReason: payment.failureReason,
      reconciliationStatus: payment.reconciliationStatus,
      mvolaReference: payment.mvolaReference,
      transferFee: payment.transferFee?.toString() ?? null,
      correctionReason: payment.correctionReason,
      createdAt: payment.createdAt.toISOString(),
    })),
  };
}

export async function correctPaymentAmount(
  id: string,
  input: { amount: number; correctionReason: string },
) {
  if (input.correctionReason.trim().length < 10) {
    throw new ApiError(
      422,
      "CORRECTION_REASON_REQUIRED",
      "Correction reason must be at least 10 characters",
    );
  }

  const existing = await prisma.payment.findUniqueOrThrow({ where: { id } });

  if (existing.status !== PaymentStatus.PENDING) {
    throw new ApiError(
      422,
      "PAYMENT_NOT_EDITABLE",
      "Seuls les paiements PENDING peuvent être modifiés",
    );
  }

  if (input.amount <= 0) {
    throw new ApiError(422, "INVALID_AMOUNT", "Le montant doit être positif");
  }

  return prisma.payment.update({
    where: { id },
    data: {
      amount: input.amount,
      correctionReason: input.correctionReason.trim(),
      originalAmount: existing.originalAmount ?? existing.amount,
    },
    include: {
      worker: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          mvolaNumber: true,
          matricule: true,
        },
      },
    },
  });
}

/** Marque comme échoué un paiement exporté que MVola n'a pas exécuté (relevé sans la ligne, virement rejeté). */
export async function markPaymentFailed(
  id: string,
  input: { failureReason: string; userId: string; ip?: string; userAgent?: string },
) {
  const existing = await prisma.payment.findUniqueOrThrow({ where: { id } });

  if (existing.status !== PaymentStatus.EXPORTED) {
    throw new ApiError(
      422,
      "PAYMENT_NOT_FAILABLE",
      "Seuls les paiements exportés et non encore payés peuvent être marqués en échec",
    );
  }

  const updated = await prisma.payment.update({
    where: { id },
    data: { status: PaymentStatus.FAILED, failureReason: input.failureReason.trim() },
  });

  await writeAuditLog({
    userId: input.userId,
    action: "UPDATE",
    entityType: "Payment",
    entityId: id,
    before: { status: existing.status },
    after: { status: updated.status, failureReason: updated.failureReason },
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return updated;
}

/** Historique des bordereaux MVola (export initial + régénérations), du plus récent au plus ancien. */
export async function listMvolaExports(filters: { periodIso?: string; referenceYear?: number } = {}, limit = 50) {
  const resolved = filters.periodIso
    ? resolvePeriod(filters.periodIso, undefined, filters.referenceYear)
    : undefined;

  const batches = await prisma.mvolaExportBatch.findMany({
    where: resolved ? { periodIso: resolved.shortPeriod, referenceYear: resolved.referenceYear } : {},
    orderBy: [{ periodIso: "desc" }, { version: "desc" }],
    take: limit,
  });

  const userIds = [...new Set(batches.map((b) => b.createdById).filter((id): id is string => !!id))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true },
  });
  const emailById = new Map(users.map((u) => [u.id, u.email]));

  // "Actuel" = version la plus haute déjà connue pour cette période parmi les lots retournés ;
  // suffisant ici car les versions sont strictement croissantes par période.
  const maxVersionByPeriod = new Map<string, number>();
  for (const batch of batches) {
    const key = `${batch.periodIso}:${batch.referenceYear ?? ""}`;
    maxVersionByPeriod.set(key, Math.max(maxVersionByPeriod.get(key) ?? 0, batch.version));
  }

  return batches.map((batch) => {
    const key = `${batch.periodIso}:${batch.referenceYear ?? ""}`;
    return {
      id: batch.id,
      createdAt: batch.createdAt.toISOString(),
      userEmail: (batch.createdById && emailById.get(batch.createdById)) || null,
      periodIso: batch.periodIso,
      referenceYear: batch.referenceYear,
      version: batch.version,
      isCurrent: batch.version === maxVersionByPeriod.get(key),
      exportedCount: batch.exportedCount,
      filename: batch.filename,
    };
  });
}

/** Retrouve le fichier MinIO d'un bordereau MVola passé, à partir de son id de version. */
export async function getMvolaExportFile(batchId: string) {
  const batch = await prisma.mvolaExportBatch.findUnique({ where: { id: batchId } });
  if (!batch) return null;

  return { minioKey: batch.fileKey, filename: batch.filename };
}
