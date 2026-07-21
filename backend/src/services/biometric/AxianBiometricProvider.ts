import { BioProvider, BioResult } from "@prisma/client";
import type {
  BiometricProvider,
  BiometricVerificationInput,
  BiometricVerificationResult,
} from "./BiometricProvider.interface.js";
import { mapAxianScoreToBioResult } from "./score-mapping.js";

const DEFAULT_API_URL = "https://biometric.axian.mg/api/v1/kyc/compare";
const DEFAULT_OK_THRESHOLD = 0.85;
const REQUEST_TIMEOUT_MS = 8_000;

export interface AxianBiometricProviderOptions {
  apiUrl?: string;
  apiKey?: string;
  okThreshold?: number;
  fetchFn?: typeof fetch;
}

function parseAxianBody(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text };
  }
}

/** Intégration API AXIAN — erreurs 5xx / réseau → UNAVAILABLE. */
export class AxianBiometricProvider implements BiometricProvider {
  readonly provider = BioProvider.AXIAN;

  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly okThreshold: number;
  private readonly fetchFn: typeof fetch;

  constructor(options: AxianBiometricProviderOptions = {}) {
    this.apiUrl = options.apiUrl ?? process.env.AXIAN_API_URL ?? DEFAULT_API_URL;
    this.apiKey = options.apiKey ?? process.env.AXIAN_API_KEY ?? "";
    this.okThreshold =
      options.okThreshold ??
      Number(process.env.AXIAN_MATCH_THRESHOLD ?? String(DEFAULT_OK_THRESHOLD));
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async verify(input: BiometricVerificationInput): Promise<BiometricVerificationResult> {
    if (!this.apiKey) {
      return {
        result: BioResult.UNAVAILABLE,
        score: null,
        rawResponse: { provider: "AXIAN", error: "missing_api_key" },
      };
    }

    if (!input.photoBase64 || input.photoBase64.length < 32) {
      return {
        result: BioResult.KO,
        score: null,
        rawResponse: { provider: "AXIAN", reason: "missing_photo" },
      };
    }

    if (!input.mvolaNumber) {
      return {
        result: BioResult.UNAVAILABLE,
        score: null,
        rawResponse: { provider: "AXIAN", error: "missing_mvola_reference" },
      };
    }

    try {
      const formData = new FormData();
      formData.append("reference_number", input.mvolaNumber);
      const photoBuffer = Buffer.from(input.photoBase64, "base64");
      formData.append(
        "photo",
        new Blob([photoBuffer], { type: "image/jpeg" }),
        "capture.jpg",
      );

      const response = await this.fetchFn(this.apiUrl, {
        method: "POST",
        headers: { "X-API-Key": this.apiKey },
        body: formData,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const body = parseAxianBody(await response.text());

      if (response.status >= 500) {
        return {
          result: BioResult.UNAVAILABLE,
          score: null,
          rawResponse: { provider: "AXIAN", httpStatus: response.status, body },
        };
      }

      if (!response.ok) {
        return {
          result: BioResult.KO,
          score: null,
          rawResponse: { provider: "AXIAN", httpStatus: response.status, body },
        };
      }

      if (typeof body.score === "number") {
        return {
          result: mapAxianScoreToBioResult(body.score, this.okThreshold),
          score: body.score,
          rawResponse: { provider: "AXIAN", ...body },
        };
      }

      const matched = body.match === true;
      return {
        result: matched ? BioResult.OK : BioResult.KO,
        score: matched ? 1 : 0,
        rawResponse: { provider: "AXIAN", ...body },
      };
    } catch (error) {
      return {
        result: BioResult.UNAVAILABLE,
        score: null,
        rawResponse: {
          provider: "AXIAN",
          error: error instanceof Error ? error.message : "network_error",
        },
      };
    }
  }
}
