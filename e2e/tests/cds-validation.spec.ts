import { expect, test } from "@playwright/test";
import { loginPwa } from "../helpers/auth.js";
import { CDS_EMAIL, PIN, USER_PASSWORD } from "../helpers/env.js";

test.describe("CDS — validation hebdomadaire", () => {
  test("affiche l'écran validation après connexion", async ({ page }) => {
    await loginPwa(page, CDS_EMAIL, USER_PASSWORD, PIN);

    await expect(page.getByRole("heading", { name: "Validation hebdomadaire" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: "Actualiser" })).toBeVisible();
  });
});
