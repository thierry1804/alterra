import { prisma } from "../../lib/prisma.js";
import { resolvePeriod } from "../../lib/period-iso.js";
import { writeAuditLog } from "../audit/audit.service.js";

export interface TechnicalValidationInput {
  weekIso: string;
  siteId?: string;
  subActivityId?: string;
}

export interface TechnicalValidationActor {
  userId: string;
  ip?: string;
  userAgent?: string;
}

export async function validateTechnical(
  input: TechnicalValidationInput,
  actor: TechnicalValidationActor,
): Promise<{ validated: number }> {
  const { dateFrom, dateTo } = resolvePeriod(input.weekIso);

  const { count } = await prisma.pointage.updateMany({
    where: {
      status: "VALIDATED",
      technicalValidatedAt: null,
      date: { gte: dateFrom, lte: dateTo },
      ...(input.siteId ? { worker: { siteId: input.siteId } } : {}),
      ...(input.subActivityId ? { subActivityId: input.subActivityId } : {}),
    },
    data: { technicalValidatedAt: new Date(), technicalValidatedById: actor.userId },
  });

  await writeAuditLog({
    userId: actor.userId,
    action: "TECHNICAL_VALIDATION",
    entityType: "Pointage",
    after: { ...input, validated: count },
    ip: actor.ip,
    userAgent: actor.userAgent,
  });

  return { validated: count };
}
