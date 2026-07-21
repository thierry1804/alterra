import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { loginPwa, unlockPwaIfNeeded } from "../helpers/auth.js";
import { CDS_EMAIL, PIN, SEED_WORKER_ID, USER_PASSWORD } from "../helpers/env.js";

const samplePhoto = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/sample-photo.png",
);

test.describe("CDS — biométrie offline", () => {
  test("charge le contrôle bio et gère la capture hors ligne", async ({ page, context }) => {
    await loginPwa(page, CDS_EMAIL, USER_PASSWORD, PIN);

    await expect(page.getByRole("heading", { name: "Validation hebdomadaire" })).toBeVisible({
      timeout: 20_000,
    });

    await page.goto(`/validation/bio/${SEED_WORKER_ID}`);
    await unlockPwaIfNeeded(page, PIN);
    await expect(page.getByText("Contrôle biométrique")).toBeVisible();
    await expect(page.getByRole("button", { name: "Capturer et analyser" })).toBeVisible();

    await context.setOffline(true);

    await page.locator('input[type="file"]').setInputFiles(samplePhoto);
    await expect(
      page.getByText(/Hors ligne|visage non détecté|Analyse en cours|Bio/i).first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
