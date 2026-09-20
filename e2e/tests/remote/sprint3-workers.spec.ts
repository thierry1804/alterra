import { test, expect } from "./support/fixtures.js";
import { E2E_PREFIX } from "./support/env.js";
import { expectAudit, expectStatus, xlsxBuffer } from "./support/helpers.js";
import { persisted, randomDigits, randomLetters, stReset, track } from "./support/state.js";
import { expectToast, heading, waitTableReady } from "./support/ui.js";
import type { ApiClient } from "./support/api.js";
import type { Page } from "@playwright/test";

const UC = "UC-FE-ADM-WORKERS";

async function freeMvola(admin: ApiClient, taken: Set<string>): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const candidate = `0389${randomDigits(6)}`;
    if (taken.has(candidate)) continue;
    const found = await admin.get(`/workers?q=${candidate}`);
    if ((found.body.data as unknown[]).length === 0) {
      taken.add(candidate);
      return candidate;
    }
  }
  throw new Error("Aucun numéro MVola libre");
}

/** Dry-run via API : détection des colonnes puis aperçu (aucune écriture). */
async function importDryRun(admin: ApiClient, file: Buffer) {
  const b64 = file.toString("base64");
  const cols = await admin.post("/workers/import/columns", { contentBase64: b64, hasHeaderRow: true });
  expectStatus(cols, 200);
  const preview = await admin.post("/workers/import?dryRun=true", {
    contentBase64: b64,
    hasHeaderRow: true,
    referenceRowNumber: cols.body.referenceRowNumber,
    mapping: cols.body.suggestedMapping,
  });
  return { cols: cols.body, preview };
}

async function openImport(page: Page) {
  await page.goto("/workers");
  await waitTableReady(page);
  await page.getByRole("button", { name: "Import Excel" }).click();
  return page.getByRole("dialog");
}

const HEADERS = ["Matricule", "Prénom", "Nom", "Numéro MVola", "Code site"];

test.describe(`${UC} (consultation, volumétrie, filtres)`, () => {
  test(`${UC} › volumétrie du référentiel réel : rendu, chargement par curseur, recherche (lecture seule)`, async ({
    openAdmin,
    admin,
  }, testInfo) => {
    test.setTimeout(240_000);
    const all = await admin.getAllCursor<any>("/workers?take=100");
    const total = all.length;
    expect(total).toBeGreaterThan(0);

    const page = await openAdmin("admin");
    const t0 = Date.now();
    await page.goto("/workers");
    await expect(heading(page, "Travailleurs")).toBeVisible();
    await waitTableReady(page);
    const renderMs = Date.now() - t0;
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(Math.min(50, total));

    // Chargement complet par « Charger plus » (curseur, 50 par page)
    const t1 = Date.now();
    const loadMore = page.getByRole("button", { name: "Charger plus" });
    let clicks = 0;
    for (let i = 0; i < 80 && (await rows.count()) < total; i++) {
      if (await loadMore.isVisible().catch(() => false)) {
        await Promise.all([
          page.waitForResponse((r) => /\/api\/v1\/workers\?/.test(r.url()) && r.request().method() === "GET"),
          loadMore.click(),
        ]);
        clicks++;
      }
      await page.waitForTimeout(300);
    }
    await expect(rows).toHaveCount(total, { timeout: 60_000 });
    const loadAllMs = Date.now() - t1;

    // Recherche : un nom réel pris au milieu de la liste
    const sample = all[Math.floor(total / 2)];
    const term = sample.lastName as string;
    const apiMatches = await admin.getAllCursor<any>(`/workers?q=${encodeURIComponent(term)}&take=100`);
    const t2 = Date.now();
    await page.getByPlaceholder("Rechercher (nom, matricule, MVola…)").fill(term);
    await expect(rows).toHaveCount(apiMatches.length, { timeout: 30_000 });
    const searchMs = Date.now() - t2;

    testInfo.annotations.push(
      { type: "volumétrie", description: `${total} MOC réels ; rendu initial ${renderMs} ms ; chargement complet (${clicks} clics) ${loadAllMs} ms ; recherche d'un nom réel (${term.length} caractères, masqué) → ${apiMatches.length} ligne(s) en ${searchMs} ms` },
    );
    testInfo.annotations.push({
      type: "critère 600+",
      description: total >= 600 ? "volume réel ≥ 600 MOC : critère éprouvé" : `volume réel ${total} < 600 MOC : critère « 600+ lignes » non éprouvé sur le réel (extrapolation seulement)`,
    });
    expect(renderMs, "rendu initial > 15 s").toBeLessThan(15_000);
    expect(searchMs, "recherche > 10 s").toBeLessThan(10_000);
    // Toutes les lignes affichées contiennent le terme (nom, matricule ou MVola)
    const texts = await rows.allInnerTexts();
    expect(texts.every((t) => t.toLowerCase().includes(term.toLowerCase()))).toBe(true);
  });

  test(`${UC} › filtres site et statut (jeu E2E)`, async ({ openAdmin, admin, world }) => {
    const expectedActive = (await admin.getAllCursor<any>(`/workers?siteId=${world.site.id}&status=ACTIVE&take=100`)).length;
    expect(expectedActive).toBeGreaterThanOrEqual(world.workers.length);
    const page = await openAdmin("admin");
    await page.goto("/workers");
    await waitTableReady(page);
    const siteSelect = page.locator("select").filter({ has: page.locator("option", { hasText: "Tous les sites" }) });
    await siteSelect.selectOption(world.site.id);
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(expectedActive, { timeout: 20_000 });
    const texts = await rows.allInnerTexts();
    expect(texts.every((t) => t.includes(world.site.code))).toBe(true);

    const statusSelect = page.locator("select").filter({ has: page.locator("option", { hasText: "Tous statuts" }) });
    const inactive = (await admin.getAllCursor<any>(`/workers?siteId=${world.site.id}&status=INACTIVE&take=100`)).length;
    await statusSelect.selectOption("INACTIVE");
    if (inactive === 0) await expect(page.getByText("Aucun MOC trouvé.")).toBeVisible({ timeout: 20_000 }); // état vide
    else await expect(rows).toHaveCount(inactive, { timeout: 20_000 });
    await statusSelect.selectOption("ACTIVE");
    await expect(rows).toHaveCount(expectedActive, { timeout: 20_000 });
  });

  test(`${UC} › état d'erreur : message explicite attendu`, async ({ openAdmin }) => {
    const page = await openAdmin("admin");
    await page.route("**/api/v1/workers?**", (route) =>
      route.fulfill({ status: 500, json: { code: "INTERNAL_ERROR", message: "Unexpected server error" } }),
    );
    await page.goto("/workers");
    await expect(heading(page, "Travailleurs")).toBeVisible();
    await expect
      .soft(page.getByText(/erreur|échec|impossible|réessayer/i), "Aucun message d'erreur sur l'écran Travailleurs si l'API échoue")
      .toBeVisible();
  });
});

test.describe(`${UC} (création, validation, édition, suppression)`, () => {
  const st = persisted<{ id?: string; matricule?: string; mvola?: string }>("workers");
  const taken = new Set<string>();

  test(`${UC} › création via le formulaire`, async ({ openAdmin, admin, world }) => {
    stReset("workers");
    const page = await openAdmin("admin");
    await page.goto("/workers");
    await waitTableReady(page);
    st.matricule = `${E2E_PREFIX}UIW-${world.runId}`;
    st.mvola = await freeMvola(admin, taken);

    await page.getByRole("button", { name: "Nouveau MOC" }).click();
    const dialog = page.getByRole("dialog");
    // Champs obligatoires bloqués par le navigateur
    await dialog.getByRole("button", { name: "Enregistrer" }).click();
    expect(await dialog.locator("#w-matricule").evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);

    await dialog.locator("#w-matricule").fill(st.matricule);
    await dialog.locator("#w-mvola").fill(st.mvola);
    await dialog.locator("#w-first").fill(`${E2E_PREFIX}UIW`);
    await dialog.locator("#w-last").fill(world.runId);
    await dialog.locator("#w-site").selectOption(world.site.id);
    await dialog.locator("#w-hired").fill("2026-01-01");
    const [resp] = await Promise.all([
      page.waitForResponse((r) => /\/api\/v1\/workers$/.test(r.url()) && r.request().method() === "POST"),
      dialog.getByRole("button", { name: "Enregistrer" }).click(),
    ]);
    expect(resp.status()).toBe(201);
    st.id = (await resp.json()).id;
    track("worker", st.id, st.matricule);
    await page.getByPlaceholder("Rechercher (nom, matricule, MVola…)").fill(st.matricule);
    const row = page.locator("tbody tr").filter({ hasText: st.matricule });
    await expect(row).toBeVisible();
    await expect(row).toContainText(st.mvola);
    await expect(row).toContainText(world.site.code);
    await expectAudit(admin, { entityType: "Worker", entityId: st.id!, action: "CREATE" });
  });

  test(`${UC} › validations serveur : doublons et formats`, async ({ admin, world }) => {
    test.skip(!st.id, "MOC UI non créé");
    const base = { firstName: `${E2E_PREFIX}VAL`, lastName: world.runId, siteId: world.site.id, hiredAt: "2026-01-01" };
    // Matricule déjà utilisé
    const dupMatricule = await admin.post("/workers", { ...base, matricule: st.matricule, mvolaNumber: await freeMvola(admin, taken) });
    expect.soft(dupMatricule.status, "doublon de matricule accepté").toBeGreaterThanOrEqual(400);
    if (dupMatricule.status === 201) track("worker", dupMatricule.body.id, "dup-matricule");
    // Numéro MVola déjà utilisé
    const dupMvola = await admin.post("/workers", { ...base, matricule: `${E2E_PREFIX}DUPM-${world.runId}`, mvolaNumber: st.mvola });
    expect.soft(dupMvola.status, "doublon de numéro MVola accepté").toBeGreaterThanOrEqual(400);
    if (dupMvola.status === 201) track("worker", dupMvola.body.id, "dup-mvola");
    // Champs manquants
    const missing = await admin.post("/workers", { firstName: "X" });
    expectStatus(missing, 400, 422);
    // Format MVola : la charte UI annonce 034/038XXXXXXX ; l'API n'exige que 9 caractères
    const badFormat = await admin.post("/workers", { ...base, matricule: `${E2E_PREFIX}BADF-${world.runId}`, mvolaNumber: `999${randomDigits(8)}` });
    if (badFormat.status === 201) track("worker", badFormat.body.id, "bad-mvola-format");
    expect
      .soft(badFormat.status, "numéro MVola au format invalide (préfixe ≠ 034/038) accepté à la création : l'export MVola échouera plus tard")
      .toBeGreaterThanOrEqual(400);
  });

  test(`${UC} › édition (fiche) puis suppression avec confirmation`, async ({ openAdmin, admin }) => {
    test.skip(!st.id, "MOC UI non créé");
    const page = await openAdmin("admin");
    await page.goto("/workers");
    await page.getByPlaceholder("Rechercher (nom, matricule, MVola…)").fill(st.matricule!);
    const row = page.locator("tbody tr").filter({ hasText: st.matricule! });
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Modifier" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#w-first").fill(`${E2E_PREFIX}UIW-EDIT`);
    const [patch] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/api/v1/workers/${st.id}`) && r.request().method() === "PATCH"),
      dialog.getByRole("button", { name: "Enregistrer" }).click(),
    ]);
    expect(patch.status()).toBe(200);
    await expect(page.locator("tbody tr").filter({ hasText: `${E2E_PREFIX}UIW-EDIT` })).toBeVisible();
    await expectAudit(admin, { entityType: "Worker", entityId: st.id!, action: "UPDATE" });

    await page.locator("tbody tr").filter({ hasText: st.matricule! }).getByRole("button", { name: "Supprimer" }).click();
    const confirm = page.getByRole("dialog");
    await expect(confirm.getByText("Supprimer ce travailleur ?")).toBeVisible();
    const [del] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/api/v1/workers/${st.id}`) && r.request().method() === "DELETE"),
      confirm.getByRole("button", { name: "Supprimer" }).click(),
    ]);
    expect(del.status()).toBe(200);
    await expect(page.locator("tbody tr").filter({ hasText: st.matricule! })).toHaveCount(0);
    await expectAudit(admin, { entityType: "Worker", entityId: st.id!, action: ["DELETE", "DEACTIVATE"] });
    const gone = await admin.get(`/workers/${st.id}`);
    expect(gone.status).toBe(404);
  });
});

test.describe(`${UC} (import Excel MOC)`, () => {
  const taken = new Set<string>();

  test(`${UC} › import : fichier valide (aperçu puis import réel, données E2E)`, async ({ openAdmin, admin, world }) => {
    test.setTimeout(180_000);
    const runTag = `${world.runId}-${randomLetters(2)}`;
    const rows = [
      [`${E2E_PREFIX}IMP-${runTag}-1`, `${E2E_PREFIX}IMPA`, world.runId, await freeMvola(admin, taken), world.site.code],
      [`${E2E_PREFIX}IMP-${runTag}-2`, `${E2E_PREFIX}IMPB`, world.runId, await freeMvola(admin, taken), world.site.code],
    ];
    const file = await xlsxBuffer([HEADERS, ...rows]);

    const page = await openAdmin("admin");
    const dialog = await openImport(page);
    await dialog.locator('input[type="file"]').setInputFiles({ name: "moc-e2e-valide.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: file });
    await expect(dialog.getByText("Associez chaque champ requis à une colonne")).toBeVisible();
    const [preview] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/workers/import?dryRun=true")),
      dialog.getByRole("button", { name: "Continuer" }).click(),
    ]);
    const previewBody = await preview.json();
    expect(previewBody.valid).toHaveLength(2);
    expect(previewBody.errors).toHaveLength(0);
    await expect(dialog.getByText(/2 à créer, 0 à mettre à jour/)).toBeVisible();

    // Aucune écriture avant confirmation
    const before = await admin.get(`/workers?q=${E2E_PREFIX}IMP-${runTag}`);
    expect(before.body.data).toHaveLength(0);

    const [commit] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/workers/import?dryRun=false")),
      dialog.getByRole("button", { name: /Importer les 2 ligne/ }).click(),
    ]);
    expect([200, 201]).toContain(commit.status());
    await expectToast(page, "Import terminé");
    const after = await admin.get(`/workers?q=${E2E_PREFIX}IMP-${runTag}`);
    expect(after.body.data).toHaveLength(2);
    for (const w of after.body.data as any[]) track("worker", w.id, w.matricule);
    const audit = await admin.get(`/audit-log?entityType=Worker&action=IMPORT&limit=5`);
    expect(audit.body.data[0].action).toBe("IMPORT");
    expect(JSON.stringify(audit.body.data[0].after)).toContain('"created":2');
  });

  test(`${UC} › import : fichier mal formé et mauvaise extension`, async ({ openAdmin }) => {
    const page = await openAdmin("admin");
    let dialog = await openImport(page);
    await dialog.locator('input[type="file"]').setInputFiles({
      name: "corrompu.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer: Buffer.from("ceci n'est pas un classeur Excel"),
    });
    await expectToast(page, "Lecture du fichier impossible");
    await expect(dialog.getByText("Choisissez un fichier .xlsx")).toBeVisible(); // reste à l'étape 1

    await page.keyboard.press("Escape");
    dialog = await openImport(page);
    await dialog.locator('input[type="file"]').setInputFiles({ name: "moc.csv", mimeType: "text/csv", buffer: Buffer.from("a;b\n1;2") });
    await expectToast(page, "Format invalide");
  });

  test(`${UC} › import : colonne obligatoire absente`, async ({ openAdmin, world }) => {
    const file = await xlsxBuffer([
      ["Matricule", "Prénom", "Numéro MVola", "Code site"], // pas de « Nom »
      [`${E2E_PREFIX}NOCOL`, `${E2E_PREFIX}X`, "0389000000", world.site.code],
    ]);
    const page = await openAdmin("admin");
    const dialog = await openImport(page);
    await dialog.locator('input[type="file"]').setInputFiles({ name: "sans-nom.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: file });
    await expect(dialog.getByText(/Champs obligatoires à associer/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Continuer" })).toBeDisabled();
  });

  test(`${UC} › import : doublons dans le fichier, lignes en erreur, doublon en base (aperçu seulement)`, async ({
    admin,
    world,
  }) => {
    const dupMvola = await freeMvola(admin, taken);
    const okMvola = await freeMvola(admin, taken);
    // Code site inexistant : on vérifie qu'il n'existe pas avant de l'utiliser
    const sites = await admin.get("/sites");
    const used = new Set((sites.body.data as any[]).map((s) => s.shortCode));
    let unknownSite = "";
    do unknownSite = randomLetters(3);
    while (used.has(unknownSite));

    const file = await xlsxBuffer([
      HEADERS,
      [`${E2E_PREFIX}DUP-1-${world.runId}`, `${E2E_PREFIX}D1`, world.runId, dupMvola, world.site.code],
      [`${E2E_PREFIX}DUP-2-${world.runId}`, `${E2E_PREFIX}D2`, world.runId, dupMvola, world.site.code], // même MVola
      [`${E2E_PREFIX}OK-${world.runId}`, `${E2E_PREFIX}OK`, world.runId, okMvola, world.site.code], // valide
      [`${E2E_PREFIX}BADNUM-${world.runId}`, `${E2E_PREFIX}B`, world.runId, "abc", world.site.code], // MVola invalide
      [`${E2E_PREFIX}NOSITE-${world.runId}`, `${E2E_PREFIX}S`, world.runId, `0389${randomDigits(6)}`, unknownSite], // site inconnu
      [`${E2E_PREFIX}NONAME-${world.runId}`, "", world.runId, `0389${randomDigits(6)}`, world.site.code], // prénom manquant
      [world.workers[0].matricule, "AutreNom", world.runId, world.workers[1].mvolaNumber, world.site.code], // matricule/MVola de deux MOC existants
    ]);
    const { preview } = await importDryRun(admin, file);
    expectStatus(preview, 200);
    const errors = preview.body.errors as Array<{ row: number; field: string; message: string }>;
    const valid = preview.body.valid as Array<{ row: number; matricule: string }>;
    expect(errors.some((e) => e.row === 3 && /dupliqué/i.test(e.message)), "doublon dans le fichier (ligne 3)").toBe(true);
    expect(errors.some((e) => e.row === 2 && /dupliqué/i.test(e.message)), "doublon dans le fichier (ligne 2)").toBe(true);
    expect(errors.some((e) => e.row === 5 && e.field === "mvolaNumber")).toBe(true);
    expect(errors.some((e) => e.row === 6 && e.field === "siteShortCode")).toBe(true);
    expect(errors.some((e) => e.row === 7 && e.field === "firstName")).toBe(true);
    expect(errors.some((e) => e.row === 8), "conflit matricule/MVola avec la base").toBe(true);
    expect(valid.map((v) => v.row)).toEqual([4]);

    // Aperçu seul : aucune écriture
    const check = await admin.get(`/workers?q=${E2E_PREFIX}DUP-1-${world.runId}`);
    expect(check.body.data).toHaveLength(0);
  });

  test(`${UC} › import : un numéro MVola déjà en base met à jour le MOC existant (upsert silencieux)`, async ({ admin, world }) => {
    const target = world.workers[2];
    const file = await xlsxBuffer([HEADERS, [target.matricule, `${E2E_PREFIX}MAJ`, target.lastName, target.mvolaNumber, world.site.code]]);
    const { preview } = await importDryRun(admin, file);
    expectStatus(preview, 200);
    const valid = preview.body.valid as Array<{ existingWorkerId?: string }>;
    expect(valid).toHaveLength(1);
    // Constat (aperçu uniquement, sur MOC E2E) : le fichier écrase le MOC existant identifié par son n° MVola.
    expect(valid[0].existingWorkerId).toBe(target.id);
    test.info().annotations.push({
      type: "constat",
      description: "L'import met à jour sans avertissement bloquant le MOC dont le n° MVola existe déjà (mention « à mettre à jour » dans l'aperçu uniquement).",
    });
  });
});
