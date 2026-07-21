import { BioProvider, BioResult } from "@prisma/client";
import type {
  BiometricProvider,
  BiometricVerificationInput,
  BiometricVerificationResult,
} from "./BiometricProvider.interface.js";

/** Mode dégradé — revue manuelle Admin requise (DOUBT systématique). */
export class ManualBiometricProvider implements BiometricProvider {
  readonly provider = BioProvider.MANUAL;

  async verify(_input: BiometricVerificationInput): Promise<BiometricVerificationResult> {
    return {
      result: BioResult.DOUBT,
      score: null,
      rawResponse: {
        provider: "MANUAL",
        requiresAdminReview: true,
        reason: "manual_mode_degraded",
      },
    };
  }
}
