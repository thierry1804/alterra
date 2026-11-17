import {
  BioResult,
  PaymentCycle,
  PaymentStatus,
  Prisma,
  type BordereauStatus,
} from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { resolvePeriod } from "../../lib/period-iso.js";
import { ApiError } from "../../middleware/error-handler.js";
import { buildMvolaDescription } from "./mvola-description.js";
import { writeAuditLog } from "../audit/audit.service.js";
import { BORDEREAU_ELIGIBLE } from "../pointages/eligibility.js";
import type { Db } from "../pointages/day-rule.js";
import { snapshotLines } from "./bordereau-workflow.service.js";
import { ensureInvoiceQuietly } from "./bordereau-invoice.service.js";
import { getIsiSettings, isiLineKey, lineIsi, type IsiSettings } from "../../lib/isi.js";

export interface GeneratePaymentsInput {
  periodIso: string;
  cycle?: PaymentCycle;
  referenceYear?: number;
  force?: boolean;
  siteId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
}

export interface GeneratedBordereauSummary {
  bordereauId: string;
  siteId: string;
  siteCode: string;
  number: number;
  version: number;
  created: number;
  skippedZeroAmount: number;
  droppedAdjustments: number;
}

export interface SkippedSite {
  siteId: string;
  siteCode: string;
  code: string;
  message: string;
}

export interface GeneratePaymentsResult {
  periodIso: string;
  weekIso: string;
  created: number;
  skippedZeroAmount: number;
  bordereaux: GeneratedBordereauSummary[];
  skippedSites: SkippedSite[];
  payments: Array<{
    id: string;
    workerId: string;
    amount: string;
    bioValid: boolean;
    description: string;
  }>;
}

async function isBioOkForWeek(
  workerId: string,
  weekIso: string,
  bioValidationRequired: boolean,
): Promise<boolean> {
  // Même bascule que pour la validation des pointages (Paramètres) — si désactivée, tout est
  // considéré bio OK pour ne pas bloquer la génération des paiements en son absence.
  if (!bioValidationRequired) return true;

  const latestBioCheck = await prisma.biometricCheck.findFirst({
    where: { workerId, weekIso },
    orderBy: { performedAt: "desc" },
  });

  return latestBioCheck?.result === BioResult.OK;
}

async function nextBordereauNumber(tx: Db, siteId: string): Promise<number> {
  const lastBordereau = await tx.bordereau.findFirst({
    where: { siteId },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const lastPayment = await tx.payment.findFirst({
    where: { worker: { siteId } },
    orderBy: { bordereau: "desc" },
    select: { bordereau: true },
  });
  return Math.max(lastBordereau?.number ?? 0, lastPayment?.bordereau ?? 0) + 1;
}

const REGENERABLE: BordereauStatus[] = ["GENERATED", "FINANCE_VALIDATED"];

interface PeriodContext {
  shortPeriod: string;
  referenceYear: number;
  weekIso: string;
  semaineIso: string;
  dateFrom: Date;
  dateTo: Date;
  cycle: PaymentCycle;
  bioValidationRequired: boolean;
  isi: IsiSettings;
  force: boolean;
  userId?: string;
  ip?: string;
  userAgent?: string;
}

async function generateForSite(
  ctx: PeriodContext,
  site: { id: string; shortCode: string },
): Promise<{
  summary: GeneratedBordereauSummary | null;
  payments: Array<Prisma.PaymentGetPayload<object>>;
  skippedZeroAmount: number;
}> {
  const { shortPeriod, referenceYear } = ctx;
  const periodWhere = { periodIso: shortPeriod, referenceYear, worker: { siteId: site.id } };

  const current = await prisma.bordereau.findFirst({
    where: {
      siteId: site.id,
      periodIso: shortPeriod,
      referenceYear,
      status: { not: "SUPERSEDED" },
    },
    orderBy: { version: "desc" },
  });

  const lockedPayment = await prisma.payment.findFirst({
    where: {
      ...periodWhere,
      status: { in: [PaymentStatus.EXPORTED, PaymentStatus.PAID] },
    },
    select: { id: true },
  });

  if (lockedPayment || (current && !REGENERABLE.includes(current.status))) {
    throw new ApiError(
      409,
      "PAY_CONFLICT",
      "Un bordereau existe déjà pour ce site et cette période (validé, exporté ou payé)",
    );
  }

  if (!ctx.force) {
    const correctedCount = await prisma.payment.count({
      where: {
        ...periodWhere,
        status: PaymentStatus.PENDING,
        correctionReason: { not: null },
      },
    });

    if (correctedCount > 0) {
      throw new ApiError(
        409,
        "PAY_HAS_CORRECTIONS",
        `${correctedCount} paiement(s) corrigé(s) manuellement seront écrasés par la régénération`,
      );
    }
  }

  const pointages = await prisma.pointage.findMany({
    where: {
      ...BORDEREAU_ELIGIBLE,
      date: { gte: ctx.dateFrom, lte: ctx.dateTo },
      worker: { siteId: site.id },
      OR: current ? [{ bordereauId: null }, { bordereauId: current.id }] : [{ bordereauId: null }],
    },
    include: {
      worker: {
        include: { site: true },
      },
      subActivity: { include: { category: true } },
    },
  });

  const aggregates = new Map<
    string,
    {
      amount: Prisma.Decimal;
      pointageIds: string[];
      lines: Map<string, Prisma.Decimal>;
      byActivity: Map<string, { shortLabel: string; code: string; amount: Prisma.Decimal }>;
      worker: (typeof pointages)[number]["worker"];
    }
  >();

  for (const pointage of pointages) {
    const current = aggregates.get(pointage.workerId);
    if (current) {
      current.amount = current.amount.add(pointage.amount);
      current.pointageIds.push(pointage.id);
      const lineKey = isiLineKey(pointage);
      current.lines.set(
        lineKey,
        (current.lines.get(lineKey) ?? new Prisma.Decimal(0)).add(pointage.amount),
      );
      const activityTotal = current.byActivity.get(pointage.subActivityId);
      if (activityTotal) {
        activityTotal.amount = activityTotal.amount.add(pointage.amount);
      } else {
        current.byActivity.set(pointage.subActivityId, {
          shortLabel: pointage.subActivity.shortLabel,
          code: pointage.subActivity.category.code,
          amount: new Prisma.Decimal(pointage.amount),
        });
      }
    } else {
      aggregates.set(pointage.workerId, {
        amount: new Prisma.Decimal(pointage.amount),
        pointageIds: [pointage.id],
        lines: new Map([[isiLineKey(pointage), new Prisma.Decimal(pointage.amount)]]),
        byActivity: new Map([
          [
            pointage.subActivityId,
            {
              shortLabel: pointage.subActivity.shortLabel,
              code: pointage.subActivity.category.code,
              amount: new Prisma.Decimal(pointage.amount),
            },
          ],
        ]),
        worker: pointage.worker,
      });
    }
  }

  const drafts: Array<
    Omit<
      Prisma.PaymentCreateManyInput,
      "bordereau" | "bordereauId" | "description" | "isiAmount" | "netAmount"
    > & {
      isiAmount: Prisma.Decimal;
      netAmount: Prisma.Decimal;
      worker: (typeof pointages)[number]["worker"];
      dominant: { shortLabel: string; code: string };
      pointageIds: string[];
    }
  > = [];
  let skippedZeroAmount = 0;

  for (const [workerId, aggregate] of aggregates) {
    if (aggregate.amount.lte(0)) {
      skippedZeroAmount += 1;
      continue;
    }

    const bioValid = await isBioOkForWeek(workerId, ctx.weekIso, ctx.bioValidationRequired);
    const dominant = Array.from(aggregate.byActivity.values()).sort((a, b) =>
      b.amount.comparedTo(a.amount),
    )[0];

    const isiAmount = [...aggregate.lines.values()].reduce(
      (sum, lineAmount) => sum.add(lineIsi(lineAmount, ctx.isi)),
      new Prisma.Decimal(0),
    );

    drafts.push({
      workerId,
      periodIso: shortPeriod,
      referenceYear,
      cycle: ctx.cycle,
      amount: aggregate.amount,
      isiAmount,
      netAmount: aggregate.amount.sub(isiAmount),
      bioValid,
      status: PaymentStatus.PENDING,
      worker: aggregate.worker,
      dominant,
      pointageIds: aggregate.pointageIds,
    });
  }

  if (!current && drafts.length === 0) {
    return { summary: null, payments: [], skippedZeroAmount };
  }

  let outcome: Awaited<ReturnType<typeof generateForSite>>;
  try {
    outcome = await prisma.$transaction(async (tx) => {
      const carried = current
        ? await tx.paymentAdjustment.findMany({
            where: { bordereauId: current.id },
            include: { payment: { select: { workerId: true } } },
            orderBy: { createdAt: "asc" },
          })
        : [];

      if (current) {
        await tx.pointage.updateMany({
          where: { bordereauId: current.id },
          data: { bordereauId: null },
        });
        await tx.bordereau.update({
          where: { id: current.id },
          data: {
            status: "SUPERSEDED",
            supersededAt: new Date(),
            lines: await snapshotLines(current.id),
          },
        });
      }
      await tx.payment.deleteMany({
        where: { ...periodWhere, status: PaymentStatus.PENDING },
      });

      if (drafts.length === 0) {
        return { summary: null, payments: [], skippedZeroAmount };
      }

      const lastVersion = await tx.bordereau.findFirst({
        where: { siteId: site.id, periodIso: shortPeriod, referenceYear },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      const number = current?.number ?? (await nextBordereauNumber(tx, site.id));
      const bordereau = await tx.bordereau.create({
        data: {
          siteId: site.id,
          periodIso: shortPeriod,
          referenceYear,
          version: (lastVersion?.version ?? 0) + 1,
          number,
          isiRate: ctx.isi.rate,
          isiRounding: ctx.isi.rounding,
          createdById: ctx.userId ?? null,
        },
      });

      await tx.payment.createMany({
        data: drafts.map((draft) => ({
          workerId: draft.workerId,
          periodIso: shortPeriod,
          referenceYear,
          cycle: ctx.cycle,
          amount: draft.amount,
          isiAmount: draft.isiAmount,
          netAmount: draft.netAmount,
          bioValid: draft.bioValid,
          status: PaymentStatus.PENDING,
          bordereau: number,
          bordereauId: bordereau.id,
          description: buildMvolaDescription(
            `${draft.worker.lastName} ${draft.worker.firstName}`,
            draft.dominant.shortLabel,
            ctx.semaineIso,
            number,
            draft.worker.site.shortCode,
            draft.dominant.code,
            draft.worker.legacyMocId,
          ),
        })),
      });

      await tx.pointage.updateMany({
        where: { id: { in: drafts.flatMap((draft) => draft.pointageIds) } },
        data: { bordereauId: bordereau.id },
      });

      const createdPayments = await tx.payment.findMany({
        where: { bordereauId: bordereau.id },
      });
      let droppedAdjustments = 0;
      for (const adjustment of carried) {
        const target = createdPayments.find(
          (payment) => payment.workerId === adjustment.payment.workerId,
        );
        if (!target) {
          droppedAdjustments += 1;
          continue;
        }
        const gross = target.amount.add(adjustment.amount);
        const isi = target.isiAmount.add(lineIsi(adjustment.amount, ctx.isi));
        const net = gross.sub(isi);
        if (!gross.gt(0) || !net.gt(0)) {
          droppedAdjustments += 1;
          continue;
        }
        await tx.paymentAdjustment.create({
          data: {
            paymentId: target.id,
            bordereauId: bordereau.id,
            amount: adjustment.amount,
            reason: adjustment.reason,
            createdById: adjustment.createdById,
          },
        });
        await tx.payment.update({
          where: { id: target.id },
          data: {
            amount: gross,
            isiAmount: isi,
            netAmount: net,
            originalAmount: target.originalAmount ?? target.amount,
          },
        });
        target.amount = gross;
        target.isiAmount = isi;
        target.netAmount = net;
      }

      const payments = await tx.payment.findMany({
        where: { bordereauId: bordereau.id },
        orderBy: { createdAt: "asc" },
      });

      return {
        summary: {
          bordereauId: bordereau.id,
          siteId: site.id,
          siteCode: site.shortCode,
          number,
          version: bordereau.version,
          created: payments.length,
          skippedZeroAmount,
          droppedAdjustments,
        },
        payments,
        skippedZeroAmount,
      };
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new ApiError(
        409,
        "PAY_CONFLICT",
        "Un bordereau est déjà en cours de génération pour ce site",
      );
    }
    throw err;
  }

  if (outcome.summary) {
    await writeAuditLog({
      userId: ctx.userId ?? null,
      action: current ? "REGENERATE_BORDEREAU" : "GENERATE_BORDEREAU",
      entityType: "Bordereau",
      entityId: outcome.summary.bordereauId,
      before: current ? { bordereauId: current.id, version: current.version } : null,
      after: {
        siteId: site.id,
        periodIso: shortPeriod,
        referenceYear,
        version: outcome.summary.version,
        number: outcome.summary.number,
        payments: outcome.summary.created,
      },
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }

  if (outcome.summary) {
    await ensureInvoiceQuietly(outcome.summary.bordereauId);
  }

  return outcome;
}

export async function generatePayments(
  input: GeneratePaymentsInput,
): Promise<GeneratePaymentsResult> {
  const resolved = resolvePeriod(input.periodIso, input.cycle, input.referenceYear);
  const { shortPeriod, referenceYear, weekIso, dateFrom, dateTo, cycle } = resolved;

  const appSetting = await prisma.appSetting.findUnique({ where: { id: "singleton" } });
  const ctx: PeriodContext = {
    shortPeriod,
    referenceYear,
    weekIso,
    semaineIso: weekIso.split("-W")[1],
    dateFrom,
    dateTo,
    cycle,
    bioValidationRequired: appSetting?.bioValidationRequired ?? true,
    isi: await getIsiSettings(),
    force: input.force ?? false,
    userId: input.userId,
    ip: input.ip,
    userAgent: input.userAgent,
  };

  const sites = await prisma.site.findMany({
    where: input.siteId ? { id: input.siteId } : { active: true },
    select: { id: true, shortCode: true },
    orderBy: { shortCode: "asc" },
  });

  if (input.siteId && sites.length === 0) {
    throw new ApiError(404, "SITE_NOT_FOUND", "Site introuvable");
  }

  const bordereaux: GeneratedBordereauSummary[] = [];
  const skippedSites: SkippedSite[] = [];
  const payments: Array<Prisma.PaymentGetPayload<object>> = [];
  let skippedZeroAmount = 0;

  for (const site of sites) {
    try {
      const result = await generateForSite(ctx, site);
      skippedZeroAmount += result.skippedZeroAmount;
      if (result.summary) {
        bordereaux.push(result.summary);
        payments.push(...result.payments);
      }
    } catch (err) {
      if (input.siteId || !(err instanceof ApiError)) throw err;
      skippedSites.push({
        siteId: site.id,
        siteCode: site.shortCode,
        code: err.code,
        message: err.message,
      });
    }
  }

  if (bordereaux.length === 0 && skippedSites.length > 0) {
    const first = skippedSites[0];
    throw new ApiError(409, first.code, first.message);
  }

  return {
    periodIso: shortPeriod,
    weekIso,
    created: payments.length,
    skippedZeroAmount,
    bordereaux,
    skippedSites,
    payments: payments.map((payment) => ({
      id: payment.id,
      workerId: payment.workerId,
      amount: payment.amount.toString(),
      bioValid: payment.bioValid,
      description: payment.description,
    })),
  };
}

export interface DeletePaymentsBatchInput {
  periodIso: string;
  referenceYear?: number;
  /** Site du travailleur (sélecteur de site global du back-office). */
  siteId?: string;
  userId: string;
  ip?: string;
  userAgent?: string;
}

export interface DeletePaymentsBatchResult {
  periodIso: string;
  deleted: number;
}

/** Supprime un bordereau PENDING généré par erreur — bloqué dès qu'une ligne est exportée ou payée,
 * pour ne jamais effacer la trace d'un paiement réellement envoyé. */
export async function deletePaymentsBatch(
  input: DeletePaymentsBatchInput,
): Promise<DeletePaymentsBatchResult> {
  const { shortPeriod, referenceYear } = resolvePeriod(
    input.periodIso,
    undefined,
    input.referenceYear,
  );
  const siteFilter: Prisma.PaymentWhereInput = input.siteId
    ? { worker: { siteId: input.siteId } }
    : {};

  const lockedPayment = await prisma.payment.findFirst({
    where: {
      periodIso: shortPeriod,
      referenceYear,
      status: { in: [PaymentStatus.EXPORTED, PaymentStatus.PAID] },
      ...siteFilter,
    },
    select: { id: true },
  });

  if (lockedPayment) {
    throw new ApiError(
      409,
      "PAY_CONFLICT",
      "Bordereau déjà exporté ou payé — suppression impossible",
    );
  }

  const existing = await prisma.payment.findMany({
    where: { periodIso: shortPeriod, referenceYear, status: PaymentStatus.PENDING, ...siteFilter },
    select: { id: true, bordereauId: true },
  });

  if (existing.length === 0) {
    throw new ApiError(404, "PAY_NOT_FOUND", "Aucun bordereau en attente pour cette période");
  }

  const bordereauIds = [
    ...new Set(existing.flatMap((payment) => (payment.bordereauId ? [payment.bordereauId] : []))),
  ];

  const validated = await prisma.bordereau.findFirst({
    where: { id: { in: bordereauIds }, status: { not: "GENERATED" } },
    select: { id: true },
  });
  if (validated) {
    throw new ApiError(
      409,
      "BORDEREAU_LOCKED",
      "Bordereau validé — renvoyez-le avant de le supprimer",
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.pointage.updateMany({
      where: { bordereauId: { in: bordereauIds } },
      data: { bordereauId: null },
    });
    await tx.payment.deleteMany({
      where: {
        periodIso: shortPeriod,
        referenceYear,
        status: PaymentStatus.PENDING,
        ...siteFilter,
      },
    });
    await tx.bordereau.deleteMany({
      where: { id: { in: bordereauIds }, status: "GENERATED", payments: { none: {} } },
    });
  });

  await writeAuditLog({
    userId: input.userId,
    action: "DELETE",
    entityType: "Payment",
    entityId: null,
    before: { periodIso: shortPeriod, referenceYear, count: existing.length },
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return { periodIso: shortPeriod, deleted: existing.length };
}
