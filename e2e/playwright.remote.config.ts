import { defineConfig, devices } from "@playwright/test";

/**
 * Recette distante Sprint 3 — environnement de démonstration déployé (jamais en local).
 *
 * Identifiants : lus uniquement dans process.env (ALTERRA_ADMIN_PASSWORD, ALTERRA_USERS_PASSWORD),
 * jamais écrits dans un fichier. Les jetons de rafraîchissement étant à usage unique (rotation),
 * un storageState réutilisable n'est pas possible : les sessions UI sont ouvertes une fois par
 * rôle et conservées en mémoire par le worker (voir tests/remote/support/fixtures.ts).
 *
 * Rejouer :  npm run test:remote -w e2e
 */
const adminBaseUrl = process.env.ALTERRA_ADMIN_URL ?? "https://alterra-admin.boss-etech.net";
const pwaBaseUrl = process.env.ALTERRA_PWA_URL ?? "https://alterra-pwa.boss-etech.net";

export default defineConfig({
  testDir: "./tests/remote",
  outputDir: "./test-results-remote",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report-remote", open: "never" }],
    ["json", { outputFile: "test-results-remote/results.json" }],
  ],
  use: {
    // Chrome installé sur le poste (aucun téléchargement de navigateur). E2E_S3_CHANNEL=chromium pour le Chromium de Playwright.
    channel: (process.env.E2E_S3_CHANNEL ?? "chrome") === "chromium" ? undefined : "chrome",
    // Traces désactivées globalement : elles enregistreraient le corps des requêtes de connexion (mots de passe).
    // Les specs UI démarrent leur propre trace APRÈS la connexion et ne la conservent qu'en cas d'échec
    // (fixtures.ts) ; les fichiers vont dans .remote-tmp/traces (ignoré par git).
    trace: "off",
    screenshot: "only-on-failure",
    video: "off",
    ignoreHTTPSErrors: false,
  },
  projects: [
    {
      name: "setup",
      testMatch: "**/sprint3-00-setup.spec.ts",
      teardown: "cleanup",
      use: { ...devices["Desktop Chrome"], baseURL: adminBaseUrl },
    },
    {
      name: "cleanup",
      testMatch: "**/sprint3-99-cleanup.spec.ts",
      use: { ...devices["Desktop Chrome"], baseURL: adminBaseUrl },
    },
    {
      name: "admin",
      dependencies: ["setup"],
      testMatch: [
        "**/sprint3-sites.spec.ts",
        "**/sprint3-activities.spec.ts",
        "**/sprint3-workers.spec.ts",
        "**/sprint3-users.spec.ts",
        "**/sprint3-pointages.spec.ts",
        "**/sprint3-pay.spec.ts",
        "**/sprint3-reports.spec.ts",
        "**/sprint3-audit.spec.ts",
        "**/sprint3-rbac.spec.ts",
        "**/sprint3-zz-audit-trail.spec.ts",
        "**/sprint3-zz-pay-format.spec.ts",
      ],
      use: { ...devices["Desktop Chrome"], baseURL: adminBaseUrl },
    },
    {
      name: "pwa",
      dependencies: ["setup"],
      testMatch: ["**/sprint3-pwa-setup.spec.ts", "**/sprint3-pwa-auth.spec.ts"],
      use: { ...devices["Pixel 7"], baseURL: pwaBaseUrl },
    },
  ],
});
