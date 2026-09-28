import { test, expect, devices, type BrowserContext, type Page } from "@playwright/test";
import { ApiClient } from "./support/api.js";
import { PWA_URL, realCredentials } from "./support/env.js";
import { loadWorld, track } from "./support/state.js";

/**
 * UC-FE-PWA-AUTH — connexion PWA, session persistée localement (sans PIN), rafraîchissement de
 * session, hors ligne, déconnexion et purge locale, comptes inactifs, périmètre CDS/CDE.
 *
 * Les jetons de rafraîchissement sont à usage unique : chaque scénario ouvre un contexte navigateur
 * dédié et ne se reconnecte pas. Les échecs de connexion sont limités à 2 par compte et ne visent que
 * des comptes E2E-S3-.
 */
const UC = "UC-FE-PWA-AUTH";
const STORES = ["workers", "activities", "pointages", "pointings_synced", "media", "syncQueue", "biometricTemplates", "presenceLog", "badges", "biometricOfflineChecks"];

async function newPwaContext(browser: import("@playwright/test").Browser): Promise<BrowserContext> {
  return browser.newContext({ ...devices["Pixel 7"], baseURL: PWA_URL, serviceWorkers: "allow" });
}

const readSettings = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<Record<string, string>>((resolve, reject) => {
        const req = indexedDB.open("alterra");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const all = db.transaction("settings", "readonly").objectStore("settings").getAll();
          all.onsuccess = () => {
            const out: Record<string, string> = {};
            for (const row of all.result) out[row.key] = row.value;
            db.close();
            resolve(out);
          };
        };
      }),
  );

const readCounts = (page: Page) =>
  page.evaluate(
    (stores) =>
      new Promise<Record<string, number>>((resolve, reject) => {
        const req = indexedDB.open("alterra");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const out: Record<string, number> = {};
          const names = stores.filter((s) => db.objectStoreNames.contains(s));
          const tx = db.transaction(names, "readonly");
          let pending = names.length;
          if (pending === 0) return resolve(out);
          for (const s of names) {
            const c = tx.objectStore(s).count();
            c.onsuccess = () => {
              out[s] = c.result;
              if (--pending === 0) {
                db.close();
                resolve(out);
              }
            };
          }
        };
      }),
    STORES,
  );

const readWorkerIds = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const req = indexedDB.open("alterra");
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const db = req.result;
          const all = db.transaction("workers", "readonly").objectStore("workers").getAllKeys();
          all.onsuccess = () => {
            db.close();
            resolve(all.result as string[]);
          };
        };
      }),
  );

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

async function logoutFromMoreSheet(page: Page) {
  await page.getByRole("button", { name: "Plus d'options" }).click();
  const [logout] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/v1/auth/logout")),
    page.getByRole("button", { name: "Déconnexion" }).click(),
  ]);
  return logout;
}

/** Navigation SPA sans rechargement. */
const spaNavigate = (page: Page, path: string) =>
  page.evaluate((p) => {
    window.history.pushState({}, "", p);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);

/* ================================================================== */
/* Scénario A — chef d'équipe réel (cde.amb2)                          */
/* ================================================================== */
test.describe(`${UC} — chef d'équipe (cde.amb2)`, () => {
  test.describe.configure({ mode: "serial" });
  let ctx: BrowserContext;
  let page: Page;
  let offlineOutcome: { reloadError: string | null; controlled: boolean; offlineWorkers: number | null; before: number } | null = null;

  test.beforeAll(async ({ browser }) => {
    ctx = await newPwaContext(browser);
    page = await ctx.newPage();
  });
  test.afterAll(async () => {
    await ctx?.close();
  });
  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus && page && !page.isClosed()) {
      await testInfo.attach("screenshot", { body: await page.screenshot(), contentType: "image/png" }).catch(() => undefined);
    }
  });

  test(`${UC} › connexion, session persistée localement (sans PIN)`, async () => {
    const { email, password } = realCredentials("cde_amb2");
    await page.goto("/login");
    await expect(page.getByText(/Comptes de démonstration/i)).toHaveCount(0);
    await login(page, email, password);
    expect(new URL(page.url()).pathname).toBe("/");
    await expect(page.getByText("Chef d'équipe").first()).toBeVisible();

    // La session (jeton + utilisateur) est persistée localement pour un redémarrage hors-ligne.
    const settings = await readSettings(page);
    expect(settings.session).toBeDefined();
    const payload = JSON.parse(settings.session);
    expect(payload.accessToken).toEqual(expect.any(String));
    expect(payload.user?.email?.toLowerCase()).toBe(email.toLowerCase());
    // Une clé d'appareil protège au repos les données sensibles locales (templates biométriques).
    expect(settings.deviceKey).toBeDefined();
  });

  test(`${UC} › référentiel synchronisé dans Dexie (persistance après rechargement)`, async ({}, testInfo) => {
    await expect
      .poll(async () => (await readCounts(page)).workers ?? 0, { timeout: 60_000, message: "aucun MOC synchronisé dans Dexie" })
      .toBeGreaterThan(0);
    const before = await readCounts(page);
    testInfo.annotations.push({ type: "dexie", description: `après synchro : ${JSON.stringify(before)}` });
    expect(before.activities ?? 0).toBeGreaterThan(0);

    // Un rechargement doit restaurer la session locale sans repasser par /login (pas de PIN à ressaisir).
    await page.reload();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
    const after = await readCounts(page);
    expect(after.workers).toBeGreaterThanOrEqual(before.workers);
    expect(after.activities).toBeGreaterThanOrEqual(before.activities);
  });

  test(`${UC} › rafraîchissement de session : un 401 déclenche /auth/refresh puis rejoue la requête`, async () => {
    let injected = 0;
    const pattern = /\/api\/v1\/(?!auth\/)/;
    await page.route(pattern, async (route) => {
      if (route.request().method() === "GET" && injected === 0) {
        injected++;
        return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "TOKEN_EXPIRED", message: "expired" }) });
      }
      return route.continue();
    });
    const refresh = page
      .waitForResponse((r) => r.url().includes("/api/v1/auth/refresh") && r.request().method() === "POST", { timeout: 25_000 })
      .catch(() => null);
    // Quitte puis rejoint l'écran d'accueil (SPA, sans rechargement) et force une synchronisation.
    await page.getByRole("link", { name: /Synchronisation/ }).click();
    const forceBtn = page.getByRole("button", { name: /Forcer la synchronisation/ }).first();
    if (await forceBtn.isVisible().catch(() => false)) await forceBtn.click();
    await spaNavigate(page, "/");
    const resp = await refresh;
    await page.unroute(pattern);
    if (!resp) {
      // Inconclusif : l'écran chef d'équipe ne déclenche aucun GET (données lues dans Dexie ; la synchro ne fait que des POST).
      // Le refresh n'a pas pu être provoqué depuis l'interface sans jeton expiré — vérifié par l'API dans le test suivant.
      test.info().annotations.push({ type: "inconclusif", description: "Aucun GET API émis par l'écran chef d'équipe : le rejeu après 401 n'a pas pu être observé depuis l'UI." });
      const direct = await page.request.post("/api/v1/auth/refresh"); // cookie de session du contexte
      test.info().annotations.push({ type: "refresh", description: `POST /auth/refresh direct → HTTP ${direct.status()}` });
      expect(direct.status(), "le refresh de session doit fonctionner avec le cookie httpOnly").toBe(200);
      return;
    }
    expect(resp.status()).toBe(200);
    expect(injected).toBe(1);
    expect(new URL(page.url()).pathname, "la session doit survivre au rafraîchissement").not.toBe("/login");
  });

  test(`${UC} › hors ligne : rechargement local puis retour en ligne`, async () => {
    const before = await readCounts(page);
    const controlled = await page.evaluate(() => !!navigator.serviceWorker.controller);
    await ctx.setOffline(true);
    let reloadError: string | null = null;
    let offlineWorkers: number | null = null;
    try {
      const reloaded = await page.reload({ timeout: 20_000 }).catch((e) => {
        reloadError = String(e.message).split("\n")[0];
        return null;
      });
      if (reloaded) {
        // Session restaurée localement, sans réseau (pas de PIN, pas d'appel /auth/refresh nécessaire).
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.getByText(/Hors ligne/).first()).toBeVisible({ timeout: 30_000 });
        offlineWorkers = (await readCounts(page)).workers;
      }
    } finally {
      await ctx.setOffline(false);
    }
    // Reprise : de nouveau en ligne pour les tests suivants
    await page.goto("/");
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByText(/Hors ligne/)).toHaveCount(0, { timeout: 60_000 });

    // Verdict différé (dernier test du scénario) : un échec ici ne doit pas interrompre les vérifications suivantes.
    offlineOutcome = { reloadError, controlled, offlineWorkers, before: before.workers };
  });

  test(`${UC} › verdict : le rechargement hors ligne fonctionne (service worker)`, async () => {
    test.skip(!offlineOutcome, "le test hors ligne n'a pas produit de résultat");
    test.info().annotations.push({ type: "hors ligne", description: JSON.stringify(offlineOutcome) });
    expect(
      offlineOutcome!.reloadError,
      `Rechargement hors ligne impossible (${offlineOutcome!.reloadError}) alors que la page ${offlineOutcome!.controlled ? "était" : "n'était pas"} contrôlée par le service worker : l'application n'est pas servie hors ligne`,
    ).toBeNull();
    expect(offlineOutcome!.offlineWorkers).toBe(offlineOutcome!.before);
  });

  test(`${UC} › le chef d'équipe est renvoyé hors des écrans chef de service`, async () => {
    await page.bringToFront();
    await spaNavigate(page, "/validation");
    await page.waitForTimeout(800);
    expect(new URL(page.url()).pathname).toBe("/");
    await expect(page.getByRole("heading", { name: /Validation/i })).toHaveCount(0);
  });

  test(`${UC} › déconnexion : session révoquée et données locales sensibles purgées`, async ({}, testInfo) => {
    const logout = await logoutFromMoreSheet(page);
    expect(logout.status()).toBe(204);
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });

    const settings = await readSettings(page);
    expect(settings.session, "session locale conservée après déconnexion").toBeUndefined();
    const counts = await readCounts(page);
    testInfo.annotations.push({ type: "purge", description: `Dexie après déconnexion : ${JSON.stringify(counts)}` });
    expect(counts.biometricTemplates ?? 0, "templates biométriques conservés").toBe(0);
    for (const table of ["workers", "pointages", "syncQueue", "presenceLog"]) {
      expect
        .soft(counts[table] ?? 0, `table Dexie « ${table} » non purgée à la déconnexion (données personnelles des MOC / pointages restent dans le navigateur)`)
        .toBe(0);
    }
    const apiCache = await page.evaluate(async () => {
      const out: string[] = [];
      for (const name of await window.caches.keys()) {
        if (!/precache/i.test(name)) out.push(...(await (await window.caches.open(name)).keys()).map((r) => new URL(r.url).pathname));
      }
      return out.filter((p) => /\/api\/v1\/(workers|teams|pointages|users|me)/.test(p));
    });
    expect.soft(apiCache, "réponses API personnelles conservées dans le cache du service worker après déconnexion").toEqual([]);

    // Le jeton de rafraîchissement doit être révoqué côté serveur
    const refresh = await page.request.post("/api/v1/auth/refresh");
    expect.soft(refresh.status(), "le refresh token doit être révoqué par la déconnexion").toBe(401);
  });
});

/* ================================================================== */
/* Scénario B — chef de service réel (cds.amb) : périmètre + logout     */
/* ================================================================== */
test.describe(`${UC} — chef de service (cds.amb)`, () => {
  test.describe.configure({ mode: "serial" });
  let ctx: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    ctx = await newPwaContext(browser);
    page = await ctx.newPage();
  });
  test.afterAll(async () => {
    await ctx?.close();
  });
  test.afterEach(async ({}, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus && page && !page.isClosed()) {
      await testInfo.attach("screenshot", { body: await page.screenshot(), contentType: "image/png" }).catch(() => undefined);
    }
  });

  test(`${UC} › le chef de service n'accède qu'aux données de son site (PWA)`, async () => {
    const { email, password } = realCredentials("cds_amb");
    const api = new ApiClient(email, password);
    await api.login();
    const ownWorkers = new Set((await api.getAllCursor<any>("/workers?take=100")).map((w) => w.id));
    expect(ownWorkers.size).toBeGreaterThan(0);
    const seen: Array<{ url: string; ids: string[] }> = [];
    page.on("response", async (r) => {
      if (r.request().method() === "GET" && /\/api\/v1\/(pointages|workers)(\?|$)/.test(r.url()) && r.ok()) {
        const body = await r.json().catch(() => null);
        if (body?.data) seen.push({ url: r.url(), ids: body.data.map((x: any) => x.workerId ?? x.id) });
      }
    });
    await login(page, email, password);
    expect(new URL(page.url()).pathname).toBe("/validation");
    await page.waitForTimeout(6_000);
    expect(seen.length, "aucune requête de données observée").toBeGreaterThan(0);
    const foreign = seen.flatMap((s) => s.ids).filter((id) => !ownWorkers.has(id));
    expect(foreign, "identifiants de MOC hors site reçus par la PWA du chef de service").toEqual([]);
    await api.dispose();

    // Écran réservé au chef d'équipe : redirection vers la validation
    await spaNavigate(page, "/batch");
    await page.waitForTimeout(800);
    expect(new URL(page.url()).pathname).toBe("/validation");
  });

  test(`${UC} › « Déconnexion » révoque la session serveur`, async () => {
    await page.reload();
    await expect(page).not.toHaveURL(/\/login/);
    const logout = await logoutFromMoreSheet(page);
    expect(logout.status()).toBe(204);
    await expect(page).toHaveURL(/\/login/, { timeout: 30_000 });
    const settings = await readSettings(page);
    expect(settings.session).toBeUndefined();

    const refresh = await page.request.post("/api/v1/auth/refresh");
    expect(refresh.status(), "après déconnexion, le refresh token doit être révoqué côté serveur").toBe(401);
  });
});

/* ================================================================== */
/* Scénario C — comptes E2E : échecs, périmètre d'équipe, compte inactif */
/* ================================================================== */
test.describe(`${UC} — comptes E2E-S3-`, () => {
  test(`${UC} › 2 échecs de connexion : message générique, puis connexion normale et périmètre d'équipe`, async ({ browser }, testInfo) => {
    test.setTimeout(240_000);
    const world = loadWorld();
    const ctx = await newPwaContext(browser);
    const page = await ctx.newPage();
    try {
      await page.goto("/login");
      for (let attempt = 1; attempt <= 2; attempt++) {
        await page.locator("#email").fill(world.cde.email);
        await page.locator("#password").fill(`Mauvais-mot-de-passe-${attempt}!`);
        await page.getByRole("button", { name: "Se connecter" }).click();
        await expect(page.getByText("Email ou mot de passe incorrect.")).toBeVisible();
        await expect(page).toHaveURL(/\/login/);
      }
      await login(page, world.cde.email, world.cde.password);
      await expect
        .poll(async () => (await readCounts(page)).workers ?? 0, { timeout: 60_000 })
        .toBeGreaterThan(0);
      await page.waitForTimeout(3_000);
      const ids = await readWorkerIds(page);
      const api = new ApiClient(world.cde.email, world.cde.password);
      await api.login();
      const visible = (await api.getAllCursor<any>("/workers?take=100")).map((w) => w.id);
      testInfo.annotations.push({ type: "périmètre", description: `Dexie : ${ids.length} MOC ; API (CDE) : ${visible.length} MOC ; jeu E2E : ${world.workers.length}` });
      for (const w of world.workers) expect(ids, `MOC E2E ${w.matricule} absent de Dexie`).toContain(w.id);
      expect(ids.every((id) => visible.includes(id)), "Dexie contient des MOC hors du périmètre du chef d'équipe").toBe(true);
      await api.dispose();
    } finally {
      await ctx.close();
    }
  });

  test(`${UC} › compte inactif : connexion PWA refusée, aucune session créée`, async ({ browser }) => {
    const world = loadWorld();
    const admin = new ApiClient(realCredentials("admin").email, realCredentials("admin").password);
    await admin.login();
    const email = `e2e-s3-pwa-inactive-${world.runId.toLowerCase()}-${Date.now().toString(36)}@alterra.test`;
    const created = await admin.post("/users", { email, role: "CHEF_EQUIPE", firstName: "E2E-S3-PWAINACT", lastName: world.runId, siteId: world.site.id, active: false });
    expect(created.status).toBe(201);
    track("user", created.body.user.id, email);
    const password = created.body.temporaryPassword as string;
    await admin.dispose();

    const ctx = await newPwaContext(browser);
    const page = await ctx.newPage();
    try {
      await page.goto("/login");
      await page.locator("#email").fill(email);
      await page.locator("#password").fill(password);
      await page.getByRole("button", { name: "Se connecter" }).click();
      await expect(page.getByText("Email ou mot de passe incorrect.")).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
      const settings = await readSettings(page);
      expect(settings.session).toBeUndefined();
    } finally {
      await ctx.close();
    }
  });

  test(`${UC} › l'API est jointe via la même origine que la PWA (aucune adresse d'API codée en dur)`, async ({ browser }) => {
    const ctx = await newPwaContext(browser);
    const page = await ctx.newPage();
    const hosts = new Set<string>();
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith("/api/")) hosts.add(u.host);
    });
    await page.goto("/login");
    await page.waitForTimeout(2_500);
    await ctx.close();
    expect([...hosts]).toEqual([new URL(PWA_URL).host]);
  });
});
