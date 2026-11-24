import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessRole, PermissionGroup, PermissionResource } from "../lib/access";

const resources: PermissionResource[] = [
  { resource: "badge", label: "Badges", actions: [{ action: "ecriture", label: "Gérer" }] },
];
const groups: PermissionGroup[] = [
  {
    id: "g1",
    name: "Badges — gestion",
    description: null,
    isSystem: true,
    permissions: ["badge:ecriture"],
    roleCount: 1,
  },
];
const roleFixture = (overrides: Partial<AccessRole> = {}): AccessRole => ({
  id: "r1",
  name: "Finance",
  description: null,
  isSystem: false,
  scope: "SITE",
  mfaRequired: true,
  groupIds: [],
  permissions: [],
  userCount: 4,
  version: "v1",
  ...overrides,
});

const api = vi.hoisted(() => ({
  catalog: vi.fn(),
  groups: vi.fn(),
  roles: vi.fn(),
  bulkUpdateRoles: vi.fn(),
}));

vi.mock("../lib/access", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/access")>();
  return { ...actual, accessApi: { ...actual.accessApi, ...api } };
});
vi.mock("../hooks/useAuth", () => ({ useAuth: () => ({ user: { permissions: ["role:gerer"] } }) }));

import { Toaster } from "../components/ui/toaster";
import AccessRolesPage from "./AccessRoles";

function renderPage() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <AccessRolesPage />
        <Toaster />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  api.catalog.mockResolvedValue(resources);
  api.groups.mockResolvedValue(groups);
  api.roles.mockResolvedValue([roleFixture()]);
  api.bulkUpdateRoles.mockResolvedValue({
    data: [roleFixture({ mfaRequired: false, version: "v2" })],
    before: [roleFixture()],
  });
});

const mfaSwitch = () =>
  screen.findByRole("switch", { name: "Double authentification exigée pour le rôle Finance" });

describe("page Rôles : brouillon et enregistrement groupé", () => {
  it("garde les modifications en local, avec une barre de compte, jusqu'à l'enregistrement", async () => {
    const user = renderPage();
    await user.click(await mfaSwitch());

    expect(await screen.findByRole("status")).toHaveTextContent("1 modification non enregistrée");
    expect(await mfaSwitch()).toHaveAttribute("aria-checked", "false");
    expect(api.bulkUpdateRoles).not.toHaveBeenCalled();
  });

  it("annule le brouillon et restaure l'état enregistré", async () => {
    const user = renderPage();
    await user.click(await mfaSwitch());
    await user.click(
      within(screen.getByRole("region", { name: /non enregistrées/ })).getByRole("button", {
        name: "Annuler",
      }),
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(await mfaSwitch()).toHaveAttribute("aria-checked", "true");
  });

  it("revenir à la valeur d'origine retire la modification", async () => {
    const user = renderPage();
    await user.click(await mfaSwitch());
    await user.click(await mfaSwitch());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("résume, demande la confirmation du retrait du MFA puis envoie une seule requête avec la version", async () => {
    const user = renderPage();
    await user.click(await mfaSwitch());
    await user.click(screen.getByRole("button", { name: /Enregistrer…/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("MFA : exigée → non exigée")).toBeInTheDocument();
    expect(
      within(dialog).getByText("4 utilisateurs concernés · changement sensible"),
    ).toBeInTheDocument();

    const confirm = within(dialog).getByRole("button", { name: "Enregistrer" });
    expect(confirm).toBeDisabled();
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(confirm);

    await waitFor(() => expect(api.bulkUpdateRoles).toHaveBeenCalledTimes(1));
    expect(api.bulkUpdateRoles).toHaveBeenCalledWith([
      { roleId: "r1", expectedVersion: "v1", mfaRequired: false },
    ]);
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("garde le brouillon quand le serveur refuse", async () => {
    api.bulkUpdateRoles.mockRejectedValueOnce(
      Object.assign(new Error("409"), {
        isAxiosError: true,
        response: { data: { message: "Rôle modifié entre-temps" } },
      }),
    );
    const user = renderPage();
    await user.click(await mfaSwitch());
    await user.click(screen.getByRole("button", { name: /Enregistrer…/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(api.bulkUpdateRoles).toHaveBeenCalled());
    expect(await screen.findByRole("status")).toHaveTextContent("1 modification non enregistrée");
  });

  it("avertit en quittant l'onglet avec des modifications non enregistrées", async () => {
    const user = renderPage();
    await user.click(await mfaSwitch());
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("ne bloque pas la fermeture quand il n'y a rien à perdre", async () => {
    renderPage();
    await mfaSwitch();
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it("propose d'annuler après l'enregistrement et renvoie les valeurs d'avant", async () => {
    const user = renderPage();
    await user.click(await mfaSwitch());
    await user.click(screen.getByRole("button", { name: /Enregistrer…/ }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(screen.getAllByText("Modifications enregistrées").length).toBeGreaterThan(0),
    );
    // Les toasts sont globaux : le plus récent est le premier.
    await user.click(screen.getAllByRole("button", { name: "Annuler" })[0]);
    await waitFor(() => expect(api.bulkUpdateRoles).toHaveBeenCalledTimes(2));
    expect(api.bulkUpdateRoles).toHaveBeenLastCalledWith([
      { roleId: "r1", expectedVersion: "v2", mfaRequired: true },
    ]);
  });
});
