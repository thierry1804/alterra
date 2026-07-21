import { BioContext, BioProvider, BioResult } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { getIsoWeekString } from "../../lib/week-iso.js";
import { getBiometricProvider } from "./index.js";

export interface PerformBiometricCheckInput {
  workerId: string;
  performedById: string;
  context?: BioContext;
  photoBase64?: string;
  referenceDate?: Date;
}

export interface BiometricCheckResponse {
  id: string;
  workerId: string;
  context: BioContext;
  result: BioResult;
  score: number | null;
  provider: BioProvider;
  weekIso: string | null;
  performedAt: string;
}

export async function performBiometricCheck(
  input: PerformBiometricCheckInput,
): Promise<BiometricCheckResponse> {
  await prisma.worker.findUniqueOrThrow({ where: { id: input.workerId } });

  const referenceDate = input.referenceDate ?? new Date();
  const weekIso = getIsoWeekString(referenceDate);
  const provider = getBiometricProvider();
  const verification = await provider.verify({
    workerId: input.workerId,
    photoBase64: input.photoBase64,
  });

  const providerName = (process.env.BIOMETRIC_PROVIDER ?? "MOCK").toUpperCase();
  const providerEnum = Object.values(BioProvider).includes(providerName as BioProvider)
    ? (providerName as BioProvider)
    : BioProvider.MOCK;

  const created = await prisma.biometricCheck.create({
    data: {
      workerId: input.workerId,
      context: input.context ?? BioContext.WEEKLY_VALIDATION,
      result: verification.result,
      score: verification.score,
      provider: providerEnum in BioProvider ? providerEnum : BioProvider.MOCK,
      performedById: input.performedById,
      weekIso,
      rawResponse: verification.rawResponse ?? undefined,
    },
  });

  return {
    id: created.id,
    workerId: created.workerId,
    context: created.context,
    result: created.result,
    score: created.score,
    provider: created.provider,
    weekIso: created.weekIso,
    performedAt: created.performedAt.toISOString(),
  };
}
