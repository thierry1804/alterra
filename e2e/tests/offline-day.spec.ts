import { expect, test } from "@playwright/test";
import { loginPwa } from "../helpers/auth.js";
import { CDE_EMAIL, PIN, USER_PASSWORD } from "../helpers/env.js";

test.describe("CDE — journée offline simulée", () => {
  test("enregistre un pointage hors ligne puis affiche le statut sync", async ({ page, context }) => {
    await loginPwa(page, CDE_EMAIL, USER_PASSWORD, PIN);

    await expect(page.getByRole("heading", { name: "Activité du jour" })).toBeVisible({
      timeout: 20_000,
    });

    const firstActivity = page.locator("button").filter({ hasText: /trou|plant|Ar/i }).first();
    await firstActivity.click();
    await page.getByRole("button", { name: "Continuer vers la saisie lot" }).click();

    await context.setOffline(true);

    await page.getByRole("button", { name: /Appliquer quantité par défaut/ }).click();
    await page.locator('input[type="number"]').first().fill("1");
    await page.getByRole("button", { name: "Enregistrer le lot" }).click();

    await expect(page.getByRole("heading", { name: "Synchronisation" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("main").getByText("Hors ligne", { exact: true })).toBeVisible();

    await context.setOffline(false);
    await page.getByRole("button", { name: /Forcer la synchronisation/ }).click();
    await expect(page.getByRole("main").getByText("En ligne", { exact: true })).toBeVisible({
      timeout: 20_000,
    });
  });
});
