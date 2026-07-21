import { afterEach, describe, expect, it, vi } from "vitest";
import { BioProvider, BioResult } from "@prisma/client";
import { AxianBiometricProvider } from "../services/biometric/AxianBiometricProvider.js";
import { ManualBiometricProvider } from "../services/biometric/ManualBiometricProvider.js";
import { mapAxianScoreToBioResult } from "../services/biometric/score-mapping.js";
import { getBiometricProvider } from "../services/biometric/index.js";

describe("mapAxianScoreToBioResult", () => {
  it("maps score to OK / DOUBT / KO", () => {
    expect(mapAxianScoreToBioResult(0.92, 0.85)).toBe(BioResult.OK);
    expect(mapAxianScoreToBioResult(0.72, 0.85)).toBe(BioResult.DOUBT);
    expect(mapAxianScoreToBioResult(0.41, 0.85)).toBe(BioResult.KO);
  });
});

describe("ManualBiometricProvider", () => {
  it("returns DOUBT for manual degraded mode", async () => {
    const provider = new ManualBiometricProvider();
    const result = await provider.verify({ workerId: "worker-1" });

    expect(result.result).toBe(BioResult.DOUBT);
    expect(result.rawResponse).toMatchObject({ requiresAdminReview: true });
    expect(provider.provider).toBe(BioProvider.MANUAL);
  });
});

describe("AxianBiometricProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns UNAVAILABLE when API key is missing", async () => {
    const provider = new AxianBiometricProvider({ apiKey: "" });
    const result = await provider.verify({
      workerId: "worker-1",
      mvolaNumber: "0340000001",
      photoBase64: "a".repeat(64),
    });

    expect(result.result).toBe(BioResult.UNAVAILABLE);
  });

  it("returns OK when AXIAN responds with high score", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ match: true, score: 0.94 }),
      }),
    );

    const provider = new AxianBiometricProvider({
      apiKey: "test-key",
      apiUrl: "https://axian.test/compare",
      okThreshold: 0.85,
    });

    const result = await provider.verify({
      workerId: "worker-1",
      mvolaNumber: "0340000001",
      photoBase64: "a".repeat(64),
    });

    expect(result.result).toBe(BioResult.OK);
    expect(result.score).toBe(0.94);
  });

  it("returns UNAVAILABLE on HTTP 503", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => JSON.stringify({ error: "service_down" }),
      }),
    );

    const provider = new AxianBiometricProvider({
      apiKey: "test-key",
      apiUrl: "https://axian.test/compare",
    });

    const result = await provider.verify({
      workerId: "worker-1",
      mvolaNumber: "0340000001",
      photoBase64: "a".repeat(64),
    });

    expect(result.result).toBe(BioResult.UNAVAILABLE);
    expect(result.rawResponse).toMatchObject({ httpStatus: 503 });
  });

  it("returns UNAVAILABLE on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));

    const provider = new AxianBiometricProvider({
      apiKey: "test-key",
      apiUrl: "https://axian.test/compare",
    });

    const result = await provider.verify({
      workerId: "worker-1",
      mvolaNumber: "0340000001",
      photoBase64: "a".repeat(64),
    });

    expect(result.result).toBe(BioResult.UNAVAILABLE);
    expect(result.rawResponse).toMatchObject({ error: "ECONNREFUSED" });
  });
});

describe("getBiometricProvider", () => {
  const originalProvider = process.env.BIOMETRIC_PROVIDER;

  afterEach(() => {
    if (originalProvider === undefined) {
      delete process.env.BIOMETRIC_PROVIDER;
    } else {
      process.env.BIOMETRIC_PROVIDER = originalProvider;
    }
  });

  it("selects provider from BIOMETRIC_PROVIDER env", () => {
    process.env.BIOMETRIC_PROVIDER = "MANUAL";
    expect(getBiometricProvider().provider).toBe(BioProvider.MANUAL);

    process.env.BIOMETRIC_PROVIDER = "AXIAN";
    expect(getBiometricProvider().provider).toBe(BioProvider.AXIAN);
  });
});
