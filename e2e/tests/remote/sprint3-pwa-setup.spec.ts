import { test, expect } from "@playwright/test";
import { PWA_URL } from "./support/env.js";
import { readJsonTmp } from "./support/state.js";

/**
 * UC-FE-PWA-SETUP — manifest, service worker Workbox, précache, cache offline, schéma Dexie.
 * Aucune connexion : uniquement la page de connexion publique de la PWA déployée.
 */
const UC = "UC-FE-PWA-SETUP";

test.describe(UC, () => {
  test(`${UC} › manifest servi, lié à la page et installable (contrôle CDP « installabilityErrors »)`, async ({ page, context }, testInfo) => {
    await page.goto("/login");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(href, "lien <link rel=manifest> absent").toBeTruthy();
    const res = await page.request.get(href!);
    expect(res.status()).toBe(200);
    const manifest = await res.json();
    expect(manifest.name || manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(["standalone", "fullscreen", "minimal-ui"]).toContain(manifest.display);
    expect(manifest.theme_color).toBeTruthy();
    const sizes = (manifest.icons as Array<{ sizes?: string; src: string; type?: string }>).map((i) => `${i.sizes}:${i.type ?? ""}`);
    testInfo.annotations.push({ type: "manifest", description: `display=${manifest.display} start_url=${manifest.start_url} icônes=${sizes.join(",")}` });
    expect(manifest.icons.length).toBeGreaterThan(0);

    const cdp = await context.newCDPSession(page);
    const { installabilityErrors } = (await cdp.send("Page.getInstallabilityErrors")) as { installabilityErrors: Array<{ errorId: string }> };
    const all = installabilityErrors.map((e) => `${e.errorId}${(e as any).errorArguments?.length ? ` ${JSON.stringify((e as any).errorArguments)}` : ""}`);
    // « in-incognito » vient du contexte de test Playwright (profil éphémère), pas de l'application.
    const ids = installabilityErrors.filter((e) => e.errorId !== "in-incognito").map((e) => e.errorId);
    testInfo.annotations.push({ type: "installabilité", description: all.length ? all.join(" | ") : "aucune erreur" });
    expect(ids, `la PWA n'est pas installable selon Chrome : ${all.join(" | ")}`).toEqual([]);
  });

  test(`${UC} › service worker enregistré, actif ; précache Workbox complet`, async ({ page }, testInfo) => {
    await page.goto("/login");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await expect
      .poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state ?? null), { timeout: 20_000 })
      .toBe("activated");
    const registration = await page.evaluate(async () => {
      const r = await navigator.serviceWorker.ready;
      return { scope: r.scope, state: r.active?.state ?? null, script: r.active?.scriptURL ?? null };
    });
    expect(registration.state).toBe("activated");
    expect(registration.scope).toBe(`${PWA_URL}/`);
    expect(registration.script).toMatch(/\/sw\.js$/);

    await page.reload(); // la page est désormais contrôlée par le service worker
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    const caches = await page.evaluate(async () => {
      const out: Record<string, string[]> = {};
      for (const name of await window.caches.keys()) {
        const cache = await window.caches.open(name);
        out[name] = (await cache.keys()).map((r) => new URL(r.url).pathname);
      }
      return out;
    });
    const precacheName = Object.keys(caches).find((n) => /precache/i.test(n));
    expect(precacheName, "aucun cache de précache Workbox").toBeTruthy();
    const precached = caches[precacheName!];
    expect(precached.some((p) => p === "/index.html" || p === "/")).toBe(true);
    expect(precached.filter((p) => p.endsWith(".js")).length).toBeGreaterThan(0);
    expect(precached.filter((p) => p.endsWith(".css")).length).toBeGreaterThan(0);
    testInfo.annotations.push({
      type: "précache",
      description: `${precached.length} entrées ; caches : ${Object.entries(caches).map(([n, k]) => `${n}(${k.length})`).join(", ")}`,
    });
    const deployed = readJsonTmp<any>("deployed.json");
    if (deployed) testInfo.annotations.push({ type: "version", description: `sw.js ${deployed.pwa.serviceWorkerHash} ; bundle ${deployed.pwa.assets.join(" ")}` });
  });

  test(`${UC} › assets servis par le service worker (cache-first) et cache API (network-first)`, async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state);
    await page.reload();
    const fromSw: string[] = [];
    page.on("response", (r) => {
      if (/\/assets\/.*\.(js|css)$/.test(r.url()) && r.fromServiceWorker()) fromSw.push(r.url());
    });
    await page.reload();
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
    expect(fromSw.length, "aucun asset JS/CSS servi par le service worker").toBeGreaterThan(0);

    const apiEntries = await page.evaluate(async () => {
      const names = await window.caches.keys();
      const out: string[] = [];
      for (const n of names.filter((x) => x === "api-cache")) {
        out.push(...(await (await window.caches.open(n)).keys()).map((r) => new URL(r.url).pathname));
      }
      return out;
    });
    expect.soft(apiEntries.some((p) => p.startsWith("/api/v1/")), "cache « api-cache » (network-first) vide après chargement de la page").toBe(true);
  });

  test(`${UC} › navigation hors ligne : l'application se recharge depuis le cache`, async ({ page, context }) => {
    await page.goto("/login");
    await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state);
    await page.reload();
    expect(await page.evaluate(() => !!navigator.serviceWorker.controller), "page non contrôlée par le service worker").toBe(true);
    await context.setOffline(true);
    const errors: string[] = [];
    try {
      const reload = await page.reload({ timeout: 20_000 }).catch((e) => {
        errors.push(`rechargement : ${String(e.message).split("\n")[0]}`);
        return null;
      });
      if (reload) {
        await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
        // URL profonde hors ligne : repli sur l'application (redirection vers la connexion)
        const deep = await page.goto("/validation", { timeout: 20_000 }).catch((e) => {
          errors.push(`URL profonde : ${String(e.message).split("\n")[0]}`);
          return null;
        });
        if (deep) await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
      }
    } finally {
      await context.setOffline(false);
    }
    expect(errors, `Navigation hors ligne non servie par le service worker : ${errors.join(" ; ")}`).toEqual([]);
  });

  test(`${UC} › schéma Dexie complet (base « alterra »)`, async ({ page }) => {
    await page.goto("/login");
    await expect
      .poll(async () => page.evaluate(async () => (await indexedDB.databases()).some((d) => d.name === "alterra")), { timeout: 20_000 })
      .toBe(true);
    const info = await page.evaluate(
      () =>
        new Promise<{ version: number; stores: string[]; indexes: Record<string, string[]> }>((resolve, reject) => {
          const req = indexedDB.open("alterra");
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const db = req.result;
            const stores = Array.from(db.objectStoreNames);
            const indexes: Record<string, string[]> = {};
            const tx = db.transaction(stores, "readonly");
            for (const s of stores) indexes[s] = Array.from(tx.objectStore(s).indexNames);
            const version = db.version;
            db.close();
            resolve({ version, stores, indexes });
          };
        }),
    );
    for (const store of ["workers", "activities", "pointages", "syncQueue", "settings", "media", "pointings_synced"]) {
      expect(info.stores, `table Dexie « ${store} » absente`).toContain(store);
    }
    expect(info.indexes.pointages).toEqual(expect.arrayContaining(["workerId", "date", "status"]));
    expect(info.indexes.workers).toEqual(expect.arrayContaining(["teamId", "matricule"]));
  });

  test(`${UC} › écran de connexion PWA : aucun panneau de comptes de démonstration`, async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
    await expect(page.getByText(/Comptes de démonstration/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Utiliser" })).toHaveCount(0);
    await expect(page.locator("#password")).toHaveValue("");
    await expect(page.getByText("Chef de service — validation hebdomadaire, clôture journalière")).toBeVisible();
  });
});
