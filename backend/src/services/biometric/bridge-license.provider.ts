import { randomBytes } from "node:crypto";
import { ApiError } from "../../middleware/error-handler.js";

export interface BridgeTicket {
  accessToken: string;
  referenceFaceBase64: string;
  matchingThreshold?: number;
  timeoutSeconds?: number;
  livenessThreshold?: number;
}

export interface BridgeLicenseRequest {
  deviceId: string;
  engineVersion: string;
  worker: { id: string; mvolaNumber: string };
}

export interface BridgeLicenseProvider {
  issue(request: BridgeLicenseRequest): Promise<BridgeTicket>;
}

export class MockBridgeLicenseProvider implements BridgeLicenseProvider {
  async issue(): Promise<BridgeTicket> {
    return {
      accessToken: `mock-${randomBytes(9).toString("base64url")}`,
      referenceFaceBase64: randomBytes(64).toString("base64"),
    };
  }
}

export function getBridgeLicenseProvider(
  env: NodeJS.ProcessEnv = process.env,
): BridgeLicenseProvider {
  const name = (env.BIOMETRIC_BRIDGE_PROVIDER ?? "MOCK").toUpperCase();
  if (name === "MOCK") {
    if (env.NODE_ENV === "production") {
      throw new ApiError(
        503,
        "BIOMETRIC_PROVIDER_NOT_CONFIGURED",
        "Le fournisseur biométrique n'est pas configuré",
      );
    }
    return new MockBridgeLicenseProvider();
  }
  throw new ApiError(
    503,
    "BIOMETRIC_PROVIDER_NOT_CONFIGURED",
    "Le fournisseur biométrique n'est pas configuré",
  );
}
