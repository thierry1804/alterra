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

async function nextBordereauBySite(siteIds: Iterable<string>): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  for (const siteId of siteIds) {
    const last = await prisma.payment.findFirst({
      where: { worker: { siteId } },
      orderBy: { bordereau: "desc" },
      select: { bordereau: true },
    });
    result.set(siteId, (last?.bordereau ?? 0) + 1);
  }
  return result;
}

export async function generatePayments(
  input: GeneratePaymentsInput,
): Promise<GeneratePaymentsResult> {
  const resolved = resolvePeriod(input.periodIso, input.cycle, input.referenceYear);
  const { shortPeriod, weekIso, dateFrom, dateTo, cycle } = resolved;
  const semaineIso = weekIso.split("-W")[1];

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
      activity: true,
    },
  });

  const aggregates = new Map<
    string,
    {
      amount: Prisma.Decimal;
      byActivity: Map<string, { label: string; code: string | null; amount: Prisma.Decimal }>;
      worker: (typeof pointages)[number]["worker"];
    }
  >();

  for (const pointage of pointages) {
    const current = aggregates.get(pointage.workerId);
    if (current) {
      current.amount = current.amount.add(pointage.amount);
      const activityTotal = current.byActivity.get(pointage.activityId);
      if (activityTotal) {
        activityTotal.amount = activityTotal.amount.add(pointage.amount);
      } else {
        current.byActivity.set(pointage.activityId, {
          label: pointage.activity.label,
          code: pointage.activity.code,
          amount: new Prisma.Decimal(pointage.amount),
        });
      }
    } else {
      aggregates.set(pointage.workerId, {
        amount: new Prisma.Decimal(pointage.amount),
        byActivity: new Map([
          [
            pointage.activityId,
            {
              label: pointage.activity.label,
              code: pointage.activity.code,
              amount: new Prisma.Decimal(pointage.amount),
            },
          ],
        ]),
        worker: pointage.worker,
      });
    }
  }

  const siteIds = new Set(
    Array.from(aggregates.values())
      .filter((aggregate) => aggregate.amount.gt(0))
      .map((aggregate) => aggregate.worker.siteId),
  );
  const bordereauBySite = await nextBordereauBySite(siteIds);

  const toCreate: Prisma.PaymentCreateManyInput[] = [];
  let skippedZeroAmount = 0;

  for (const [workerId, aggregate] of aggregates) {
    if (aggregate.amount.lte(0)) {
      skippedZeroAmount += 1;
      continue;
    }

    const bioValid = await isBioOkForWeek(workerId, weekIso);
    const dominantActivity = Array.from(aggregate.byActivity.values()).sort((a, b) =>
      b.amount.comparedTo(a.amount),
    )[0];
    const bordereau = bordereauBySite.get(aggregate.worker.siteId)!;

    toCreate.push({
      workerId,
      periodIso: shortPeriod,
      bordereau,
      cycle,
      amount: aggregate.amount,
      description: buildMvolaDescription(
        `${aggregate.worker.lastName} ${aggregate.worker.firstName}`,
        dominantActivity.label,
        semaineIso,
        bordereau,
        aggregate.worker.site.shortCode,
        dominantActivity.code ?? "",
        aggregate.worker.legacyMocId,
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
