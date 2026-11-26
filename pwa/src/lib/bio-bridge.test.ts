import { describe, expect, it, vi } from "vitest";
import {
  bridgeIntentUrl,
  bridgeOutcomeMessage,
  isAndroidBrowser,
  isFinalSession,
  waitForBridgeSession,
  type BridgeSessionView,
} from "./bio-bridge";

function view(
  status: BridgeSessionView["status"],
  outcome: BridgeSessionView["outcome"] = null,
): BridgeSessionView {
  return {
    id: "s1",
    status,
    outcome,
    bioResult: outcome === "MATCH" ? "OK" : outcome === "NO_MATCH" ? "KO" : null,
    expiresAt: "2026-11-26T10:05:00.000Z",
  };
}

describe("bridge intent url", () => {
  it("targets the bridge package and carries the reference", () => {
    expect(bridgeIntentUrl("abcDEF123_-abcDEF123", "app.pontbio", "pontbio")).toBe(
      "intent://verifier?ref=abcDEF123_-abcDEF123#Intent;scheme=pontbio;package=app.pontbio;end",
    );
  });

  it("encodes anything unsafe in the reference", () => {
    expect(bridgeIntentUrl("a b&c", "p", "s")).toContain("ref=a%20b%26c");
  });
});

describe("platform detection", () => {
  it("recognises Android browsers only", () => {
    expect(isAndroidBrowser("Mozilla/5.0 (Linux; Android 13; moto g 5G) Chrome/120")).toBe(true);
    expect(isAndroidBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)")).toBe(false);
    expect(isAndroidBrowser("Mozilla/5.0 (X11; Linux x86_64) Chrome/120")).toBe(false);
  });
});

describe("session helpers", () => {
  it("treats completed and expired sessions as final", () => {
    expect(isFinalSession(view("COMPLETED"))).toBe(true);
    expect(isFinalSession(view("EXPIRED"))).toBe(true);
    expect(isFinalSession(view("PENDING"))).toBe(false);
    expect(isFinalSession(view("STARTED"))).toBe(false);
  });

  it("explains every outcome in French", () => {
    expect(bridgeOutcomeMessage("MATCH", "COMPLETED")).toBe("Identité confirmée.");
    expect(bridgeOutcomeMessage("NO_MATCH", "COMPLETED")).toContain("ne correspond pas");
    expect(bridgeOutcomeMessage("FACE_NOT_DETECTED", "COMPLETED")).toContain("Aucun visage");
    expect(bridgeOutcomeMessage("LIVENESS_FAILED", "COMPLETED")).toContain("présence");
    expect(bridgeOutcomeMessage("CANCELLED", "COMPLETED")).toContain("annulée");
    expect(bridgeOutcomeMessage("UPDATE_REQUIRED", "COMPLETED")).toContain("mis à jour");
    expect(bridgeOutcomeMessage("LICENSE_PROBLEM", "COMPLETED")).toContain("Licence");
    expect(bridgeOutcomeMessage("FAILURE", "COMPLETED")).toContain("échoué");
    expect(bridgeOutcomeMessage(null, "EXPIRED")).toContain("expiré");
    expect(bridgeOutcomeMessage(null, "PENDING")).toContain("attente");
  });
});

describe("waiting for the bridge", () => {
  it("polls until the session is final and returns it", async () => {
    const fetchView = vi
      .fn()
      .mockResolvedValueOnce(view("PENDING"))
      .mockResolvedValueOnce(view("STARTED"))
      .mockResolvedValueOnce(view("COMPLETED", "MATCH"));
    const updates: string[] = [];

    const result = await waitForBridgeSession("s1", {
      fetchView,
      sleep: async () => undefined,
      onUpdate: (v) => updates.push(v.status),
    });

    expect(result?.outcome).toBe("MATCH");
    expect(updates).toEqual(["PENDING", "STARTED", "COMPLETED"]);
    expect(fetchView).toHaveBeenCalledTimes(3);
  });

  it("keeps trying after a network error", async () => {
    const fetchView = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(view("EXPIRED"));

    const result = await waitForBridgeSession("s1", { fetchView, sleep: async () => undefined });

    expect(result?.status).toBe("EXPIRED");
  });

  it("stops when it is cancelled", async () => {
    const controller = new AbortController();
    const fetchView = vi.fn().mockImplementation(async () => {
      controller.abort();
      return view("PENDING");
    });

    const result = await waitForBridgeSession("s1", {
      fetchView,
      sleep: async () => undefined,
      signal: controller.signal,
    });

    expect(result).toBeNull();
    expect(fetchView).toHaveBeenCalledTimes(1);
  });
});
