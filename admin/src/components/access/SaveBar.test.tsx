import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SaveBar from "./SaveBar";

describe("SaveBar", () => {
  it("ne s'affiche pas sans modification", () => {
    const { container } = render(<SaveBar count={0} onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("annonce le nombre de modifications et déclenche enregistrer / annuler", async () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<SaveBar count={3} onSave={onSave} onCancel={onCancel} />);
    expect(screen.getByRole("status")).toHaveTextContent("3 modifications non enregistrées");
    await user.click(screen.getByRole("button", { name: /Enregistrer/ }));
    await user.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("désactive les boutons pendant l'envoi", () => {
    render(<SaveBar count={1} busy onSave={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Enregistrer/ })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("1 modification non enregistrée");
  });
});
