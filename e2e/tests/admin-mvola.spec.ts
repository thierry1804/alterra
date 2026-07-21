import { expect, test } from "@playwright/test";
import { loginAdmin } from "../helpers/auth.js";

test.describe("Admin — bordereau MVola", () => {
  test("affiche la page paiements et actions bordereau", async ({ page }) => {
    await loginAdmin(page);
    await page.getByRole("link", { name: "Paiements" }).click();

    await expect(page.getByRole("heading", { name: "Paiements" })).toBeVisible();
    await expect(page.getByLabel("Période (ISO semaine)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Générer bordereau" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Import retour MVola" })).toBeVisible();
    await expect(page.getByText("Exportables (bio OK)")).toBeVisible();
  });
});
