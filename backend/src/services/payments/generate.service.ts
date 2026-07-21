import { BioResult, PaymentCycle, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolvePeriod } from "../../lib/period-iso.js";
import { ApiError } from "../../middleware/error-handler.js";
import { buildMvolaDescription } from "./mvola-description.js";

export interface GeneratePaymentsInput {
  periodIso: string;
  cycle?: PaymentCycle;
  referenceYear?: number;
}

export interface GeneratePaymentsResult {
  periodIso: string;
  weekIso: string;
  created: number;
  skippedZeroAmount: number;
  payments: Array<{
    id: string;
    workerId: string;
    amount: string;
    bioValid: boolean;
    description: string;
  }>;
}

async function isBioOkForWeek(workerId: string, weekIso: string): Promise<boolean> {
  const latestBioCheck = await prisma.biometricCheck.findFirst({
    where: { workerId, weekIso },
    orderBy: { performedAt: "desc" },
  });

  return latestBioCheck?.result === BioResult.OK;
}

export async function generatePayments(
  input: GeneratePaymentsInput,
): Promise<GeneratePaymentsResult> {
  const resolved = resolvePeriod(input.periodIso, input.cycle, input.referenceYear);
  const { shortPeriod, weekIso, dateFrom, dateTo, cycle } = resolved;

  const lockedPayment = await prisma.payment.findFirst({
    where: {
      periodIso: shortPeriod,
      status: { in: [PaymentStatus.EXPORTED, PaymentStatus.PAID] },
    },
    select: { id: true },
  });

  if (lockedPayment) {
    throw new ApiError(
      409,
      "PAY_CONFLICT",
      "Un bordereau existe déjà pour cette période (exporté ou payé)",
    );
  }

  const pointages = await prisma.pointage.findMany({
    where: {
      status: "VALIDATED",
      date: { gte: dateFrom, lte: dateTo },
    },
    include: {
      worker: {
        include: { site: true },
      },
    },
  });

  const aggregates = new Map<
    string,
    {
      amount: Prisma.Decimal;
      worker: (typeof pointages)[number]["worker"];
    }
  >();

  for (const pointage of pointages) {
    const current = aggregates.get(pointage.workerId);
    if (current) {
      current.amount = current.amount.add(pointage.amount);
    } else {
      aggregates.set(pointage.workerId, {
        amount: new Prisma.Decimal(pointage.amount),
        worker: pointage.worker,
      });
    }
  }

  const toCreate: Prisma.PaymentCreateManyInput[] = [];
  let skippedZeroAmount = 0;

  for (const [workerId, aggregate] of aggregates) {
    if (aggregate.amount.lte(0)) {
      skippedZeroAmount += 1;
      continue;
    }

    const bioValid = await isBioOkForWeek(workerId, weekIso);
    toCreate.push({
      workerId,
      periodIso: shortPeriod,
      cycle,
      amount: aggregate.amount,
      description: buildMvolaDescription(
        aggregate.worker.firstName,
        aggregate.worker.site.shortCode,
      ),
      bioValid,
      status: PaymentStatus.PENDING,
    });
  }

  const createdPayments = await prisma.$transaction(async (tx) => {
    await tx.payment.deleteMany({
      where: { periodIso: shortPeriod, status: PaymentStatus.PENDING },
    });

    if (toCreate.length === 0) {
      return [];
    }

    await tx.payment.createMany({ data: toCreate });

    return tx.payment.findMany({
      where: { periodIso: shortPeriod, status: PaymentStatus.PENDING },
      orderBy: { createdAt: "asc" },
    });
  });

  return {
    periodIso: shortPeriod,
    weekIso,
    created: createdPayments.length,
    skippedZeroAmount,
    payments: createdPayments.map((payment) => ({
      id: payment.id,
      workerId: payment.workerId,
      amount: payment.amount.toString(),
      bioValid: payment.bioValid,
      description: payment.description,
    })),
  };
}
