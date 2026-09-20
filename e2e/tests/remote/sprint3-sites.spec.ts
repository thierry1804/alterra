import { test, expect } from "./support/fixtures.js";
import { E2E_PREFIX } from "./support/env.js";
import { expectAudit, expectStatus } from "./support/helpers.js";
import { randomLetters, track } from "./support/state.js";
import { countRequests, expectToast, findRow, heading, waitTableReady } from "./support/ui.js";
import type { ApiClient } from "./support/api.js";

const UC = "UC-FE-ADM-SITES";

async function freeSiteCode(admin: ApiClient): Promise<string> {
  const sites = await admin.get("/sites");
  const used = new Set((sites.body.data as any[]).map((s) => s.shortCode));
  for (let i = 0; i < 50; i++) {
    const code = randomLetters(3);
    if (!used.has(code)) return code;
  }
  throw new Error("Aucun code site libre");
}

test.describe(`${UC} (parcours CRUD)`, () => {
  test.describe.configure({ mode: "serial" });
  const created: { id?: string; name?: string; code?: string } = {};

  test(`${UC} › liste paginée, cohérente avec la réponse API (lecture seule)`, async ({ openAdmin }) => {
    const page = await openAdmin("admin");
    const [resp] = await Promise.all([
      page.waitForResponse((r) => /\/api\/v1\/sites$/.test(r.url()) && r.request().method() === "GET"),
      page.goto("/sites"),
    ]);
    expect(resp.status()).toBe(200);
    const sites = (await resp.json()).data as any[];
    await expect(heading(page, "Sites")).toBeVisible();
    await waitTableReady(page);
    await expect(page.locator("tbody tr")).toHaveCount(Math.min(10, sites.length));
    if (sites.length > 10) {
      await page.getByRole("button", { name: "Suivant" }).click();
      await expect(page.getByText(/Page 2 \//)).toBeVisible();
      await expect(page.locator("tbody tr")).toHaveCount(Math.min(10, sites.length - 10));
    }
  });

  test(`${UC} › création via le formulaire (écriture E2E-S3-)`, async ({ openAdmin, admin, world }) => {
    const page = await openAdmin("admin");
    await page.goto("/sites");
    await waitTableReady(page);
    created.name = `${E2E_PREFIX}UI-${world.runId}`;
    created.code = await freeSiteCode(admin);

    await page.getByRole("button", { name: "Nouveau site" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#site-name").fill(created.name);
    await dialog.locator("#site-code").fill(created.code);
    await dialog.locator("#site-location").fill("E2E-S3 lieu initial");
    const [resp] = await Promise.all([
      page.waitForResponse((r) => /\/api\/v1\/sites$/.test(r.url()) && r.request().method() === "POST"),
      dialog.getByRole("button", { name: "Enregistrer" }).click(),
    ]);
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    created.id = body.id;
    track("site", body.id, created.name);
    await expectToast(page, "Site créé");
    const row = await findRow(page, created.name);
    await expect(row).toContainText(created.code);
    await expect(row).toContainText("Actif");
    await expectAudit(admin, { entityType: "Site", entityId: body.id, action: "CREATE" });
  });

  test(`${UC} › validations du formulaire (UI + API)`, async ({ openAdmin, admin, world }) => {
    const page = await openAdmin("admin");
    await page.goto("/sites");
    await waitTableReady(page);
    const posts = countRequests(page, (u, m) => /\/api\/v1\/sites$/.test(u) && m === "POST");

    await page.getByRole("button", { name: "Nouveau site" }).click();
    const dialog = page.getByRole("dialog");
    // Champs obligatoires
    await dialog.getByRole("button", { name: "Enregistrer" }).click();
    expect(await dialog.locator("#site-name").evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
    // Code invalide (chiffre) : bloqué côté navigateur, aucune requête envoyée
    await dialog.locator("#site-name").fill(`${E2E_PREFIX}VALID-${world.runId}`);
    await dialog.locator("#site-code").fill("AB1");
    await dialog.getByRole("button", { name: "Enregistrer" }).click();
    expect(await dialog.locator("#site-code").evaluate((el: HTMLInputElement) => el.validity.patternMismatch)).toBe(true);
    await expect(dialog).toBeVisible();
    expect(posts.count()).toBe(0);
    await dialog.getByRole("button", { name: "Annuler" }).click();

    // Validation serveur (contournement de l'UI) : code invalide => 4xx ; doublon de code => 409
    const invalid = await admin.post("/sites", { name: `${E2E_PREFIX}INVALID-${world.runId}`, shortCode: "ab1" });
    expectStatus(invalid, 400, 422);
    const duplicate = await admin.post("/sites", { name: `${E2E_PREFIX}DUP-${world.runId}`, shortCode: world.site.code });
    expectStatus(duplicate, 409);
    expect(duplicate.body.code).toBe("DUPLICATE");
  });

  test(`${UC} › édition : le code est immuable, la localisation modifiable`, async ({ openAdmin, admin }) => {
    test.skip(!created.id, "site UI non créé");
    const page = await openAdmin("admin");
    await page.goto("/sites");
    const row = await findRow(page, created.name!);
    await row.getByRole("button", { name: "Modifier" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Modifier le site")).toBeVisible();
    await expect(dialog.locator("#site-code")).toBeDisabled();
    await dialog.locator("#site-location").fill("E2E-S3 lieu modifié");
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/api/v1/sites/${created.id}`) && r.request().method() === "PATCH"),
      dialog.getByRole("button", { name: "Enregistrer" }).click(),
    ]);
    expect(resp.status()).toBe(200);
    await expectToast(page, "Site mis à jour");
    await expect(await findRow(page, created.name!)).toContainText("E2E-S3 lieu modifié");
    const audit = await expectAudit(admin, { entityType: "Site", entityId: created.id!, action: "UPDATE" });
    const upd = audit.find((a) => a.action === "UPDATE");
    expect(JSON.stringify(upd?.before)).toContain("lieu initial");
    expect(JSON.stringify(upd?.after)).toContain("lieu modifié");
  });

  test(`${UC} › désactivation`, async ({ openAdmin, admin }) => {
    test.skip(!created.id, "site UI non créé");
    const page = await openAdmin("admin");
    await page.goto("/sites");
    const row = await findRow(page, created.name!);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/api/v1/sites/${created.id}`) && r.request().method() === "DELETE"),
      row.getByRole("button", { name: "Désactiver" }).click(),
    ]);
    expect(resp.status()).toBe(200);
    await expectToast(page, "Site désactivé");
    await expect(await findRow(page, created.name!)).toContainText("Inactif");
    await expectAudit(admin, { entityType: "Site", entityId: created.id!, action: "DEACTIVATE" });
    const api = await admin.get(`/sites/${created.id}`);
    expect(api.body.active).toBe(false);
  });
});

test.describe(`${UC} (états vide et erreur)`, () => {
  test(`${UC} › état vide : message explicite attendu`, async ({ openAdmin }) => {
    const page = await openAdmin("admin");
    await page.route("**/api/v1/sites", (route) => route.fulfill({ status: 200, json: { data: [] } }));
    await page.goto("/sites");
    await expect(heading(page, "Sites")).toBeVisible();
    await expect.soft(page.getByText(/aucun site/i), "Aucun message d'état vide sur l'écran Sites").toBeVisible();
  });

  test(`${UC} › état d'erreur : message explicite attendu`, async ({ openAdmin }) => {
    const page = await openAdmin("admin");
    await page.route("**/api/v1/sites", (route) =>
      route.fulfill({ status: 500, json: { code: "INTERNAL_ERROR", message: "Unexpected server error" } }),
    );
    await page.goto("/sites");
    await expect(heading(page, "Sites")).toBeVisible();
    await expect
      .soft(page.getByText(/erreur|échec|impossible|réessayer/i), "Aucun message d'erreur sur l'écran Sites si l'API échoue")
      .toBeVisible();
  });
});
