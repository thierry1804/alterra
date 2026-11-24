import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AccessRole, PermissionGroup, PermissionResource } from "../../lib/access";
import GroupSheet from "./GroupSheet";

const resources: PermissionResource[] = [
  {
    resource: "pointage",
    label: "Pointages",
    actions: [
      { action: "lecture", label: "Voir les pointages" },
      { action: "valider_site", label: "Valider ou rejeter" },
    ],
  },
  {
    resource: "badge",
    label: "Badges",
    actions: [{ action: "lecture", label: "Voir les badges" }],
  },
];
const held = new Set(["pointage:lecture", "badge:lecture"]);

const existing: PermissionGroup = {
  id: "g1",
  name: "Badges — gestion",
  description: "Gère les badges",
  isSystem: false,
  permissions: ["badge:lecture"],
  roleCount: 2,
};
const roles = [
  { id: "r1", name: "Chef de service", groupIds: ["g1"], userCount: 6 },
  { id: "r2", name: "Finance", groupIds: ["g1"], userCount: 2 },
] as AccessRole[];

function setup(
  group: PermissionGroup | null = null,
  props: Partial<React.ComponentProps<typeof GroupSheet>> = {},
) {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(
    <GroupSheet
      group={group}
      groups={[existing]}
      roles={roles}
      resources={resources}
      held={held}
      saving={false}
      error={null}
      onSubmit={onSubmit}
      onClose={onClose}
      {...props}
    />,
  );
  return { onSubmit, onClose, user: userEvent.setup() };
}

describe("GroupSheet", () => {
  it("crée un groupe : bouton actif seulement avec un nom valide, puis envoie les valeurs", async () => {
    const { onSubmit, user } = setup();
    const submit = screen.getByRole("button", { name: "Créer le groupe" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Nom"), "Rapports — lecture");
    await user.click(screen.getByRole("button", { name: /Pointages/ }));
    await user.click(screen.getByRole("checkbox", { name: "Voir les pointages" }));
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(onSubmit).toHaveBeenCalledWith({
      name: "Rapports — lecture",
      description: "",
      permissions: new Set(["pointage:lecture"]),
    });
  });

  it("signale un nom déjà pris", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("Nom"), "badges — gestion");
    await user.tab();
    expect(screen.getByText("Ce nom est déjà utilisé.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Créer le groupe" })).toBeDisabled();
  });

  it("« Tout sélectionner » n'accorde que les droits que l'acteur détient", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("checkbox", { name: "Tout sélectionner : Pointages" }));
    // La ressource s'ouvre d'elle-même dès qu'une de ses permissions est cochée.
    expect(screen.getByRole("checkbox", { name: "Voir les pointages" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Valider ou rejeter" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Valider ou rejeter" })).toBeDisabled();
  });

  it("filtre les permissions par recherche", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("searchbox", { name: "Rechercher une permission" }), "badges");
    expect(screen.getByRole("checkbox", { name: "Voir les badges" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Voir les pointages" })).not.toBeInTheDocument();
  });

  it("annonce les rôles et utilisateurs concernés en modification, et n'active Enregistrer qu'après un changement", async () => {
    const { onSubmit, user } = setup(existing);
    expect(screen.getByText("Utilisé par 2 rôles · 8 utilisateurs concernés")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Enregistrer" });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText("Description"), " et plus");
    expect(save).toBeEnabled();
    await user.click(save);
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it("demande confirmation avant d'abandonner des modifications, pas sinon", async () => {
    const first = setup(existing);
    await first.user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(first.onClose).toHaveBeenCalledOnce();
  });

  it("abandonne seulement après confirmation quand le formulaire est modifié", async () => {
    const { onClose, user } = setup(existing);
    await user.type(screen.getByLabelText("Nom"), "x");
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onClose).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("dialog", { name: "Abandonner les modifications ?" });
    await user.click(within(dialog).getByRole("button", { name: "Abandonner" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("affiche l'erreur du serveur dans le panneau", () => {
    setup(existing, { error: "Ce nom est déjà utilisé" });
    expect(screen.getByRole("alert")).toHaveTextContent("Ce nom est déjà utilisé");
  });
});
