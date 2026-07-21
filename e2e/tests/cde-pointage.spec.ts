import { expect, test } from "@playwright/test";
import { loginPwa } from "../helpers/auth.js";
import { CDE_EMAIL, PIN, USER_PASSWORD } from "../helpers/env.js";

test.describe("CDE — saisie lot et sync", () => {
  test("sélection activité, saisie lot et page sync", async ({ page }) => {
    await loginPwa(page, CDE_EMAIL, USER_PASSWORD, PIN);

    await expect(page.getByRole("heading", { name: "Activité du jour" })).toBeVisible({
      timeout: 20_000,
    });

    const firstActivity = page.locator("button").filter({ hasText: /trou|plant|Ar/i }).first();
    await expect(firstActivity).toBeVisible({ timeout: 20_000 });
    await firstActivity.click();

    await page.getByRole("button", { name: "Continuer vers la saisie lot" }).click();
    await expect(page.getByRole("heading", { name: "Saisie lot" })).toBeVisible();

    await page.getByRole("button", { name: /Appliquer quantité par défaut/ }).click();

    const quantityInput = page.locator('input[type="number"]').first();
    await expect(quantityInput).toBeVisible();
    await quantityInput.fill("2");

    await page.getByRole("button", { name: "Enregistrer le lot" }).click();

    await expect(page.getByRole("heading", { name: "Synchronisation" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /Forcer la synchronisation/ })).toBeVisible();
  });
});
