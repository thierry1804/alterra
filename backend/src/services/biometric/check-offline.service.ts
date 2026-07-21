import { BioContext, BioProvider, BioResult, Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { getIsoWeekString } from "../../lib/week-iso.js";

export interface OfflineBiometricCheckInput {
  clientUuid: string;
  workerId: string;
  result: BioResult;
  score: number | null;
  performedById: string;
  context?: BioContext;
  referenceDate?: Date;
  performedAt: Date;
}

export type OfflineCheckResultStatus = "created" | "already_exists";

export interface OfflineBiometricCheckResponse {
  clientUuid: string;
  status: OfflineCheckResultStatus;
  id: string;
  workerId: string;
  result: BioResult;
  score: number | null;
  weekIso: string | null;
  performedAt: string;
}

export async function recordOfflineBiometricCheck(
  input: OfflineBiometricCheckInput,
): Promise<OfflineBiometricCheckResponse> {
  await prisma.worker.findUniqueOrThrow({ where: { id: input.workerId } });

  const referenceDate = input.referenceDate ?? input.performedAt;
  const weekIso = getIsoWeekString(referenceDate);

  const existing = await prisma.biometricCheck.findFirst({
    where: {
      workerId: input.workerId,
      provider: BioProvider.LOCAL_OFFLINE,
      weekIso,
      rawResponse: {
        path: ["clientUuid"],
        equals: input.clientUuid,
      },
    },
  });

  if (existing) {
    return {
      clientUuid: input.clientUuid,
      status: "already_exists",
      id: existing.id,
      workerId: existing.workerId,
      result: existing.result,
      score: existing.score,
      weekIso: existing.weekIso,
      performedAt: existing.performedAt.toISOString(),
    };
  }

  try {
    const created = await prisma.biometricCheck.create({
      data: {
        workerId: input.workerId,
        context: input.context ?? BioContext.WEEKLY_VALIDATION,
        result: input.result,
        score: input.score,
        provider: BioProvider.LOCAL_OFFLINE,
        performedById: input.performedById,
        weekIso,
        performedAt: input.performedAt,
        rawResponse: {
          clientUuid: input.clientUuid,
          offline: true,
        },
      },
    });

    return {
      clientUuid: input.clientUuid,
      status: "created",
      id: created.id,
      workerId: created.workerId,
      result: created.result,
      score: created.score,
      weekIso: created.weekIso,
      performedAt: created.performedAt.toISOString(),
    };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const duplicate = await prisma.biometricCheck.findFirst({
        where: {
          workerId: input.workerId,
          provider: BioProvider.LOCAL_OFFLINE,
          weekIso,
        },
        orderBy: { performedAt: "desc" },
      });
      if (duplicate) {
        return {
          clientUuid: input.clientUuid,
          status: "already_exists",
          id: duplicate.id,
          workerId: duplicate.workerId,
          result: duplicate.result,
          score: duplicate.score,
          weekIso: duplicate.weekIso,
          performedAt: duplicate.performedAt.toISOString(),
        };
      }
    }
    throw err;
  }
}
