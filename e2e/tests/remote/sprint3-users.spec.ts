import { test, expect } from "./support/fixtures.js";
import { ApiClient } from "./support/api.js";
import { E2E_PREFIX } from "./support/env.js";
import { expectAudit, expectStatus } from "./support/helpers.js";
import { persisted, randomPassword, stReset, track } from "./support/state.js";
import { expectToast, findRowLoadMore, heading, waitTableReady } from "./support/ui.js";

const UC = "UC-FE-ADM-USERS";

test.describe(`${UC} (consultation, filtres, états)`, () => {
  test(`${UC} › liste et filtre par rôle, cohérents avec l'API (lecture seule)`, async ({ openAdmin, admin }) => {
    const page = await openAdmin("admin");
    const [resp] = await Promise.all([
      page.waitForResponse((r) => /\/api\/v1\/users\?/.test(r.url()) && r.request().method() === "GET"),
      page.goto("/users"),
    ]);
    expect(resp.status()).toBe(200);
    const first = await resp.json();
    await expect(heading(page, "Utilisateurs")).toBeVisible();
    await waitTableReady(page);
    await expect(page.locator("tbody tr")).toHaveCount(first.data.length);

    const roleSelect = page.locator("select").filter({ has: page.locator("option", { hasText: "Tous les rôles" }) });
    const cds = await admin.getAllCursor<any>("/users?role=CHEF_SERVICE&take=100");
    await roleSelect.selectOption("CHEF_SERVICE");
    await expect(page.locator("tbody tr")).toHaveCount(Math.min(cds.length, 50), { timeout: 20_000 });
    const texts = await page.locator("tbody tr").allInnerTexts();
    expect(texts.every((t) => t.includes("Chef de service"))).toBe(true);
  });

  test(`${UC} › état d'erreur : message explicite attendu`, async ({ openAdmin }) => {
    const page = await openAdmin("admin");
    await page.route("**/api/v1/users?**", (route) =>
      route.fulfill({ status: 500, json: { code: "INTERNAL_ERROR", message: "Unexpected server error" } }),
    );
    await page.goto("/users");
    await expect(heading(page, "Utilisateurs")).toBeVisible();
    await expect
      .soft(page.getByText(/erreur|échec|impossible|réessayer/i), "Aucun message d'erreur sur l'écran Utilisateurs si l'API échoue")
      .toBeVisible();
  });
});

test.describe(`${UC} (création, validation, édition, reset, désactivation)`, () => {
  const st = persisted<{ id?: string; email?: string; tempPassword?: string; lastName?: string }>("users");

  test(`${UC} › création via le formulaire avec mot de passe temporaire généré`, async ({ openAdmin, admin, world }) => {
    stReset("users");
    const page = await openAdmin("admin");
    await page.goto("/users");
    await waitTableReady(page);
    st.email = `e2e-s3-ui-${world.runId.toLowerCase()}-${Date.now().toString(36)}@alterra.test`;
    st.lastName = world.runId;

    await page.getByRole("button", { name: "Nouvel utilisateur" }).click();
    const dialog = page.getByRole("dialog");
    // Champs requis
    await dialog.getByRole("button", { name: "Enregistrer" }).click();
    expect(await dialog.locator("#u-first").evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
    // E-mail invalide bloqué par le navigateur
    await dialog.locator("#u-first").fill(`${E2E_PREFIX}UI`);
    await dialog.locator("#u-last").fill(world.runId);
    await dialog.locator("#u-email").fill("pas-un-email");
    await dialog.getByRole("button", { name: "Enregistrer" }).click();
    expect(await dialog.locator("#u-email").evaluate((el: HTMLInputElement) => el.validity.typeMismatch)).toBe(true);

    await dialog.locator("#u-email").fill(st.email);
    await dialog.locator("#u-role").selectOption("CHEF_EQUIPE");
    await dialog.locator("#u-site").selectOption(world.site.id);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => /\/api\/v1\/users$/.test(r.url()) && r.request().method() === "POST"),
      dialog.getByRole("button", { name: "Enregistrer" }).click(),
    ]);
    expect(resp.status()).toBe(201);
    const body = await resp.json();
    st.id = body.user.id;
    track("user", st.id, st.email);
    st.tempPassword = body.temporaryPassword;
    expect(st.tempPassword, "mot de passe temporaire renvoyé par l'API").toBeTruthy();
    await expectToast(page, "Utilisateur créé");
    await expect(page.getByRole("dialog").getByText("Mot de passe temporaire")).toBeVisible();
    await expect(page.getByRole("dialog").getByText(st.tempPassword!, { exact: true })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Fermer" }).last().click();

    await expectAudit(admin, { entityType: "User", entityId: st.id!, action: "CREATE" });
    // Le compte créé peut se connecter avec le mot de passe temporaire
    const login = await ApiClient.rawLogin(st.email, st.tempPassword!);
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe("CHEF_EQUIPE");
  });

  test(`${UC} › création avec un mot de passe saisi (champ « optionnel » du formulaire)`, async ({ openAdmin, world }) => {
    const page = await openAdmin("admin");
    await page.goto("/users");
    await waitTableReady(page);
    const email = `e2e-s3-pwd-${world.runId.toLowerCase()}-${Date.now().toString(36)}@alterra.test`;
    await page.getByRole("button", { name: "Nouvel utilisateur" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#u-first").fill(`${E2E_PREFIX}PWD`);
    await dialog.locator("#u-last").fill(world.runId);
    await dialog.locator("#u-email").fill(email);
    await dialog.locator("#u-role").selectOption("CHEF_EQUIPE");
    await dialog.locator("#u-site").selectOption(world.site.id);
    await dialog.locator("#u-password").fill(randomPassword());
    const [resp] = await Promise.all([
      page.waitForResponse((r) => /\/api\/v1\/users$/.test(r.url()) && r.request().method() === "POST"),
      dialog.getByRole("button", { name: "Enregistrer" }).click(),
    ]);
    const status = resp.status();
    if (status === 201) track("user", (await resp.json()).user.id, email);
    expect(status, "création avec mot de passe explicite : HTTP 500 attendu 201 (le champ « Mot de passe (optionnel) » du formulaire est inutilisable)").toBe(201);
  });

  test(`${UC} › validations serveur : e-mail invalide, mot de passe court, e-mail en doublon`, async ({ admin, world }) => {
    test.skip(!st.email, "utilisateur UI non créé");
    const base = { role: "CHEF_EQUIPE", firstName: `${E2E_PREFIX}VAL`, lastName: world.runId, siteId: world.site.id };
    expectStatus(await admin.post("/users", { ...base, email: "pas-un-email" }), 400, 422);
    expectStatus(await admin.post("/users", { ...base, email: `e2e-s3-short-${world.runId.toLowerCase()}@alterra.test`, password: "court" }), 400, 422);
    const dup = await admin.post("/users", { ...base, email: st.email });
    expect(dup.status, "e-mail en doublon accepté").toBeGreaterThanOrEqual(400);
    if (dup.status === 201) track("user", dup.body.user.id, "dup-email");
    expect.soft(dup.status, `e-mail en doublon : HTTP ${dup.status} (409 attendu)`).toBe(409);
    expectStatus(await admin.post("/users", { role: "CHEF_EQUIPE", firstName: "X", lastName: "Y" }), 201, 400, 422); // sans e-mail ni téléphone
  });

  test(`${UC} › édition via le formulaire`, async ({ openAdmin, admin }) => {
    test.skip(!st.id, "utilisateur UI non créé");
    const page = await openAdmin("admin");
    await page.goto("/users");
    const row = await findRowLoadMore(page, st.email!);
    await row.getByRole("button", { name: "Modifier" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator("#u-last").fill(`${st.lastName}-EDIT`);
    const [patch] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/api/v1/users/${st.id}`) && r.request().method() === "PATCH"),
      dialog.getByRole("button", { name: "Enregistrer" }).click(),
    ]);
    expect(patch.status()).toBe(200);
    await expectToast(page, "Utilisateur mis à jour");
    await findRowLoadMore(page, `${st.lastName}-EDIT`);
    await expectAudit(admin, { entityType: "User", entityId: st.id!, action: "UPDATE" });
  });

  test(`${UC} › réinitialisation du mot de passe`, async ({ openAdmin, admin }) => {
    test.skip(!st.id, "utilisateur UI non créé");
    const page = await openAdmin("admin");
    await page.goto("/users");
    const row = await findRowLoadMore(page, st.email!);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/api/v1/users/${st.id}/reset-password`)),
      row.getByRole("button", { name: "Réinitialiser le mot de passe" }).click(),
    ]);
    expect(resp.status()).toBe(200);
    const newTemp = (await resp.json()).temporaryPassword as string;
    await expectToast(page, "Mot de passe réinitialisé");
    await expect(page.getByRole("dialog").getByText("Mot de passe temporaire")).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Fermer" }).last().click();
    await expectAudit(admin, { entityType: "User", entityId: st.id!, action: "RESET_PASSWORD" });

    const old = await ApiClient.rawLogin(st.email!, st.tempPassword!); // échec n°1 sur ce compte E2E
    expect(old.status, "l'ancien mot de passe doit être refusé").toBe(401);
    const fresh = await ApiClient.rawLogin(st.email!, newTemp);
    expect(fresh.status).toBe(200);
    st.tempPassword = newTemp;
  });

  test(`${UC} › mot de passe réinitialisé : le compte reste bloqué 15 min (jetons neufs refusés)`, async ({ admin, world }) => {
    const email = `e2e-s3-reset-${world.runId.toLowerCase()}-${Date.now().toString(36)}@alterra.test`;
    const created = await admin.post("/users", { email, role: "CHEF_EQUIPE", firstName: "E2E-S3-RESET", lastName: world.runId, siteId: world.site.id });
    expectStatus(created, 201);
    track("user", created.body.user.id, email);
    const reset = await admin.post(`/users/${created.body.user.id}/reset-password`);
    expectStatus(reset, 200);
    const fresh = new ApiClient(email, reset.body.temporaryPassword);
    await fresh.login(); // la connexion elle-même réussit…
    const probe = await fresh.probe("GET", "/sites");
    // … mais le compte est bloqué (USER_BLOCKED) pendant 15 min : le nouveau jeton est refusé
    expect(probe.status, `après réinitialisation, le nouveau jeton est refusé (HTTP ${probe.status} ${probe.body?.code ?? ""}) : compte inutilisable pendant 15 min`).toBe(200);
    await fresh.dispose();
  });

  test(`${UC} › désactivation : compte inactif refusé, sessions existantes révoquées`, async ({ openAdmin, admin, world }) => {
    // Utilisateur dédié, jamais réinitialisé (un reset bloque le compte 15 min — voir test précédent)
    const email = `e2e-s3-deact-${world.runId.toLowerCase()}-${Date.now().toString(36)}@alterra.test`;
    const created = await admin.post("/users", { email, role: "CHEF_EQUIPE", firstName: "E2E-S3-DEACT", lastName: world.runId, siteId: world.site.id });
    expectStatus(created, 201);
    track("user", created.body.user.id, email);
    const uid = created.body.user.id as string;
    const password = created.body.temporaryPassword as string;
    const live = new ApiClient(email, password);
    await live.login();
    expect((await live.probe("GET", "/sites")).status).toBe(200);

    const page = await openAdmin("admin");
    await page.goto("/users");
    const row = await findRowLoadMore(page, email);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes(`/api/v1/users/${uid}/deactivate`)),
      row.getByRole("button", { name: "Désactiver" }).click(),
    ]);
    expect(resp.status()).toBe(200);
    await expectToast(page, "Utilisateur désactivé");
    await expect(await findRowLoadMore(page, email)).toContainText("Inactif");
    await expectAudit(admin, { entityType: "User", entityId: uid, action: "DEACTIVATE" });

    const denied = await ApiClient.rawLogin(email, password); // tentative de connexion refusée
    expect(denied.status, "un compte inactif ne doit pas pouvoir se connecter").toBe(401);
    const me = await live.probe("GET", "/sites");
    expect.soft(me.status, `jeton d'accès d'un compte désactivé encore accepté (HTTP ${me.status}, 401 attendu)`).toBe(401);
    const refresh = await live.probe("POST", "/auth/refresh");
    expect(refresh.status, "le refresh d'un compte désactivé doit être refusé").toBe(401);
    await live.dispose();
  });
});
