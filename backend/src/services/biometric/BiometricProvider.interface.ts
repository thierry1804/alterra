import type { BioResult } from "@prisma/client";

export interface BiometricVerificationInput {
  workerId: string;
  photoBase64?: string;
}

export interface BiometricVerificationResult {
  result: BioResult;
  score: number | null;
  rawResponse?: Record<string, unknown>;
}

export interface BiometricProvider {
  verify(input: BiometricVerificationInput): Promise<BiometricVerificationResult>;
}
