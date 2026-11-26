import { expect, test } from "@playwright/test";
import { loginPwa } from "../helpers/auth.js";
import { CDS_EMAIL, SEED_WORKER_ID, USER_PASSWORD } from "../helpers/env.js";

test.describe("CDS — contrôle biométrique via le pont", () => {
  test("ouvre directement le pont sans écran caméra", async ({ page }) => {
    await loginPwa(page, CDS_EMAIL, USER_PASSWORD);

    await expect(page.getByRole("heading", { name: "Validation hebdomadaire" })).toBeVisible({
      timeout: 20_000,
    });

    const sessionRequest = page.waitForRequest(
      (request) => request.method() === "POST" && request.url().endsWith("/biometric/sessions"),
    );

    await page.goto(`/validation/bio/${SEED_WORKER_ID}`);
    await expect(page.getByText("Contrôle biométrique")).toBeVisible();
    await sessionRequest;

    await expect(page.getByText("Vérification en cours dans le moteur biométrique…")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: "Rouvrir" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Capturer et analyser" })).toHaveCount(0);
    await expect(page.locator('input[type="file"]')).toHaveCount(0);
  });
});
