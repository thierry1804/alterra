import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { AccessRole, PermissionResource } from "../../lib/access";
import RolesTable from "./RolesTable";

const resources: PermissionResource[] = [
  { resource: "pointage", label: "Pointages", actions: [{ action: "lecture", label: "Voir" }] },
  { resource: "badge", label: "Badges", actions: [{ action: "lecture", label: "Voir" }] },
];

const roles: AccessRole[] = [
  {
    id: "admin",
    name: "Administrateur",
    description: "Tous les droits",
    isSystem: true,
    scope: "TOUS",
    mfaRequired: true,
    groupIds: ["g1"],
    permissions: ["pointage:lecture", "badge:lecture"],
    userCount: 1,
    version: "v1",
  },
  {
    id: "conso",
    name: "Consultation",
    description: null,
    isSystem: false,
    scope: "TOUS",
    mfaRequired: false,
    groupIds: [],
    permissions: ["badge:lecture"],
    userCount: 0,
    version: "v1",
  },
];

function setup() {
  const handlers = {
    onOpenDetail: vi.fn(),
    onPatch: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
  };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <RolesTable roles={roles} resources={resources} {...handlers} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...handlers, user: userEvent.setup() };
}

describe("RolesTable", () => {
  it("affiche un résumé par domaine et le nombre d'utilisateurs", () => {
    setup();
    const row = screen.getByRole("row", { name: /Administrateur/ });
    expect(within(row).getByText("Pointages")).toBeInTheDocument();
    expect(within(row).getByText("Badges")).toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: /1 utilisateur avec le rôle/ }),
    ).toBeInTheDocument();
  });

  it("change la portée depuis la cellule", async () => {
    const { onPatch, user } = setup();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Portée du rôle Consultation" }),
      "SITE",
    );
    expect(onPatch).toHaveBeenCalledWith(roles[1], { scope: "SITE" });
  });

  it("bascule le MFA avec l'interrupteur sans ouvrir le détail", async () => {
    const { onPatch, onOpenDetail, user } = setup();
    await user.click(
      screen.getByRole("switch", {
        name: "Double authentification exigée pour le rôle Consultation",
      }),
    );
    expect(onPatch).toHaveBeenCalledWith(roles[1], { mfaRequired: true });
    expect(onOpenDetail).not.toHaveBeenCalled();
  });

  it("ouvre le détail au clic sur la ligne", async () => {
    const { onOpenDetail, user } = setup();
    await user.click(screen.getByText("Tous les droits").closest("td")!);
    expect(onOpenDetail).toHaveBeenCalledWith(roles[0]);
  });

  it("modifie le nom en place", async () => {
    const { onPatch, user } = setup();
    await user.click(screen.getByRole("button", { name: /Nom du rôle Consultation/ }));
    const input = screen.getByRole("textbox", { name: "Nom du rôle Consultation" });
    await user.clear(input);
    await user.type(input, "Lecture seule{Enter}");
    expect(onPatch).toHaveBeenCalledWith(roles[1], { name: "Lecture seule" });
  });

  it("filtre par recherche, MFA et usage, puis réinitialise", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("searchbox", { name: "Rechercher un rôle" }), "consult");
    expect(screen.queryByRole("row", { name: /Administrateur/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Réinitialiser" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filtrer par usage" }),
      "inutilises",
    );
    expect(screen.queryByRole("row", { name: /Administrateur/ })).not.toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Consultation/ })).toBeInTheDocument();
  });

  it("bloque la suppression d'un rôle système dans le menu", async () => {
    const { onDelete, user } = setup();
    await user.click(screen.getByRole("button", { name: "Actions du rôle Administrateur" }));
    const item = await screen.findByRole("menuitem", { name: /Supprimer/ });
    expect(item).toHaveAttribute("aria-disabled", "true");
    await user.click(item);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("propose la suppression d'un rôle personnalisé sans utilisateur", async () => {
    const { onDelete, user } = setup();
    await user.click(screen.getByRole("button", { name: "Actions du rôle Consultation" }));
    await user.click(await screen.findByRole("menuitem", { name: /Supprimer/ }));
    expect(onDelete).toHaveBeenCalledWith(roles[1]);
  });
});
