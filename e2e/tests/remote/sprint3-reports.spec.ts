import fs from "node:fs";
import { test, expect } from "./support/fixtures.js";
import { readXlsx } from "./support/helpers.js";
import { TMP_DIR_FILE, today } from "./support/state.js";
import { heading } from "./support/ui.js";

/**
 * UC-FE-ADM-REP — lecture seule : aperçus et exports (aucune mutation).
 * Les fichiers téléchargés (données personnelles) sont supprimés du disque à la fin de chaque test.
 */
const UC = "UC-FE-ADM-REP";
const REPORTS = [
  { type: "pointages", title: "Pointages mensuels" },
  { type: "payments", title: "Paiements mensuels" },
  { type: "presence-by-site", title: "Présence par site" },
] as const;
const month = today().slice(0, 7);

test.describe(`${UC} (rapports prédéfinis, aperçus)`, () => {
  for (const report of REPORTS) {
    test(`${UC} › aperçu « ${report.title} » cohérent avec l'API`, async ({ openAdmin }) => {
      const page = await openAdmin("admin");
      // Le rapport « pointages » est chargé d'office à l'ouverture de l'écran ; les autres au clic sur leur carte.
      const respPromise = page.waitForResponse(
        (r) => r.url().includes("/api/v1/reports/preview") && r.url().includes(`type=${report.type}`),
        { timeout: 30_000 },
      );
      await page.goto("/reports");
      await expect(heading(page, "Rapports")).toBeVisible();
      if (report.type !== "pointages") await page.getByRole("button", { name: new RegExp(report.title) }).click();
      const resp = await respPromise;
      expect(resp.status()).toBe(200);
      const preview = await resp.json();
      expect(preview.meta.type).toBe(report.type);
      await expect(page.getByRole("heading", { name: report.title })).toBeVisible();
      if (preview.meta.rowCount > 0) {
        await expect(page.getByText(`${preview.meta.rowCount} ligne(s)`)).toBeVisible();
        await expect(page.locator("tbody tr")).toHaveCount(preview.rows.length);
        await expect(page.locator("thead th")).toHaveCount(preview.columns.length);
      } else {
        await expect(page.getByText(/Aucune donnée pour/)).toBeVisible();
      }
    });
  }

  test(`${UC} › période sans donnée : état vide ; filtre site`, async ({ openAdmin, world }) => {
    const page = await openAdmin("admin");
    await page.goto("/reports");
    await expect(heading(page, "Rapports")).toBeVisible();
    await page.locator("#report-month").fill("2091-01");
    await expect(page.getByText(/Aucune donnée pour/)).toBeVisible({ timeout: 20_000 });

    await page.locator("#report-month").fill(month);
    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/v1/reports/preview") && r.url().includes(`siteId=${world.site.id}`)),
      page.locator("#report-site").selectOption(world.site.id),
    ]);
    expect(resp.status()).toBe(200);
    const preview = await resp.json();
    expect(preview.meta.siteId).toBe(world.site.id);
    expect(preview.rows.every((r: any) => !r.site || r.site === world.site.code || r.siteName === world.site.name)).toBe(true);
  });

  test(`${UC} › état d'erreur : message explicite attendu`, async ({ openAdmin }) => {
    const page = await openAdmin("admin");
    await page.route("**/api/v1/reports/preview**", (route) =>
      route.fulfill({ status: 500, json: { code: "INTERNAL_ERROR", message: "Unexpected server error" } }),
    );
    await page.goto("/reports");
    await expect(heading(page, "Rapports")).toBeVisible();
    await expect
      .soft(page.getByText(/erreur|échec|impossible|réessayer/i), "Aucun message d'erreur sur l'écran Rapports si l'API échoue")
      .toBeVisible();
  });
});

test.describe(`${UC} (exports)`, () => {
  test(`${UC} › export CSV, Excel et « PDF » du rapport Pointages`, async ({ openAdmin }) => {
    test.setTimeout(180_000);
    const page = await openAdmin("admin");
    await page.goto("/reports");
    const [previewResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/v1/reports/preview") && r.url().includes("type=pointages")),
      page.getByRole("button", { name: /Pointages mensuels/ }).click(),
    ]);
    const meta = (await previewResp.json()).meta;
    const files: string[] = [];
    try {
      // CSV
      const [csvDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "CSV", exact: true }).click()]);
      expect(csvDl.suggestedFilename()).toMatch(new RegExp(`^ALTERRA_pointages_${month}.*\\.csv$`));
      const csvPath = TMP_DIR_FILE(`rep-${Date.now()}.csv`);
      files.push(csvPath);
      await csvDl.saveAs(csvPath);
      const csvLines = fs.readFileSync(csvPath, "utf8").split(/\r?\n/).filter(Boolean);
      expect(csvLines.length - 1, "lignes CSV = lignes de l'aperçu").toBe(meta.rowCount);

      // Excel
      const [xlDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Excel", exact: true }).click()]);
      expect(xlDl.suggestedFilename()).toMatch(new RegExp(`^ALTERRA_pointages_${month}.*\\.xlsx$`));
      const xlPath = TMP_DIR_FILE(`rep-${Date.now()}.xlsx`);
      files.push(xlPath);
      await xlDl.saveAs(xlPath);
      const xlRows = await readXlsx(fs.readFileSync(xlPath));
      expect(xlRows.length - 1, "lignes Excel = lignes de l'aperçu").toBe(meta.rowCount);

      // PDF : le critère du backlog demande un PDF (via job) ; l'écran livre un fichier HTML « imprimable »
      const [pdfDl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "PDF", exact: true }).click()]);
      const name = pdfDl.suggestedFilename();
      const pdfPath = TMP_DIR_FILE(`rep-${Date.now()}-pdf`);
      files.push(pdfPath);
      await pdfDl.saveAs(pdfPath);
      const head = fs.readFileSync(pdfPath).subarray(0, 8).toString("latin1");
      expect.soft(name.endsWith(".pdf") && head.startsWith("%PDF"), `L'export « PDF » livre « ${name} » (${head.startsWith("%PDF") ? "PDF" : "HTML"}) : aucun vrai PDF ni job asynchrone`).toBe(true);
    } finally {
      for (const f of files) fs.rmSync(f, { force: true });
    }
  });
});
