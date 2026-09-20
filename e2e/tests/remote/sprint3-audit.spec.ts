import { test, expect } from "./support/fixtures.js";
import { expectStatus } from "./support/helpers.js";
import { today } from "./support/state.js";
import { heading } from "./support/ui.js";

const UC = "UC-FE-ADM-AUDIT";

test.describe(`${UC}`, () => {
  test(`${UC} › table paginée cohérente avec l'API, navigation Précédent/Suivant`, async ({ openAdmin }) => {
    const page = await openAdmin("admin");
    const [resp] = await Promise.all([
      page.waitForResponse((r) => /\/api\/v1\/audit-log\?/.test(r.url()) && r.request().method() === "GET"),
      page.goto("/audit"),
    ]);
    expect(resp.status()).toBe(200);
    const first = await resp.json();
    await expect(heading(page, "Journal d'audit")).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(first.data.length);
    await expect(page.getByText(`${first.total} entrée(s)`)).toBeVisible();
    await expect(page.getByText(/Page 1/)).toBeVisible();

    const next = page.getByRole("button", { name: "Suivant" });
    if (first.hasMore) {
      const [second] = await Promise.all([
        page.waitForResponse((r) => /\/api\/v1\/audit-log\?/.test(r.url()) && r.url().includes("page=2")),
        next.click(),
      ]);
      const secondBody = await second.json();
      expect(secondBody.data[0].id).not.toBe(first.data[0].id);
      await expect(page.getByText(/Page 2/)).toBeVisible();
      await page.getByRole("button", { name: "Précédent" }).click();
      await expect(page.getByText(/Page 1/)).toBeVisible();
    } else {
      await expect(next).toBeDisabled();
    }
  });

  test(`${UC} › filtres action, entité, période ; état vide ; réinitialisation`, async ({ openAdmin, admin, world }) => {
    // Garantit au moins une entrée « Site / UPDATE » d'aujourd'hui, propre au jeu E2E
    const upd = await admin.patch(`/sites/${world.site.id}`, { location: `E2E-S3 audit ${Date.now()}` });
    expectStatus(upd, 200);

    const page = await openAdmin("admin");
    await page.goto("/audit");
    await expect(heading(page, "Journal d'audit")).toBeVisible();
    await expect(page.locator("tbody tr").first()).toBeVisible();

    await page.locator("#audit-action").selectOption("UPDATE");
    await page.locator("#audit-entity").selectOption("Site");
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("entityType=Site") && r.url().includes("action=UPDATE") && r.url().includes(`dateFrom=`) === false),
      page.locator("#audit-from").fill(today()),
    ]).catch(async () => [await page.waitForResponse((r) => r.url().includes("entityType=Site"))] as const);
    void resp;
    await page.locator("#audit-to").fill(today());
    const rows = page.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    const texts = await rows.allInnerTexts();
    expect(texts.every((t) => t.includes("UPDATE") && t.includes("Site"))).toBe(true);
    await expect(page.locator("tbody").getByText(world.site.id)).toBeVisible(); // notre mise à jour, la plus récente

    // Détail : diff avant / après
    const ourRow = rows.filter({ hasText: world.site.id }).first();
    await ourRow.getByRole("button", { name: "Voir le détail" }).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer).toContainText("E2E-S3 audit");
    await expect(drawer).toContainText(/before|avant/i);
    await expect(drawer).toContainText(/after|après/i);
    await page.keyboard.press("Escape");

    // État vide : période dans le futur
    await page.locator("#audit-from").fill("2099-01-01");
    await page.locator("#audit-to").fill("2099-12-31");
    await expect(page.getByText("Aucune entrée pour ces filtres.")).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Réinitialiser" }).click();
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await expect(page.locator("#audit-action")).toHaveValue("");
  });

  test(`${UC} › le journal est en lecture seule (aucune route de modification)`, async ({ admin }) => {
    const list = await admin.get("/audit-log?limit=1");
    const id = list.body.data[0].id;
    for (const [method, res] of [
      ["PATCH", await admin.patch(`/audit-log/${id}`, { action: "X" })],
      ["DELETE", await admin.delete(`/audit-log/${id}`)],
      ["POST", await admin.post(`/audit-log`, { action: "X", entityType: "Site" })],
    ] as const) {
      expect(res.status, `${method} /audit-log ne doit pas être accepté`).toBeGreaterThanOrEqual(400);
    }
  });

  test(`${UC} › état d'erreur : message explicite attendu`, async ({ openAdmin }) => {
    const page = await openAdmin("admin");
    await page.route("**/api/v1/audit-log?**", (route) =>
      route.fulfill({ status: 500, json: { code: "INTERNAL_ERROR", message: "Unexpected server error" } }),
    );
    await page.goto("/audit");
    await expect(heading(page, "Journal d'audit")).toBeVisible();
    await expect
      .soft(page.getByText(/erreur|échec|impossible|réessayer/i), "Aucun message d'erreur sur l'écran Audit si l'API échoue")
      .toBeVisible();
  });
});
