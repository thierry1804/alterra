import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import InlineText from "./InlineText";

function setup(props: Partial<React.ComponentProps<typeof InlineText>> = {}) {
  const onCommit = vi.fn();
  render(
    <InlineText value="Finance" label="Nom du rôle" onCommit={onCommit} minLength={2} {...props} />,
  );
  return { onCommit, user: userEvent.setup() };
}

describe("InlineText", () => {
  it("valide avec Entrée", async () => {
    const { onCommit, user } = setup();
    await user.click(screen.getByRole("button", { name: /Nom du rôle/ }));
    const input = screen.getByRole("textbox", { name: "Nom du rôle" });
    await user.clear(input);
    await user.type(input, "Comptabilité{Enter}");
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("Comptabilité");
  });

  it("annule avec Échap sans rien envoyer", async () => {
    const { onCommit, user } = setup();
    await user.click(screen.getByRole("button", { name: /Nom du rôle/ }));
    await user.type(screen.getByRole("textbox"), "xx{Escape}");
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Finance/ })).toBeInTheDocument();
  });

  it("n'envoie rien si la valeur est inchangée ou trop courte", async () => {
    const { onCommit, user } = setup();
    await user.click(screen.getByRole("button", { name: /Nom du rôle/ }));
    await user.keyboard("{Enter}");
    await user.click(screen.getByRole("button", { name: /Nom du rôle/ }));
    await user.clear(screen.getByRole("textbox"));
    await user.type(screen.getByRole("textbox"), "A{Enter}");
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("valide à la perte de focus et accepte le vide si autorisé", async () => {
    const { onCommit, user } = setup({ value: "Texte", allowEmpty: true });
    await user.click(screen.getByRole("button", { name: /Nom du rôle/ }));
    await user.clear(screen.getByRole("textbox"));
    await user.tab();
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("");
  });
});
