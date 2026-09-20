import { test, expect } from "./support/fixtures.js";
import { E2E_PREFIX } from "./support/env.js";
import { createPointages, expectAudit, expectStatus } from "./support/helpers.js";
import { addDays, e2eName, persisted, randomDigits, randomLetters, stReset, today, track } from "./support/state.js";
import { heading } from "./support/ui.js";

const UC = "UC-FE-ADM-ACT";

test.describe(`${UC} (parcours CRUD + tarif versionné RG-04)`, () => {
  // Pas de mode « serial » : un constat (assertion souple) ne doit pas masquer les tests suivants.
  const st = persisted<{
    uiCategory?: { id: string; code: string; label: string };
    rate?: { oldId: string; newId: string; groupKey: string; label: string; pointageOldId?: string };
  }>("activities");

  test(`${UC} › liste des catégories, recherche et dépliage (lecture seule)`, async ({ openAdmin, world }) => {
    stReset("activities");
    const page = await openAdmin("admin");
    const [resp] = await Promise.all([
      page.waitForResponse((r) => /\/api\/v1\/activity-categories\?/.test(r.url()) && r.request().method() === "GET"),
      page.goto("/activities"),
    ]);
    expect(resp.status()).toBe(200);
    const initial = await resp.json();
    await expect(heading(page, "Activités")).toBeVisible();
    await expect(page.locator("tbody tr").first()).toBeVisible();
    expect(initial.data.length).toBeGreaterThan(0);

    // La recherche filtre catégories ET sous-activités par libellé : on cherche la sous-activité E2E (rattachée au site E2E).
    const searched = page.waitForResponse(
      (r) => /\/api\/v1\/activity-categories\?/.test(r.url()) && r.url().includes("q=") && r.request().method() === "GET",
    );
    await page.getByPlaceholder("Rechercher (code, libellé, sous-activité…)").fill(world.subActivity.label);
    const apiCategory = ((await (await searched).json()).data as any[]).find((c) => c.id === world.category.id);
    expect(apiCategory.subActivities.map((s: any) => s.id)).toContain(world.subActivity.id);
    const categoryRow = page.getByRole("row").filter({ hasText: e2eName(world.runId, "CAT") });
    await expect(categoryRow).toBeVisible();
    await expect(categoryRow).toContainText(world.category.code);
    // Le tableau des sous-activités est imbriqué dans la ligne de la catégorie : on vise la ligne la plus interne.
    const subRow = page.getByRole("row").filter({ hasText: world.subActivity.label }).last();
    await expect(subRow).toBeVisible();
    await expect(subRow).toContainText(world.site.code); // colonne Site
    await expect(subRow).toContainText(/1\D?000/); // tarif
  });

  test(`${UC} › création d'une catégorie via le formulaire + validations`, async ({ openAdmin, admin, world }) => {
    const page = await openAdmin("admin");
    await page.goto("/activities");
    await expect(page.locator("tbody tr").first()).toBeVisible();
    const code = `E2ES3${randomLetters(3)}${randomDigits(3)}`;
    const label = `${E2E_PREFIX}UI-CAT-${world.runId}-${code.slice(-3)}`;

    await page.getByRole("button", { name: "Nouvelle catégorie" }).click();
    const dialog = page.getByRole("dialog");
    // Champ obligatoire
    await dialog.getByRole("button", { name: "Enregistrer" }).click();
    expect(await dialog.locator("#cat-code").evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
    await dialog.locator("#cat-code").fill(code);
    await dialog.locator("#cat-label").fill(label);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => /\/api\/v1\/activity-categories$/.test(r.url()) && r.request().method() === "POST"),
      dialog.getByRole("button", { name: "Enregistrer" }).click(),
    ]);
    expect(resp.status()).toBe(201);
    const created = await resp.json();
    track("category", created.id, label);
    st.uiCategory = { id: created.id, code: created.code, label };
    await expectAudit(admin, { entityType: "ActivityCategory", entityId: created.id, action: "CREATE" });

    // Code déjà utilisé => 409
    const dup = await admin.post("/activity-categories", { code, label: `${E2E_PREFIX}DUP-${world.runId}` });
    expectStatus(dup, 409);
    expect(dup.body.code).toBe("CATEGORY_CODE_TAKEN");
    // Libellé manquant => 4xx
    const missing = await admin.post("/activity-categories", { code: `E2ES3X${randomDigits(5)}` });
    expectStatus(missing, 400, 422);
  });

  test(`${UC} › changement de tarif : version fermée + nouvelle version (RG-04), historique visible`, async ({
    openAdmin,
    admin,
    apiOf,
    world,
  }) => {
    test.setTimeout(180_000);
    const cde = await apiOf("e2e_cde");
    const label = e2eName(world.runId, "RATE");

    // Sous-activité rattachée au site E2E (invisible des sites réels), en vigueur depuis le passé :
    // le changement de tarif suit le scénario RG-04 standard (ancienne version close hier, nouvelle ouverte aujourd'hui).
    const sub = await admin.post("/sub-activities", {
      categoryId: world.category.id,
      label,
      shortLabel: "Tarif",
      unitId: world.unitId,
      unitRate: 1000,
      siteId: world.site.id,
      validFrom: "2026-01-01",
    });
    expectStatus(sub, 201);
    track("subActivity", sub.body.id, label);
    const oldId = sub.body.id as string;
    const groupKey = sub.body.groupKey as string;
    let currentId = oldId;
    try {

    // Pointage AVANT le changement de tarif : quantité 2 => 2 000 Ar au tarif 1 000.
    const before = await createPointages(cde, world, [
      { workerId: world.workers[0].id, quantity: 2, date: today(), subActivityId: oldId },
    ]);
    expect(before.results[0].status).toBe("created");
    const pointageOldId = before.results[0].id!;

    // Changement de tarif
    const changed = await admin.patch(`/sub-activities/${oldId}`, { unitRate: 1500 });
    expectStatus(changed, 200);
    const newId = changed.body.id as string;
    currentId = newId;
    track("subActivity", newId, label);
    expect(newId, "une nouvelle version doit être créée").not.toBe(oldId);
    expect(changed.body.groupKey).toBe(groupKey);
    expect(Number(changed.body.unitRate)).toBe(1500);
    expect(changed.body.validTo).toBeNull();

    const oldRow = await admin.get(`/sub-activities/${oldId}`);
    expectStatus(oldRow, 200);
    expect(oldRow.body.validTo, "l'ancienne version doit être clôturée").not.toBeNull();
    expect(Number(oldRow.body.unitRate)).toBe(1000);

    // Dates RG-04 : ancienne version close la veille, nouvelle ouverte le jour du changement.
    expect(String(oldRow.body.validTo).slice(0, 10)).toBe(addDays(today(), -1));
    expect(String(changed.body.validFrom).slice(0, 10)).toBe(today());

    const history = await admin.get(`/sub-activities?groupKey=${groupKey}&siteId=${world.site.id}&history=true&take=100`);
    expectStatus(history, 200);
    expect((history.body.data as any[]).length).toBe(2);

    // Même tarif => pas de nouvelle version
    const same = await admin.patch(`/sub-activities/${newId}`, { unitRate: 1500 });
    expectStatus(same, 200);
    const historyAgain = await admin.get(`/sub-activities?groupKey=${groupKey}&siteId=${world.site.id}&history=true&take=100`);
    expect((historyAgain.body.data as any[]).length).toBe(2);

    // Aucun impact sur le pointage passé ; le nouveau pointage prend le nouveau tarif.
    const pts = await admin.get(`/pointages?workerId=${world.workers[0].id}`);
    const past = (pts.body.data as any[]).find((p) => p.id === pointageOldId);
    expect(Number(past.unitRateSnapshot)).toBe(1000);
    expect(Number(past.amount)).toBe(2000);
    const after = await createPointages(cde, world, [
      { workerId: world.workers[0].id, quantity: 2, date: addDays(today(), -1), subActivityId: newId },
    ]);
    const ptsAfter = await admin.get(`/pointages?workerId=${world.workers[0].id}`);
    const fresh = (ptsAfter.body.data as any[]).find((p) => p.id === after.results[0].id);
    expect(Number(fresh.unitRateSnapshot)).toBe(1500);
    expect(Number(fresh.amount)).toBe(3000);
    const pastAgain = (ptsAfter.body.data as any[]).find((p) => p.id === pointageOldId);
    expect(Number(pastAgain.amount), "le pointage passé ne doit pas être recalculé").toBe(2000);

    // Audit RATE_CHANGE
    const audit = await expectAudit(admin, { entityType: "ActivitySubActivity", entityId: newId, action: "RATE_CHANGE" });
    expect(JSON.stringify(audit.find((a) => a.action === "RATE_CHANGE")?.after)).toContain("1500");

    st.rate = { oldId, newId, groupKey, label, pointageOldId };

    // UI : le tiroir d'historique montre les deux versions
    const page = await openAdmin("admin");
    await page.goto("/activities");
    await page.getByPlaceholder("Rechercher (code, libellé, sous-activité…)").fill(label);
    const row = page.getByRole("row").filter({ hasText: label });
    await expect(row.first()).toBeVisible();
    await row.first().getByRole("button", { name: "Historique des tarifs" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText(`Historique tarifs — ${label}`)).toBeVisible();
    await expect(dialog.getByRole("row")).toHaveCount(3); // en-tête + 2 versions
    await expect(dialog).toContainText("Clôturé");
    await expect(dialog).toContainText("Courant");
    await expect(dialog).toContainText("en cours");
    await expect(dialog).toContainText(/1\D?000/);
    await expect(dialog).toContainText(/1\D?500/);
    } finally {
      await admin.delete(`/sub-activities/${currentId}`);
    }
  });

  test(`${UC} › validations du tarif`, async ({ admin, world }) => {
    test.skip(!st.rate, "sous-activité de test non créée");
    for (const bad of [0, -5]) {
      const res = await admin.patch(`/sub-activities/${st.rate!.newId}`, { unitRate: bad });
      expectStatus(res, 400, 422);
    }
    const noLabel = await admin.post("/sub-activities", {
      categoryId: world.category.id,
      shortLabel: "X",
      unitId: world.unitId,
      unitRate: 1000,
    });
    expectStatus(noLabel, 400, 422);
  });

  test(`${UC} › désactivation de la sous-activité et de la catégorie`, async ({ admin }) => {
    test.skip(!st.rate, "sous-activité de test non créée");
    const res = await admin.delete(`/sub-activities/${st.rate!.newId}`);
    expectStatus(res, 200);
    expect(res.body.active).toBe(false);
    await expectAudit(admin, { entityType: "ActivitySubActivity", entityId: st.rate!.newId, action: "DEACTIVATE" });
    if (st.uiCategory) {
      const cat = await admin.delete(`/activity-categories/${st.uiCategory.id}`);
      expectStatus(cat, 200);
      await expectAudit(admin, { entityType: "ActivityCategory", entityId: st.uiCategory.id });
    }
  });
});

test.describe(`${UC} (états vide et erreur)`, () => {
  test(`${UC} › état vide`, async ({ openAdmin }) => {
    const page = await openAdmin("admin");
    await page.route("**/api/v1/activity-categories?**", (route) =>
      route.fulfill({ status: 200, json: { data: [], nextCursor: null, hasMore: false } }),
    );
    await page.goto("/activities");
    await expect(heading(page, "Activités")).toBeVisible();
    await expect(page.getByText("Aucune catégorie.")).toBeVisible();
  });

  test(`${UC} › état d'erreur : message explicite attendu`, async ({ openAdmin }) => {
    const page = await openAdmin("admin");
    await page.route("**/api/v1/activity-categories?**", (route) =>
      route.fulfill({ status: 500, json: { code: "INTERNAL_ERROR", message: "Unexpected server error" } }),
    );
    await page.goto("/activities");
    await expect(heading(page, "Activités")).toBeVisible();
    await expect
      .soft(
        page.getByText(/erreur|échec|impossible|réessayer/i),
        "Aucun message d'erreur sur l'écran Activités si l'API échoue (l'écran affiche « Aucune catégorie. »)",
      )
      .toBeVisible();
  });
});
