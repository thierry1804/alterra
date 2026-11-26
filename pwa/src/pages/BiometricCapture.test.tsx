import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bridge = vi.hoisted(() => ({
  android: true,
  createBridgeSession: vi.fn(),
}));

vi.mock("../lib/api", () => ({
  api: { get: vi.fn().mockResolvedValue({ data: { firstName: "Jean", lastName: "Rakoto" } }) },
}));
vi.mock("../lib/bio-bridge", () => ({
  isAndroidBrowser: () => bridge.android,
  createBridgeSession: bridge.createBridgeSession,
  waitForBridgeSession: () => new Promise(() => undefined),
  bridgeIntentUrl: () => "#pont",
  bridgeOutcomeMessage: () => "",
}));
vi.mock("../lib/biometric", () => ({
  blobToBase64: vi.fn(),
  queueOfflineBiometricCheck: vi.fn(),
  submitBiometricCheck: vi.fn(),
  submitBiometricCheckOffline: vi.fn(),
}));
vi.mock("../lib/image", () => ({ compressPhoto: vi.fn() }));
vi.mock("../services/biometric/TemplateCache", () => ({ getCachedBiometricTemplate: vi.fn() }));
vi.mock("../services/biometric/FaceMatcher", () => ({ matchFaceBlobAgainstTemplate: vi.fn() }));

import BiometricCapture from "./BiometricCapture";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/validation/bio/w1?date=2026-11-17"]}>
      <Routes>
        <Route path="/validation/bio/:workerId" element={<BiometricCapture />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BiometricCapture", () => {
  beforeEach(() => {
    bridge.createBridgeSession.mockReset();
    bridge.createBridgeSession.mockResolvedValue({
      id: "s1",
      reference: "abcDEF123_-abcDEF123",
      expiresAt: "2026-11-26T10:05:00.000Z",
    });
  });

  it("opens the bridge straight away on Android, without the camera screen", async () => {
    bridge.android = true;
    renderPage();

    await waitFor(() => expect(bridge.createBridgeSession).toHaveBeenCalledTimes(1));
    expect(bridge.createBridgeSession).toHaveBeenCalledWith("w1", "2026-11-17");
    expect(
      await screen.findByText("Vérification en cours dans le moteur biométrique…"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Capturer et analyser" })).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("keeps the browser capture outside Android and does not open the bridge", async () => {
    bridge.android = false;
    renderPage();

    expect(await screen.findByRole("button", { name: "Capturer et analyser" })).toBeInTheDocument();
    expect(bridge.createBridgeSession).not.toHaveBeenCalled();
  });
});
