import { test, expect } from "./support/fixtures.js";
import { ApiClient } from "./support/api.js";
import { ADMIN_URL, INACTIVE_ACCOUNT_EMAIL, realCredentials, usersPassword } from "./support/env.js";
import { expectStatus } from "./support/helpers.js";
import { newUuid, track } from "./support/state.js";
import { heading } from "./support/ui.js";

/**
 * Transverse — RBAC UI et API, isolation par site, comptes inactifs, absence de panneau de démo.
 * Aucune écriture réelle : les appels d'écriture d'un rôle non autorisé utilisent des identifiants
 * aléatoires ou des corps invalides, de sorte qu'une éventuelle faille RBAC ne modifie aucune donnée.
 */
const ROUTES = ["/", "/pointages", "/sites", "/zones", "/activities", "/units", "/workers", "/requests", "/map", "/users", "/payments", "/reports", "/audit", "/settings"];
const CDS_ROUTES = ["/", "/pointages"];

/**
 * Session Admin d'un rôle non-admin : connexion par le formulaire dans la page de test, puis navigation SPA
 * (sans rechargement). GET /me renvoie HTTP 500 pour ces rôles : un rechargement ferait perdre la session
 * (voir le test « survit à un rechargement »), ce qui empêcherait de vérifier la matrice de routes.
 */
async function loginInPage(browser: import("@playwright/test").Browser, role: "cds_amb" | "cde_amb2") {
  const { email, password } = realCredentials(role);
  const ctx = await browser.newContext({ baseURL: ADMIN_URL, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  await page.waitForTimeout(800);
  return { ctx, page };
}

async function spaVisit(page: import("@playwright/test").Page, route: string): Promise<string> {
  await page.evaluate((p) => {
    window.history.pushState({}, "", p);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, route);
  await page.waitForTimeout(700);
  return new URL(page.url()).pathname;
}

async function visit(page: import("@playwright/test").Page, route: string): Promise<string> {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await expect(page.getByText("Vérification de la session…")).toHaveCount(0, { timeout: 30_000 });
  await page.waitForLoadState("domcontentloaded");
  // laisse le temps aux redirections de garde
  await page.waitForTimeout(700);
  return new URL(page.url()).pathname;
}

test.describe("RBAC — écrans Admin", () => {
  test("administrateur : accès à tous les écrans", async ({ openAdmin }) => {
    test.setTimeout(240_000);
    const page = await openAdmin("admin");
    const refused: string[] = [];
    for (const route of ROUTES) {
      const path = await visit(page, route);
      if (path !== route) refused.push(`${route} → ${path}`);
    }
    expect(refused, "écrans refusés à l'administrateur").toEqual([]);
  });

  test("chef de service (AMB) : uniquement Tableau de bord et Pointages", async ({ browser }) => {
    test.setTimeout(240_000);
    const { ctx, page } = await loginInPage(browser, "cds_amb");
    try {
      for (const route of ROUTES) {
        const path = await spaVisit(page, route);
        if (CDS_ROUTES.includes(route)) expect(path, `${route} doit être accessible au chef de service`).toBe(route);
        else expect(path, `${route} doit être refusé au chef de service`).toBe("/forbidden");
      }
      await spaVisit(page, "/");
      const nav = await page.locator("nav a").allInnerTexts();
      expect(nav.map((t) => t.trim()).sort()).toEqual(["Pointages", "Tableau de bord"]);
    } finally {
      await ctx.close();
    }
  });

  test("chef d'équipe : refusé sur tout l'Admin", async ({ browser }) => {
    test.setTimeout(240_000);
    const { ctx, page } = await loginInPage(browser, "cde_amb2");
    try {
      for (const route of ROUTES) {
        const path = await spaVisit(page, route);
        expect(path, `${route} doit être refusé au chef d'équipe`).toBe("/forbidden");
      }
    } finally {
      await ctx.close();
    }
  });

  test("chef de service : la session Admin survit à un rechargement de page (F5)", async ({ browser }) => {
    const { ctx, page } = await loginInPage(browser, "cds_amb");
    try {
      const me = page.waitForResponse((r) => r.url().includes("/api/v1/me"));
      await page.reload();
      const meResp = await me;
      await page.waitForTimeout(1500);
      expect(
        { path: new URL(page.url()).pathname, me: meResp.status() },
        "après F5, GET /me échoue (HTTP 500) et le chef de service est renvoyé vers /login",
      ).toEqual({ path: "/", me: 200 });
    } finally {
      await ctx.close();
    }
  });

  test("écran de connexion Admin : aucun panneau de comptes de démonstration", async ({ browser }) => {
    const ctx = await browser.newContext({ baseURL: ADMIN_URL });
    const page = await ctx.newPage();
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
    await expect(page.getByText(/Comptes de démonstration/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Utiliser" })).toHaveCount(0);
    await expect(page.locator("#password")).toHaveValue("");
    await ctx.close();
  });
});

test.describe("RBAC — API", () => {
  test("sans jeton ou avec un jeton falsifié : 401", async () => {
    const { request } = await import("@playwright/test");
    const ctx = await request.newContext({ baseURL: ADMIN_URL });
    for (const path of ["/api/v1/users", "/api/v1/audit-log", "/api/v1/workers", "/api/v1/pointages", "/api/v1/me"]) {
      const anon = await ctx.get(path);
      expect(anon.status(), `GET ${path} sans jeton`).toBe(401);
      const forged = await ctx.get(path, { headers: { Authorization: "Bearer abc.def.ghi" } });
      expect(forged.status(), `GET ${path} jeton falsifié`).toBe(401);
    }
    await ctx.dispose();
  });

  test("chef de service : 403 sur les routes Admin, lectures limitées à son site", async ({ apiOf }) => {
    const cds = await apiOf("cds_amb");
    const id = newUuid();
    const denied: Array<[string, () => Promise<{ status: number }>]> = [
      ["GET /users", () => cds.get("/users")],
      ["GET /audit-log", () => cds.get("/audit-log")],
      ["GET /payments", () => cds.get("/payments?periodIso=S1")],
      ["POST /payments/generate (période invalide)", () => cds.post("/payments/generate", { periodIso: "BAD" })],
      ["POST /sites (corps invalide)", () => cds.post("/sites", { name: "x" })],
      ["PATCH /sites/:id (inexistant)", () => cds.patch(`/sites/${id}`, { name: "xx" })],
      ["POST /workers (corps invalide)", () => cds.post("/workers", { firstName: "x" })],
      ["DELETE /workers/:id (inexistant)", () => cds.delete(`/workers/${id}`)],
      ["POST /users (corps invalide)", () => cds.post("/users", { role: "ADMIN" })],
      ["PATCH /pointages/:id (correction, inexistant)", () => cds.patch(`/pointages/${id}`, { quantity: 1, correctionReason: "recette E2E-S3 rbac" })],
      ["POST /activity-categories (corps invalide)", () => cds.post("/activity-categories", { label: "x" })],
      ["GET /reports/export", () => cds.get("/reports/export?type=pointages&month=2020-01&format=csv")],
    ];
    const wrong: string[] = [];
    for (const [label, call] of denied) {
      const res = await call();
      if (res.status !== 403) wrong.push(`${label} → HTTP ${res.status}`);
    }
    // La spécification laisse /reports/export à l'administrateur seulement : signalé ci-dessous s'il diffère.
    expect(wrong, "réponses attendues 403").toEqual([]);

    const ownSiteId = cds.user!.siteId; // GET /me renvoie HTTP 500 pour ce rôle : on utilise l'utilisateur renvoyé par le login
    const sites = await cds.get("/sites");
    expect(sites.body.data).toHaveLength(1);
    expect(sites.body.data[0].id).toBe(ownSiteId);
    const workers = await cds.getAllCursor<any>("/workers?take=100");
    expect(workers.length).toBeGreaterThan(0);
    expect(workers.every((w) => w.siteId === ownSiteId), "MOC hors site visibles").toBe(true);
  });

  test("chef d'équipe : 403 sur les routes Admin et de validation", async ({ apiOf }) => {
    const cde = await apiOf("cde_amb2");
    const id = newUuid();
    const denied: Array<[string, () => Promise<{ status: number }>]> = [
      ["GET /users", () => cde.get("/users")],
      ["GET /audit-log", () => cde.get("/audit-log")],
      ["GET /payments", () => cde.get("/payments?periodIso=S1")],
      ["PATCH /pointages/:id/validate (inexistant)", () => cde.patch(`/pointages/${id}/validate`)],
      ["PATCH /pointages/:id/reject (inexistant)", () => cde.patch(`/pointages/${id}/reject`, { rejectionReason: "recette" })],
      ["PATCH /pointages/:id (correction, inexistant)", () => cde.patch(`/pointages/${id}`, { quantity: 1, correctionReason: "recette E2E-S3 rbac" })],
      ["POST /biometric/check (MOC inexistant)", () => cde.post("/biometric/check", { workerId: id })],
      ["POST /teams (corps invalide)", () => cde.post("/teams", { name: "" })],
      ["POST /workers (corps invalide)", () => cde.post("/workers", { firstName: "x" })],
      ["GET /reports/preview", () => cde.get("/reports/preview?type=pointages&month=2020-01")],
    ];
    const wrong: string[] = [];
    for (const [label, call] of denied) {
      const res = await call();
      if (res.status !== 403) wrong.push(`${label} → HTTP ${res.status}`);
    }
    expect(wrong, "réponses attendues 403").toEqual([]);
  });

  test("isolation entre sites : AMB et ANJ ne partagent aucune donnée", async ({ apiOf }) => {
    const amb = await apiOf("cds_amb");
    const anj = await apiOf("cds_anj");
    expect(amb.user!.siteId).toBeTruthy();
    expect(amb.user!.siteId).not.toBe(anj.user!.siteId);
    const ambWorkers = await amb.getAllCursor<any>("/workers?take=100");
    const anjWorkers = await anj.getAllCursor<any>("/workers?take=100");
    const ambIds = new Set(ambWorkers.map((w) => w.id));
    expect(anjWorkers.some((w) => ambIds.has(w.id)), "MOC partagés entre sites").toBe(false);

    // Lecture directe d'un MOC de l'autre site : refusée ou introuvable
    const foreign = await amb.get(`/workers/${anjWorkers[0].id}`);
    expect(foreign.status, "un CDS lit un MOC d'un autre site").toBeGreaterThanOrEqual(400);
    // Pointages : uniquement ceux du site
    const ambPointages = await amb.getAllCursor<any>("/pointages", 4);
    expect(ambPointages.every((p) => ambIds.has(p.workerId)), "pointages hors site visibles").toBe(true);
    const cross = await amb.get(`/pointages?workerId=${anjWorkers[0].id}`);
    expect(cross.body.data).toHaveLength(0);
  });

  test("isolation UI : l'écran Pointages du chef de service n'affiche que son site", async ({ browser, apiOf }) => {
    const amb = await apiOf("cds_amb");
    const ambIds = new Set((await amb.getAllCursor<any>("/workers?take=100")).map((w) => w.id));
    const { ctx, page } = await loginInPage(browser, "cds_amb");
    try {
      const respPromise = page.waitForResponse((r) => /\/api\/v1\/pointages(\?|$)/.test(r.url()) && r.request().method() === "GET", { timeout: 30_000 });
      await spaVisit(page, "/pointages");
      const body = await (await respPromise).json();
      expect(body.data.every((p: any) => ambIds.has(p.workerId)), "pointages hors site affichés").toBe(true);
      await expect(heading(page, "Pointages")).toBeVisible();
    } finally {
      await ctx.close();
    }
  });
});

test.describe("Comptes inactifs et échecs de connexion (comptes E2E, 2 tentatives max)", () => {
  test("compte inactif : connexion refusée (API + écran de connexion)", async ({ admin, world, browser }) => {
    const email = `e2e-s3-inactive-${world.runId.toLowerCase()}-${Date.now().toString(36)}@alterra.test`;
    const created = await admin.post("/users", {
      email,
      role: "CHEF_EQUIPE",
      firstName: "E2E-S3-INACTIF",
      lastName: world.runId,
      siteId: world.site.id,
      active: false,
    });
    expectStatus(created, 201);
    track("user", created.body.user.id, email);
    const password = created.body.temporaryPassword as string;
    expect(created.body.user.active).toBe(false);

    const api = await ApiClient.rawLogin(email, password); // tentative n°1
    expect(api.status, "un compte inactif ne doit pas se connecter").toBe(401);
    expect(api.body.code).toBe("INVALID_CREDENTIALS");

    const ctx = await browser.newContext({ baseURL: ADMIN_URL });
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Se connecter" }).click(); // tentative n°2
    await expect(page.getByRole("alert")).toContainText("Email ou mot de passe incorrect.");
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });

  test("compte de démonstration inactif réel : 1 seule tentative", async () => {
    const res = await ApiClient.rawLogin(INACTIVE_ACCOUNT_EMAIL, usersPassword());
    expect(res.status, "BLOQUANT : le compte inactif auditeur.sprint2 peut se connecter").toBe(401);
  });

  test("mauvais mot de passe : message générique, puis connexion normale", async ({ admin, world, browser }) => {
    const email = `e2e-s3-wrongpw-${world.runId.toLowerCase()}-${Date.now().toString(36)}@alterra.test`;
    const created = await admin.post("/users", { email, role: "CHEF_EQUIPE", firstName: "E2E-S3-BADPW", lastName: world.runId, siteId: world.site.id });
    expectStatus(created, 201);
    track("user", created.body.user.id, email);
    const good = created.body.temporaryPassword as string;

    const ctx = await browser.newContext({ baseURL: ADMIN_URL });
    const page = await ctx.newPage();
    await page.goto("/login");
    await page.locator("#email").fill(email);
    await page.locator("#password").fill("Mauvais-mot-de-passe-1!");
    await page.getByRole("button", { name: "Se connecter" }).click(); // tentative n°1
    await expect(page.getByRole("alert")).toContainText("Email ou mot de passe incorrect.");
    await ctx.close();

    const api = await ApiClient.rawLogin(email, "Encore-faux-2!"); // tentative n°2
    expect(api.status).toBe(401);
    expect(api.body.code, "message identique pour compte inconnu et mot de passe faux").toBe("INVALID_CREDENTIALS");
    const ok = await ApiClient.rawLogin(email, good);
    expect(ok.status, "la connexion correcte reste possible après 2 échecs").toBe(200);
  });
});
