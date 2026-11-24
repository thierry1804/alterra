import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import * as matrix from "../../lib/access-matrix";
import {
  ADMIN_ROLE_ID,
  type AccessRole,
  type PermissionGroup,
  type PermissionResource,
} from "../../lib/access";
import RolesMatrix from "./RolesMatrix";

// Compte les rendus de ligne : groupShortName est appelé une fois par rendu d'une ligne.
vi.mock("../../lib/access-matrix", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/access-matrix")>();
  return { ...actual, groupShortName: vi.fn(actual.groupShortName) };
});

const resources: PermissionResource[] = [
  { resource: "pointage", label: "Pointages", actions: [{ action: "lecture", label: "Voir" }] },
  {
    resource: "badge",
    label: "Badges",
    actions: [{ action: "lecture", label: "Voir les badges" }],
  },
];

function group(id: string, name: string, permissions: string[]): PermissionGroup {
  return { id, name, description: null, isSystem: true, permissions, roleCount: 0 };
}

const groups = [
  group("g1", "Pointages — consultation", ["pointage:lecture"]),
  group("g2", "Pointages — correction", ["pointage:lecture"]),
  group("g3", "Badges — gestion", ["badge:lecture"]),
];

function role(id: string, name: string, groupIds: string[]): AccessRole {
  return {
    id,
    name,
    description: null,
    isSystem: id === ADMIN_ROLE_ID,
    scope: "SITE",
    mfaRequired: false,
    groupIds,
    permissions: [],
    userCount: 2,
  };
}

const roles = [
  role("r1", "Consultation", ["g1"]),
  role(ADMIN_ROLE_ID, "Administrateur", ["g1", "g2", "g3"]),
];

function setup() {
  const onToggle = vi.fn();
  render(<RolesMatrix roles={roles} groups={groups} resources={resources} onToggle={onToggle} />);
  return { onToggle, user: userEvent.setup() };
}

describe("RolesMatrix", () => {
  it("affiche l'appartenance de chaque groupe à chaque rôle", () => {
    setup();
    expect(
      screen.getByRole("checkbox", { name: "Consultation : Pointages — consultation" }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: "Consultation : Badges — gestion" }),
    ).not.toBeChecked();
  });

  it("met l'Administrateur en première colonne, verrouillé", () => {
    setup();
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers[1]).toContain("Administrateur");
    expect(
      screen.getByRole("checkbox", { name: "Administrateur : Badges — gestion" }),
    ).toBeDisabled();
  });

  it("coche un groupe d'un clic", async () => {
    const { onToggle, user } = setup();
    await user.click(screen.getByRole("checkbox", { name: "Consultation : Badges — gestion" }));
    expect(onToggle).toHaveBeenCalledExactlyOnceWith(roles[0], groups[2], true);
  });

  it("ne déclenche rien sur une case de l'Administrateur", async () => {
    const { onToggle, user } = setup();
    await user.click(screen.getByRole("checkbox", { name: "Administrateur : Badges — gestion" }));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("replie et déplie un domaine", async () => {
    const { user } = setup();
    const section = screen.getByRole("button", { name: /Badges/ });
    expect(section).toHaveAttribute("aria-expanded", "true");
    await user.click(section);
    expect(
      screen.queryByRole("checkbox", { name: "Consultation : Badges — gestion" }),
    ).not.toBeInTheDocument();
    expect(section).toHaveAttribute("aria-expanded", "false");
  });

  it("filtre les groupes par recherche, même dans un domaine replié", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: /Badges/ }));
    await user.type(screen.getByRole("searchbox", { name: "Rechercher un groupe" }), "badge");
    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("checkbox", { name: "Consultation : Badges — gestion" }),
    ).toBeInTheDocument();
    expect(
      within(table).queryByRole("checkbox", { name: /Pointages — correction/ }),
    ).not.toBeInTheDocument();
  });

  it("indique quand rien ne correspond", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("searchbox"), "zzzz");
    expect(screen.getByText(/Aucun groupe ne correspond/)).toBeInTheDocument();
  });

  it("ne re-rend que la ligne dont l'appartenance change", () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <RolesMatrix roles={roles} groups={groups} resources={resources} onToggle={onToggle} />,
    );
    const shortName = vi.mocked(matrix.groupShortName);
    shortName.mockClear();

    const updated = [role("r1", "Consultation", ["g1", "g3"]), roles[1]];
    rerender(
      <RolesMatrix roles={updated} groups={groups} resources={resources} onToggle={onToggle} />,
    );

    expect(shortName).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("checkbox", { name: "Consultation : Badges — gestion" })).toBeChecked();
  });
});
