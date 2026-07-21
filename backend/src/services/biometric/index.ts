import type { BioProvider } from "@prisma/client";
import type { BiometricProvider } from "./BiometricProvider.interface.js";
import { AxianBiometricProvider } from "./AxianBiometricProvider.js";
import { ManualBiometricProvider } from "./ManualBiometricProvider.js";
import { MockBiometricProvider } from "./MockBiometricProvider.js";

export function getBiometricProvider(): BiometricProvider {
  const provider = (process.env.BIOMETRIC_PROVIDER ?? "MOCK").toUpperCase();
  switch (provider) {
    case "MANUAL":
      return new ManualBiometricProvider();
    case "AXIAN":
      return new AxianBiometricProvider();
    case "MOCK":
    default:
      return new MockBiometricProvider();
  }
}

export function resolveBiometricProviderName(): BioProvider {
  return getBiometricProvider().provider;
}
