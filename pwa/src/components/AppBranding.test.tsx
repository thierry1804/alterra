import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.hoisted(() => vi.fn());
vi.mock("../lib/api", () => ({ api: { get } }));

const settings = (appName: string) => ({
  appName,
  iconUpdatedAt: null,
  loginBackgroundUpdatedAt: null,
  loginBranchUpdatedAt: null,
  loginLeafUpdatedAt: null,
  bioValidationRequired: true,
});

/** Chaque test repart d'un module neuf : le cache en mémoire de useAppSettings est global. */
async function loadBranding() {
  vi.resetModules();
  return (await import("./AppBranding")).default;
}

beforeEach(() => {
  vi.clearAllMocks();
  document.title = "";
  document.head.querySelector('meta[name="apple-mobile-web-app-title"]')?.remove();
});

describe("AppBranding", () => {
  it("reprend le nom paramétré pour l'onglet et le nom d'installation iOS", async () => {
    get.mockResolvedValue({ data: settings("BOSS Terrain") });
    const AppBranding = await loadBranding();
    render(<AppBranding />);

    await waitFor(() => expect(document.title).toBe("BOSS Terrain - Terrain"));
    expect(
      document.head
        .querySelector('meta[name="apple-mobile-web-app-title"]')
        ?.getAttribute("content"),
    ).toBe("BOSS Terrain");
  });

  it("garde le dernier nom connu quand le serveur est injoignable (hors ligne)", async () => {
    localStorage.setItem("alterra:app-settings", JSON.stringify(settings("BOSS Terrain")));
    get.mockRejectedValue(new Error("offline"));
    const AppBranding = await loadBranding();
    render(<AppBranding />);

    await waitFor(() => expect(document.title).toBe("BOSS Terrain - Terrain"));
  });

  it("mémorise le nom reçu pour les prochains démarrages hors ligne", async () => {
    get.mockResolvedValue({ data: settings("Nouveau nom") });
    const AppBranding = await loadBranding();
    render(<AppBranding />);

    await waitFor(() =>
      expect(localStorage.getItem("alterra:app-settings")).toContain("Nouveau nom"),
    );
  });

  it("retombe sur le nom par défaut quand rien n'est connu", async () => {
    get.mockRejectedValue(new Error("offline"));
    const AppBranding = await loadBranding();
    render(<AppBranding />);

    await waitFor(() => expect(document.title).toBe("ALTERRA - Terrain"));
  });
});
