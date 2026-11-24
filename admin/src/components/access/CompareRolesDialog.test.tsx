import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { AccessRole, PermissionGroup } from "../../lib/access";
import CompareRolesDialog from "./CompareRolesDialog";

function group(id: string, name: string): PermissionGroup {
  return { id, name, description: null, isSystem: true, permissions: [], roleCount: 0 };
}
const groups = [
  group("g1", "Badges — gestion"),
  group("g2", "Pointages — lecture"),
  group("g3", "Pointages — correction"),
];

function role(
  id: string,
  name: string,
  groupIds: string[],
  overrides: Partial<AccessRole> = {},
): AccessRole {
  return {
    id,
    name,
    description: null,
    isSystem: false,
    scope: "SITE",
    mfaRequired: false,
    groupIds,
    permissions: [],
    userCount: 2,
    version: "v1",
    ...overrides,
  };
}

const roles = [
  role("a", "Chef de service", ["g1", "g2"]),
  role("b", "Finance", ["g2", "g3"], { scope: "TOUS", mfaRequired: true }),
  role("c", "Consultation", ["g2"]),
];

function setup(initialLeftId: string | null = "a") {
  render(
    <CompareRolesDialog
      open
      onOpenChange={() => {}}
      roles={roles}
      groups={groups}
      resources={[]}
      initialLeftId={initialLeftId}
    />,
  );
  return userEvent.setup();
}

describe("CompareRolesDialog", () => {
  it("compare le rôle choisi avec le suivant et résume les écarts", () => {
    setup("a");
    expect(screen.getByRole("combobox", { name: "Premier rôle" })).toHaveValue("a");
    expect(screen.getByRole("combobox", { name: "Second rôle" })).toHaveValue("b");
    expect(
      screen.getByText(/1 en commun · 1 seulement dans Chef de service · 1 seulement dans Finance/),
    ).toBeInTheDocument();
    expect(screen.getByText("Tous les sites")).toBeInTheDocument();
    expect(screen.getByText("Exigée")).toBeInTheDocument();
  });

  it("indique, groupe par groupe, qui a quoi", () => {
    setup("a");
    expect(
      screen.getByRole("img", { name: "Chef de service : Badges — gestion : oui" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Finance : Badges — gestion : non" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Finance : Pointages — correction : oui" }),
    ).toBeInTheDocument();
  });

  it("ne garde que les différences à la demande", async () => {
    const user = setup("a");
    await user.click(screen.getByRole("checkbox", { name: "Différences seulement" }));
    const table = screen.getByRole("table");
    expect(within(table).queryByRole("rowheader", { name: "Lecture" })).not.toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "Gestion" })).toBeInTheDocument();
  });

  it("change de rôle comparé et empêche de se comparer à soi-même", async () => {
    const user = setup("a");
    await user.selectOptions(screen.getByRole("combobox", { name: "Second rôle" }), "c");
    expect(screen.getByText(/seulement dans Consultation/)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Chef de service", selected: false })).toBeDisabled();
  });

  it("prévient quand deux rôles ont les mêmes groupes", async () => {
    const same = [role("x", "X", ["g1"]), role("y", "Y", ["g1"])];
    render(
      <CompareRolesDialog
        open
        onOpenChange={() => {}}
        roles={same}
        groups={groups}
        resources={[]}
        initialLeftId="x"
      />,
    );
    await userEvent.click(screen.getByRole("checkbox", { name: "Différences seulement" }));
    expect(
      screen.getByText("Ces deux rôles ont exactement les mêmes groupes."),
    ).toBeInTheDocument();
  });
});
