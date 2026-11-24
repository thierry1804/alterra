import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AccessRole, PermissionGroup } from "../../lib/access";
import ReviewChangesDialog from "./ReviewChangesDialog";

const groups: PermissionGroup[] = [
  {
    id: "g1",
    name: "Badges — gestion",
    description: null,
    isSystem: true,
    permissions: [],
    roleCount: 1,
  },
];

function role(overrides: Partial<AccessRole>): AccessRole {
  return {
    id: "r1",
    name: "Chef de service",
    description: null,
    isSystem: false,
    scope: "SITE",
    mfaRequired: false,
    groupIds: [],
    permissions: [],
    userCount: 6,
    version: "v1",
    ...overrides,
  };
}

function setup(r: AccessRole, patch: object) {
  const onConfirm = vi.fn();
  render(
    <ReviewChangesDialog
      open
      roles={[r]}
      groups={groups}
      draft={{ [r.id]: { patch, version: "v1" } }}
      onConfirm={onConfirm}
      onOpenChange={vi.fn()}
    />,
  );
  return { onConfirm, user: userEvent.setup() };
}

describe("ReviewChangesDialog", () => {
  it("résume les changements et l'impact, sans case à cocher pour un rôle ordinaire", async () => {
    const { onConfirm, user } = setup(role({}), { scope: "TOUS", groupIds: ["g1"] });
    expect(screen.getByText("6 utilisateurs concernés")).toBeInTheDocument();
    expect(screen.getByText("Portée : Son site → Tous les sites")).toBeInTheDocument();
    expect(screen.getByText(/Badges — gestion/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Enregistrer" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("exige une confirmation explicite pour un rôle système", async () => {
    const { onConfirm, user } = setup(role({ isSystem: true }), { description: "Nouveau texte" });
    const save = screen.getByRole("button", { name: "Enregistrer" });
    expect(save).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    expect(save).toBeEnabled();
    await user.click(save);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("exige une confirmation explicite quand le MFA est retiré", () => {
    setup(role({ mfaRequired: true }), { mfaRequired: false });
    expect(screen.getByRole("button", { name: "Enregistrer" })).toBeDisabled();
    expect(screen.getByText("MFA : exigée → non exigée")).toBeInTheDocument();
  });
});
