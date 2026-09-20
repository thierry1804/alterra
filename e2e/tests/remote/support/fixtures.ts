import path from "node:path";
import { test as base, expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { ApiClient, MfaRequiredError } from "./api.js";
import { ADMIN_URL, TMP_DIR, realCredentials, type RealRole } from "./env.js";
import { loadWorld, type World } from "./state.js";

export type Who = RealRole | "e2e_cds" | "e2e_cde";

function credentialsOf(who: Who, world: () => World): { email: string; password: string } {
  if (who === "e2e_cds") return world().cds;
  if (who === "e2e_cde") return world().cde;
  return realCredentials(who);
}

/** Connexion UI Admin (formulaire). S'arrête si un écran MFA apparaît. */
export async function uiLoginAdmin(ctx: BrowserContext, email: string, password: string): Promise<void> {
  const page = await ctx.newPage();
  try {
    await page.goto(`${ADMIN_URL}/login`);
    await page.locator("#email").fill(email);
    await page.locator("#password").fill(password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (await page.locator("#mfaCode").isVisible().catch(() => false)) throw new MfaRequiredError(email);
      if (!new URL(page.url()).pathname.startsWith("/login")) return;
      await page.waitForTimeout(250);
    }
    throw new Error(`Connexion UI Admin non aboutie pour ${email}`);
  } finally {
    await page.close();
  }
}

interface WorkerFixtures {
  world: World;
  apiOf: (who: Who) => Promise<ApiClient>;
  ctxOf: (who: Who) => Promise<BrowserContext>;
}

interface TestFixtures {
  admin: ApiClient;
  /** Ouvre une page Admin déjà authentifiée pour le rôle demandé (session UI conservée par le worker). */
  openAdmin: (who: Who) => Promise<Page>;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  world: [
    async ({}, use) => {
      await use(loadWorld());
    },
    { scope: "worker" },
  ],

  apiOf: [
    async ({ world }, use) => {
      const clients = new Map<Who, ApiClient>();
      await use(async (who) => {
        let client = clients.get(who);
        if (!client) {
          const { email, password } = credentialsOf(who, () => world);
          client = new ApiClient(email, password);
          await client.login();
          clients.set(who, client);
        }
        return client;
      });
      for (const c of clients.values()) await c.dispose();
    },
    { scope: "worker" },
  ],

  ctxOf: [
    async ({ browser, world }, use) => {
      const contexts = new Map<Who, BrowserContext>();
      await use(async (who) => {
        let ctx = contexts.get(who);
        if (!ctx) {
          const { email, password } = credentialsOf(who, () => world);
          // Contexte créé à la main : non tracé pendant la connexion (le mot de passe ne va dans aucune trace).
          ctx = await (browser as Browser).newContext({ baseURL: ADMIN_URL, viewport: { width: 1440, height: 900 } });
          await uiLoginAdmin(ctx, email, password);
          await ctx.tracing.start({ screenshots: true, snapshots: true });
          contexts.set(who, ctx);
        }
        return ctx;
      });
      for (const c of contexts.values()) await c.close();
    },
    { scope: "worker" },
  ],

  admin: async ({ apiOf }, use) => {
    await use(await apiOf("admin"));
  },

  openAdmin: async ({ ctxOf }, use, testInfo) => {
    const opened: Array<{ ctx: BrowserContext; page: Page }> = [];
    const traced = new Set<BrowserContext>();
    await use(async (who) => {
      const ctx = await ctxOf(who);
      if (!traced.has(ctx)) {
        await ctx.tracing.startChunk();
        traced.add(ctx);
      }
      const page = await ctx.newPage();
      opened.push({ ctx, page });
      return page;
    });
    const failed = testInfo.status !== testInfo.expectedStatus;
    for (const { page } of opened) {
      if (failed && !page.isClosed()) {
        await testInfo
          .attach("screenshot", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
          .catch(() => undefined);
      }
      await page.close().catch(() => undefined);
    }
    for (const ctx of traced) {
      const tracePath = path.join(TMP_DIR, "traces", `${testInfo.testId}.zip`);
      await ctx.tracing.stopChunk(failed ? { path: tracePath } : undefined).catch(() => undefined);
      if (failed) await testInfo.attach("trace", { path: tracePath, contentType: "application/zip" }).catch(() => undefined);
    }
  },
});

export { expect };
