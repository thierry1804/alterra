import { test, expect } from "./support/fixtures.js";
import { createPointages, expectAudit, expectStatus } from "./support/helpers.js";
import { addDays, newUuid, today } from "./support/state.js";
import { countRequests, expectToast, heading, waitTableReady } from "./support/ui.js";

const UC = "UC-FE-ADM-PNT";

test.describe(`${UC} (consultation réelle, lecture seule)`, () => {
  test(`${UC} › liste, requêtes réseau et filtres cohérents avec l'API`, async ({ openAdmin, admin }, testInfo) => {
    const page = await openAdmin("admin");
    const workerCalls = countRequests(page, (u, m) => /\/api\/v1\/workers\/[0-9a-f-]{36}$/.test(u) && m === "GET");
    const [resp] = await Promise.all([
      page.waitForResponse((r) => /\/api\/v1\/pointages(\?|$)/.test(r.url()) && r.request().method() === "GET"),
      page.goto("/pointages"),
    ]);
    expect(resp.status()).toBe(200);
    const first = await resp.json();
    await expect(heading(page, "Pointages")).toBeVisible();
    if (first.data.length > 0) {
      await waitTableReady(page);
      await expect(page.locator("tbody tr")).toHaveCount(first.data.length);
    }
    await page.waitForTimeout(2000); // laisse partir les requêtes /workers/:id
    testInfo.annotations.push({
      type: "performance",
      description: `${first.data.length} pointages affichés → ${workerCalls.count()} requêtes GET /workers/:id (une par MOC distinct, N+1)`,
    });

    // Filtre statut : toutes les lignes affichées portent le statut choisi, et le nombre correspond à l'API
    const validated = await admin.getAllCursor<any>("/pointages?status=VALIDATED");
    await page.getByLabel("Filtrer par statut").selectOption("VALIDATED");
    if (validated.length > 0) {
      await expect(page.locator("tbody tr")).toHaveCount(Math.min(validated.length, 50), { timeout: 30_000 });
      const texts = await page.locator("tbody tr").allInnerTexts();
      expect(texts.every((t) => t.includes("Validé"))).toBe(true);
    } else {
      await expect(page.getByText("Aucun pointage pour ces filtres")).toBeVisible();
    }

    // Filtre période dans le futur lointain : état vide
    await page.getByLabel("Filtrer par statut").selectOption("");
    await page.getByLabel("Date début").fill("2099-01-01");
    await expect(page.getByText("Aucun pointage pour ces filtres")).toBeVisible({ timeout: 20_000 });
  });

  test(`${UC} › état d'erreur : message explicite attendu`, async ({ openAdmin }) => {
    const page = await openAdmin("admin");
    await page.route(/\/api\/v1\/pointages(\?.*)?$/, (route) =>
      route.fulfill({ status: 500, json: { code: "INTERNAL_ERROR", message: "Unexpected server error" } }),
    );
    await page.goto("/pointages");
    await expect(heading(page, "Pointages")).toBeVisible();
    await expect
      .soft(page.getByText(/erreur|échec|impossible|réessayer/i), "Aucun message d'erreur sur l'écran Pointages si l'API échoue")
      .toBeVisible();
  });
});

test.describe(`${UC} (saisie terrain E2E, détail, correction, rejet)`, () => {
  test(`${UC} › sync des pointages : création, idempotence, validations`, async ({ apiOf, world }) => {
    const cde = await apiOf("e2e_cde");
    const item = {
      clientUuid: newUuid(),
      workerId: world.workers[0].id,
      subActivityId: world.subActivity.id,
      quantity: 1,
      date: `${today()}T08:00:00.000Z`,
      createdByClientAt: new Date().toISOString(),
    };
    const first = await cde.post("/pointages/sync", { batch: [item] });
    expectStatus(first, 200);
    expect(first.body.results, `réponse de sync inattendue : ${JSON.stringify(first.body)?.slice(0, 200)}`).toBeTruthy();
    expect(first.body.results[0].status).toBe("created");
    const replay = await cde.post("/pointages/sync", { batch: [item] });
    expect
      .soft(
        replay.status,
        `rejeu du même clientUuid : HTTP ${replay.status} ${JSON.stringify(replay.body)?.slice(0, 160)} (200 + already_exists attendu — idempotence)`,
      )
      .toBe(200);
    if (replay.status === 200) {
      expect(replay.body.results[0].status).toBe("already_exists");
      expect(replay.body.results[0].id).toBe(first.body.results[0].id);
    }

    expectStatus(await cde.post("/pointages/sync", { batch: [{ ...item, clientUuid: newUuid(), quantity: 0 }] }), 400, 422);
    expectStatus(await cde.post("/pointages/sync", { batch: [{ ...item, clientUuid: "pas-un-uuid" }] }), 400, 422);
    expectStatus(await cde.post("/pointages/sync", { batch: [] }), 400, 422);
    const unknownWorker = await cde.post("/pointages/sync", { batch: [{ ...item, clientUuid: newUuid(), workerId: newUuid() }] });
    expectStatus(unknownWorker, 200);
    expect(unknownWorker.body.results[0].status, "MOC inexistant").toBe("rejected");
    // Trace pour le nettoyage
    const { track } = await import("./support/state.js");
    track("pointage", first.body.results[0].id, "sync-idempotence");
  });

  test(`${UC} › détail puis correction avec motif obligatoire, tracée dans l'audit`, async ({ openAdmin, admin, apiOf, world }) => {
    test.setTimeout(180_000);
    const cde = await apiOf("e2e_cde");
    const { results } = await createPointages(cde, world, [{ workerId: world.workers[0].id, quantity: 3, date: addDays(today(), -2) }]);
    const id = results[0].id!;
    const workerName = `${world.workers[0].firstName} ${world.workers[0].lastName}`;

    const page = await openAdmin("admin");
    await page.goto("/pointages");
    await page.getByLabel("Date début").fill(addDays(today(), -2));
    await page.getByLabel("Date fin").fill(addDays(today(), -2));
    const row = page.locator("tbody tr").filter({ hasText: workerName });
    await expect(row.first()).toBeVisible({ timeout: 30_000 });
    await row.first().getByRole("button", { name: "Voir le détail" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Détail pointage")).toBeVisible();
    await expect(dialog).toContainText(workerName);
    await expect(dialog).toContainText(/3\D?000/); // montant 3 × 1 000
    await expect(dialog).toContainText("Aucun contrôle bio pour cette semaine");

    await dialog.getByRole("button", { name: "Corriger" }).click();
    const save = dialog.getByRole("button", { name: "Enregistrer la correction" });
    await dialog.locator("#corr-qty").fill("5");
    await dialog.locator("#corr-reason").fill("court"); // < 10 caractères
    await expect(save).toBeDisabled();
    await dialog.locator("#corr-reason").fill("Correction de quantité — recette E2E-S3");
    await expect(save).toBeEnabled();
    const [patch] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/api/v1/pointages/${id}`) && r.request().method() === "PATCH"),
      save.click(),
    ]);
    expect(patch.status()).toBe(200);
    await expectToast(page, "Pointage corrigé");

    const fresh = (await admin.getAllCursor<any>(`/pointages?workerId=${world.workers[0].id}`)).find((p) => p.id === id);
    expect(Number(fresh.quantity)).toBe(5);
    expect(Number(fresh.amount)).toBe(5000);
    const audit = await expectAudit(admin, { entityType: "Pointage", entityId: id, action: "CORRECT" });
    const entry = audit.find((a) => a.action === "CORRECT")!;
    expect(JSON.stringify(entry.after)).toContain("Correction de quantité");
    expect(Number(entry.before.quantity)).toBe(3);
    expect(Number(entry.after.quantity)).toBe(5);

    // Serveur : motif absent ou trop court refusé (contournement de l'UI)
    expectStatus(await admin.patch(`/pointages/${id}`, { quantity: 6 }), 400, 422);
    expectStatus(await admin.patch(`/pointages/${id}`, { quantity: 6, correctionReason: "court" }), 400, 422);
    const unchanged = (await admin.getAllCursor<any>(`/pointages?workerId=${world.workers[0].id}`)).find((p) => p.id === id);
    expect(Number(unchanged.quantity)).toBe(5);
  });

  test(`${UC} › validation refusée sans bio OK, rejet avec motif obligatoire`, async ({ openAdmin, admin, apiOf, world }) => {
    test.setTimeout(180_000);
    const cde = await apiOf("e2e_cde");
    const cds = await apiOf("e2e_cds");
    const { results } = await createPointages(cde, world, [
      { workerId: world.workers[1].id, quantity: 2, date: addDays(today(), -3) },
      { workerId: world.workers[1].id, quantity: 4, date: addDays(today(), -4) },
    ]);
    const [rejectId, validateId] = [results[0].id!, results[1].id!];

    // RG-03 : pas de validation sans contrôle biométrique OK dans la semaine
    const asAdmin = await admin.patch(`/pointages/${validateId}/validate`);
    const denied = await cds.patch(`/pointages/${validateId}/validate`);
    test.info().annotations.push({ type: "diagnostic", description: `validate sans bio : admin → HTTP ${asAdmin.status} ${asAdmin.body?.code ?? ""} ; CDS → HTTP ${denied.status} ${denied.body?.code ?? ""}` });
    expect(asAdmin.status, "validation admin sans bio").toBe(422);
    expect.soft(denied.status, "validation CDS sans bio (HTTP 500 = erreur serveur au lieu de BIO_NOT_OK)").toBe(422);
    expect.soft(denied.body.code).toBe("BIO_NOT_OK");

    // Rejet : motif obligatoire côté serveur
    expectStatus(await cds.patch(`/pointages/${rejectId}/reject`, {}), 400, 422);
    expectStatus(await cds.patch(`/pointages/${rejectId}/reject`, { rejectionReason: "  " }), 400, 422);

    // Rejet via l'écran Admin
    const page = await openAdmin("admin");
    await page.goto("/pointages");
    await page.getByLabel("Date début").fill(addDays(today(), -3));
    await page.getByLabel("Date fin").fill(addDays(today(), -3));
    const name = `${world.workers[1].firstName} ${world.workers[1].lastName}`;
    const row = page.locator("tbody tr").filter({ hasText: name });
    await expect(row.first()).toBeVisible({ timeout: 30_000 });
    await row.first().getByRole("button", { name: "Voir le détail" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Rejeter" }).click();
    await expectToast(page, "Motif requis"); // motif vide refusé par l'UI
    await dialog.locator("#reject-reason").fill("Quantité non conforme (E2E-S3)");
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/api/v1/pointages/${rejectId}/reject`)),
      dialog.getByRole("button", { name: "Rejeter" }).click(),
    ]);
    expect(resp.status()).toBe(200);
    await expectToast(page, "Pointage rejeté");
    const after = (await admin.getAllCursor<any>(`/pointages?workerId=${world.workers[1].id}`)).find((p) => p.id === rejectId);
    expect(after.status).toBe("REJECTED");
    expect(after.rejectionReason).toContain("Quantité non conforme");
    await expectAudit(admin, { entityType: "Pointage", entityId: rejectId });
  });

  test(`${UC} › isolation : CDE et CDS E2E ne voient que leurs pointages`, async ({ apiOf, world }) => {
    const ids = new Set(world.workers.map((w) => w.id));
    for (const who of ["e2e_cde", "e2e_cds"] as const) {
      const client = await apiOf(who);
      const rows = await client.getAllCursor<any>("/pointages");
      expect(rows.length, `${who} doit voir les pointages E2E`).toBeGreaterThan(0);
      expect(rows.every((p) => ids.has(p.workerId)), `${who} voit des pointages hors périmètre`).toBe(true);
    }
  });

  test(`${UC} › état vide : message explicite`, async ({ openAdmin }) => {
    const page = await openAdmin("admin");
    await page.route(/\/api\/v1\/pointages(\?.*)?$/, (route) =>
      route.fulfill({ status: 200, json: { data: [], nextCursor: null, hasMore: false } }),
    );
    await page.goto("/pointages");
    await expect(page.getByText("Aucun pointage pour ces filtres")).toBeVisible();
  });
});
