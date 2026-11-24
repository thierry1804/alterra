import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const get = vi.hoisted(() => vi.fn());
const downloadBlob = vi.hoisted(() => vi.fn());
vi.mock("../../lib/api", () => ({ api: { get } }));
vi.mock("../../lib/download", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/download")>()),
  downloadBlob,
}));

import InvoiceHistory from "./InvoiceHistory";

const revisions = [
  {
    id: "r2",
    revision: 2,
    current: true,
    reason: "Ajustement de paiement",
    createdAt: "2026-11-24T10:00:00Z",
    createdBy: "Fina Nce",
    workerCount: 2,
    gross: "275",
    isi: "14",
    net: "261",
  },
  {
    id: "r1",
    revision: 1,
    current: false,
    reason: "Génération initiale",
    createdAt: "2026-11-23T10:00:00Z",
    createdBy: null,
    workerCount: 2,
    gross: "300",
    isi: "15",
    net: "285",
  },
];

function setup() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <InvoiceHistory bordereauId="b1" />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  get.mockImplementation(async (url: string) =>
    url.endsWith("/revisions")
      ? { data: { data: revisions } }
      : {
          data: new Blob(["%PDF"]),
          headers: { "content-disposition": 'attachment; filename="Facture_r1.pdf"' },
        },
  );
});

describe("InvoiceHistory", () => {
  it("ne charge rien tant que l'historique n'est pas ouvert", () => {
    setup();
    expect(get).not.toHaveBeenCalled();
  });

  it("liste toutes les versions avec la raison, l'auteur et le net, la dernière marquée actuelle", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Historique" }));
    expect(await screen.findByText("Version 2")).toBeInTheDocument();
    expect(screen.getByText("Actuelle")).toBeInTheDocument();
    expect(screen.getByText("Ajustement de paiement")).toBeInTheDocument();
    expect(screen.getByText(/Fina Nce/)).toBeInTheDocument();
    expect(screen.getByText("Génération initiale")).toBeInTheDocument();
    expect(screen.getByText("Net à payer : 285 Ar")).toBeInTheDocument();
  });

  it("télécharge la version choisie, pas seulement la dernière", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Historique" }));
    await user.click(
      await screen.findByRole("button", { name: "Télécharger la version 1 de la facture" }),
    );
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    expect(get).toHaveBeenLastCalledWith("/bordereaux/b1/invoice/revisions/r1", {
      responseType: "blob",
    });
    expect(downloadBlob.mock.calls[0][1]).toBe("Facture_r1.pdf");
  });
});
