import { PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolvePeriod } from "../../lib/period-iso.js";
import { ApiError } from "../../middleware/error-handler.js";

export interface ListPaymentsFilters {
  periodIso: string;
  status?: PaymentStatus;
  referenceYear?: number;
}

export async function listPayments(filters: ListPaymentsFilters) {
  const { shortPeriod } = resolvePeriod(filters.periodIso, undefined, filters.referenceYear);

  const where: Prisma.PaymentWhereInput = {
    periodIso: shortPeriod,
    ...(filters.status ? { status: filters.status } : {}),
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
