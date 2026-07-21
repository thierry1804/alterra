import type { BiometricProvider } from "./BiometricProvider.interface.js";
import { MockBiometricProvider } from "./MockBiometricProvider.js";

export function getBiometricProvider(): BiometricProvider {
  const provider = process.env.BIOMETRIC_PROVIDER ?? "MOCK";
  switch (provider.toUpperCase()) {
    case "MOCK":
    default:
      return new MockBiometricProvider();
  }
}
