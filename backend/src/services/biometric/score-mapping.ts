import { BioResult } from "@prisma/client";

const DOUBT_FLOOR = 0.5;

/** Mappe un score AXIAN vers BioResult (seuil OK configurable). */
export function mapAxianScoreToBioResult(score: number, okThreshold: number): BioResult {
  if (score >= okThreshold) return BioResult.OK;
  if (score >= DOUBT_FLOOR) return BioResult.DOUBT;
  return BioResult.KO;
}
