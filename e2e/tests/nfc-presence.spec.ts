import { expect, test } from "@playwright/test";
import { loginPwa } from "../helpers/auth.js";
import { CDE_EMAIL, PIN, USER_PASSWORD } from "../helpers/env.js";

test.describe("CDE — présence NFC (mode manuel)", () => {
  test("enregistre une présence via le mode dégradé", async ({ page }) => {
    await loginPwa(page, CDE_EMAIL, USER_PASSWORD, PIN);

    await expect(page.getByRole("heading", { name: "Activité du jour" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("link", { name: "Présence" }).click();
    await expect(page.getByRole("heading", { name: "Présence · Matin" })).toBeVisible();

    const workerSelect = page.locator("select").first();
    await expect(workerSelect).toBeVisible({ timeout: 20_000 });
    const options = workerSelect.locator("option");
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(1);

    await workerSelect.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Enregistrer présence manuelle" }).click();

    await expect(page.getByText(/enregistré\(e\) \(mode manuel\)/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("heading", { name: "Journal du jour" })).toBeVisible();
    await expect(page.getByText(/· manuel/)).toBeVisible();
  });
});
