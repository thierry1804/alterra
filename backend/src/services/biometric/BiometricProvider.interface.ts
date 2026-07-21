import type { BioProvider, BioResult } from "@prisma/client";

export interface BiometricVerificationInput {
  workerId: string;
  mvolaNumber?: string;
  photoBase64?: string;
}

export interface BiometricVerificationResult {
  result: BioResult;
  score: number | null;
  rawResponse?: Record<string, unknown>;
}

export interface BiometricProvider {
  readonly provider: BioProvider;
  verify(input: BiometricVerificationInput): Promise<BiometricVerificationResult>;
}
