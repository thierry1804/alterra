import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AccessRole, PermissionGroup, PermissionResource } from "../../lib/access";
import GroupsTable from "./GroupsTable";

const resources: PermissionResource[] = [
  {
    resource: "badge",
    label: "Badges",
    actions: [{ action: "lecture", label: "Voir les badges" }],
  },
  {
    resource: "pointage",
    label: "Pointages",
    actions: [{ action: "lecture", label: "Voir les pointages" }],
  },
];
const groups: PermissionGroup[] = [
  {
    id: "g1",
    name: "Badges — gestion",
    description: "Gère les badges",
    isSystem: true,
    permissions: ["badge:lecture"],
    roleCount: 1,
  },
  {
    id: "g2",
    name: "Pointages — lecture",
    description: null,
    isSystem: false,
    permissions: ["pointage:lecture"],
    roleCount: 0,
  },
  {
    id: "g3",
    name: "Pointages — export",
    description: null,
    isSystem: false,
    permissions: ["pointage:lecture"],
    roleCount: 1,
  },
];
const roles = [{ id: "r1", name: "Finance", groupIds: ["g1", "g3"], userCount: 3 }] as AccessRole[];

function setup() {
  const handlers = { onOpen: vi.fn(), onDuplicate: vi.fn(), onDelete: vi.fn() };
  render(<GroupsTable groups={groups} roles={roles} resources={resources} {...handlers} />);
  return { ...handlers, user: userEvent.setup() };
}

describe("GroupsTable", () => {
  it("affiche le domaine, les permissions résumées et le nombre de rôles", () => {
    setup();
    const row = screen.getByRole("row", { name: /Badges — gestion/ });
    expect(within(row).getByText("Gestion")).toBeInTheDocument();
    expect(
      within(row).getByText("Badges", { selector: "span.rounded-full.bg-brand-tint" }),
    ).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: /1 rôle utilisent/ })).toBeInTheDocument();
  });

  it("liste les rôles qui utilisent un groupe", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /1 rôle utilisent Badges — gestion/ }));
    expect(await screen.findByText("Rôles qui utilisent ce groupe")).toBeInTheDocument();
    expect(screen.getByText("3 utilisateurs")).toBeInTheDocument();
  });

  it("ouvre le détail au clic sur la ligne", async () => {
    const { onOpen, user } = setup();
    await user.click(screen.getByText("Gère les badges"));
    expect(onOpen).toHaveBeenCalledWith(groups[0]);
  });

  it("filtre par recherche, domaine, type et usage", async () => {
    const { user } = setup();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filtrer par domaine" }),
      "Pointages",
    );
    expect(screen.queryByRole("row", { name: /Badges — gestion/ })).not.toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filtrer par usage" }),
      "inutilises",
    );
    expect(screen.getByRole("row", { name: /Pointages — lecture/ })).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /Pointages — export/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Réinitialiser" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Filtrer par type" }), "systeme");
    expect(screen.getAllByRole("row", { name: /Ouvrir le groupe/ })).toHaveLength(1);
  });

  it("explique pourquoi un groupe système ou utilisé ne peut pas être supprimé", async () => {
    const { onDelete, user } = setup();
    await user.click(screen.getByRole("button", { name: "Actions du groupe Badges — gestion" }));
    const blocked = await screen.findByRole("menuitem", { name: /Supprimer/ });
    expect(blocked).toHaveAttribute("aria-disabled", "true");
    expect(blocked).toHaveTextContent("Groupe système : suppression impossible");
    await user.click(blocked);
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("duplique et supprime un groupe libre", async () => {
    const { onDuplicate, onDelete, user } = setup();
    await user.click(screen.getByRole("button", { name: "Actions du groupe Pointages — lecture" }));
    await user.click(await screen.findByRole("menuitem", { name: /Dupliquer/ }));
    expect(onDuplicate).toHaveBeenCalledWith(groups[1]);

    await user.click(screen.getByRole("button", { name: "Actions du groupe Pointages — lecture" }));
    await user.click(await screen.findByRole("menuitem", { name: /Supprimer/ }));
    expect(onDelete).toHaveBeenCalledWith(groups[1]);
  });
});
