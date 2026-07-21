import { expect, type Page } from "@playwright/test";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./env.js";

export async function loginAdmin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(ADMIN_EMAIL);
  await page.locator("#password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Tableau de bord" })).toBeVisible();
}

export async function loginPwa(
  page: Page,
  email: string,
  password: string,
  pin: string,
): Promise<void> {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await page.waitForURL(/\/(unlock|$)/, { timeout: 15_000 });

  if (page.url().includes("/unlock")) {
    const pinField = page.locator("#pin");
    await pinField.fill(pin);

    const confirmField = page.locator("#confirmPin");
    if (await confirmField.isVisible().catch(() => false)) {
      await confirmField.fill(pin);
    }

    await page.getByRole("button", { name: /Enregistrer|Déverrouiller/ }).click();
  }

  await page.waitForURL(/\/(validation|$|batch|sync)/, { timeout: 15_000 });
}
