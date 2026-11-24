import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  ADMIN_ROLE_ID,
  type AccessRole,
  type PermissionGroup,
  type PermissionResource,
} from "../../lib/access";
import RoleSheet from "./RoleSheet";

const resources: PermissionResource[] = [
  {
    resource: "pointage",
    label: "Pointages",
    actions: [{ action: "valider_site", label: "Valider ou rejeter" }],
  },
  {
    resource: "badge",
    label: "Badges",
    actions: [{ action: "lecture", label: "Voir les badges" }],
  },
];
const groups: PermissionGroup[] = [
  {
    id: "g1",
    name: "Pointages — validation",
    description: null,
    isSystem: true,
    permissions: ["pointage:valider_site"],
    roleCount: 0,
  },
  {
    id: "g2",
    name: "Badges — consultation",
    description: null,
    isSystem: true,
    permissions: ["badge:lecture"],
    roleCount: 0,
  },
];
const held = new Set(["pointage:valider_site", "badge:lecture"]);

function role(overrides: Partial<AccessRole> = {}): AccessRole {
  return {
    id: "r1",
    name: "Finance",
    description: null,
    isSystem: false,
    scope: "SITE",
    mfaRequired: false,
    groupIds: ["g2"],
    permissions: ["badge:lecture"],
    userCount: 4,
    version: "v1",
    ...overrides,
  };
}

function setup(editing: AccessRole | null, actorScope: "TOUS" | "SITE" | "EQUIPE" = "TOUS") {
  const onSubmit = vi.fn();
  render(
    <RoleSheet
      role={editing}
      roles={editing ? [editing] : []}
      groups={groups}
      resources={resources}
      held={held}
      actorScope={actorScope}
      saving={false}
      error={null}
      onSubmit={onSubmit}
      onClose={vi.fn()}
    />,
  );
  return { onSubmit, user: userEvent.setup() };
}

describe("RoleSheet", () => {
  it("crée un rôle avec sa portée, son MFA et ses groupes", async () => {
    const { onSubmit, user } = setup(null);
    await user.type(screen.getByLabelText("Nom"), "Auditeur");
    await user.click(screen.getByRole("radio", { name: /Tous les sites/ }));
    await user.click(screen.getByRole("switch", { name: "Double authentification" }));
    await user.click(screen.getByRole("checkbox", { name: "Tout sélectionner : Badges" }));
    await user.click(screen.getByRole("button", { name: "Créer le rôle" }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Auditeur",
      description: "",
      scope: "TOUS",
      mfaRequired: true,
      groupIds: new Set(["g2"]),
    });
  });

  it("n'offre pas une portée plus large que celle de l'acteur", () => {
    setup(null, "SITE");
    expect(screen.getByRole("radio", { name: /Tous les sites/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Son site/ })).toBeEnabled();
  });

  it("recommande la MFA quand les groupes choisis donnent des droits sensibles", async () => {
    const { user } = setup(role());
    expect(
      screen.queryByText(/la double authentification est recommandée/),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Tout sélectionner : Pointages" }));
    expect(screen.getByText(/la double authentification est recommandée/)).toBeInTheDocument();
    await user.click(screen.getByRole("switch", { name: "Double authentification" }));
    expect(
      screen.queryByText(/la double authentification est recommandée/),
    ).not.toBeInTheDocument();
  });

  it("résume les droits obtenus par domaine", async () => {
    const { user } = setup(role());
    expect(screen.getByText("Droits obtenus (1)")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Tout sélectionner : Pointages" }));
    expect(screen.getByText("Droits obtenus (2)")).toBeInTheDocument();
    expect(screen.getByText("Pointages · 1")).toBeInTheDocument();
  });

  it("annonce l'impact en modification", () => {
    setup(role());
    expect(screen.getByText(/4 utilisateurs ont ce rôle/)).toBeInTheDocument();
  });

  it("verrouille la portée et les groupes de l'Administrateur", () => {
    setup(role({ id: ADMIN_ROLE_ID, name: "Administrateur", isSystem: true, scope: "TOUS" }));
    expect(screen.getByText(/verrouillés/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Tous les sites/ })).toBeDisabled();
  });
});
