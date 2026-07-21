import { defineConfig, devices } from "@playwright/test";

const adminBaseUrl = process.env.ADMIN_URL ?? "http://localhost:5173";
const pwaBaseUrl = process.env.PWA_URL ?? "http://localhost:5174";

const repoRoot = new URL("..", import.meta.url).pathname;

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html"]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "admin",
      testMatch: "**/admin-*.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        baseURL: adminBaseUrl,
      },
    },
    {
      name: "pwa",
      testMatch: ["**/cde-*.spec.ts", "**/cds-*.spec.ts", "**/offline-*.spec.ts"],
      use: {
        ...devices["Pixel 7"],
        baseURL: pwaBaseUrl,
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : [
        {
          command: "npm run dev -w backend",
          cwd: repoRoot,
          url: "http://localhost:3001/health",
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          env: {
            ...process.env,
            REDIS_IN_MEMORY: "true",
            NODE_ENV: "development",
          },
        },
        {
          command: "npm run dev -w admin",
          cwd: repoRoot,
          url: adminBaseUrl,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
        {
          command: "npm run dev -w pwa",
          cwd: repoRoot,
          url: pwaBaseUrl,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      ],
});
