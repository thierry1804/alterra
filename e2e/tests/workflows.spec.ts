import { expect, test } from "@playwright/test";
import { loginAdmin, loginPwa } from "../helpers/auth.js";
import {
  ADMIN_URL,
  CDS_EMAIL,
  PIN,
  USER_PASSWORD,
} from "../helpers/env.js";

test.describe("Workflows V2 — demandes terrain", () => {
  test("CDS soumet une demande activité visible côté Admin", async ({ page, browser }) => {
    const label = `Activité E2E ${Date.now()}`;

    await loginPwa(page, CDS_EMAIL, USER_PASSWORD, PIN);
    await page.getByRole("link", { name: "Activités" }).click();
    await expect(page.getByRole("heading", { name: "Demande d'activité" })).toBeVisible();

    await page.locator("#act-label").fill(label);
    await page.locator("#act-unit").fill("plant");
    await page.locator("#act-rate").fill("150");
    await page.locator("#act-justification").fill("Couverture E2E des workflows terrain V2.");
    await page.getByRole("button", { name: "Envoyer à l'administrateur" }).click();

    await expect(page.getByText("Demande envoyée à l'administrateur.")).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(label)).toBeVisible();

    const adminContext = await browser.newContext({ baseURL: ADMIN_URL });
    const adminPage = await adminContext.newPage();
    await loginAdmin(adminPage);

    await adminPage.getByRole("link", { name: "Demandes" }).click();
    await expect(adminPage.getByRole("heading", { name: "Demandes terrain" })).toBeVisible();
    await expect(adminPage.getByText(label)).toBeVisible({ timeout: 15_000 });
    await adminPage.getByRole("button", { name: "Détail" }).first().click();
    await expect(adminPage.getByText("Demande d'activité")).toBeVisible();

    await adminContext.close();
  });
});
