import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const patch = vi.hoisted(() => vi.fn());
vi.mock("../../lib/api", () => ({ api: { patch } }));

import IsiSettingsCard from "./IsiSettingsCard";

function setup(props: { ratePercent?: number; decimals?: number } = {}) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <IsiSettingsCard
        ratePercent={props.ratePercent ?? 5}
        decimals={props.decimals ?? 0}
        loading={false}
      />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  patch.mockResolvedValue({ data: {} });
});

describe("IsiSettingsCard", () => {
  it("reprend le taux et les décimales enregistrés, bouton inactif tant que rien ne change", () => {
    setup({ ratePercent: 5, decimals: 2 });
    expect(screen.getByLabelText("Taux (%)")).toHaveValue("5");
    expect(screen.getByLabelText("Décimales des montants")).toHaveValue("2");
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  });

  it("enregistre le nombre de décimales choisi", async () => {
    const user = setup({ decimals: 0 });
    await user.selectOptions(screen.getByLabelText("Décimales des montants"), "2");
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith("/app-settings/isi", { ratePercent: 5, decimals: 2 }),
    );
  });

  it("explique où s'applique le réglage, avec un exemple selon le choix", async () => {
    const user = setup({ decimals: 0 });
    expect(screen.getByText(/exemple : 118 750 Ar/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Décimales des montants"), "1");
    expect(screen.getByText(/exemple : 118 750,5 Ar/)).toBeInTheDocument();
    expect(
      screen.getByText(/facture PDF et colonne « Montant » du fichier Excel MVola/),
    ).toBeInTheDocument();
  });

  it("refuse un taux invalide", async () => {
    const user = setup();
    const rate = screen.getByLabelText("Taux (%)");
    await user.clear(rate);
    await user.type(rate, "120");
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
  });
});
