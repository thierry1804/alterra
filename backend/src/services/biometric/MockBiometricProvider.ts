import { BioResult } from "@prisma/client";
import type {
  BiometricProvider,
  BiometricVerificationInput,
  BiometricVerificationResult,
} from "./BiometricProvider.interface.js";

/** Provider de développement — OK si photo fournie, sinon KO. */
export class MockBiometricProvider implements BiometricProvider {
  async verify(input: BiometricVerificationInput): Promise<BiometricVerificationResult> {
    if (input.photoBase64 && input.photoBase64.length > 32) {
      return {
        result: BioResult.OK,
        score: 0.97,
        rawResponse: { provider: "MOCK", matched: true },
      };
    }

    return {
      result: BioResult.KO,
      score: 0.12,
      rawResponse: { provider: "MOCK", matched: false, reason: "missing_photo" },
    };
  }
}
