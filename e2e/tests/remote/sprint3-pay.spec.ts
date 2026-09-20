import fs from "node:fs";
import ExcelJS from "exceljs";
import { test, expect } from "./support/fixtures.js";
import { createPointages, expectAudit, expectStatus, readXlsx, setBio, xlsxBuffer } from "./support/helpers.js";
import { addDays, randomDigits, stSave, track, TMP_DIR_FILE } from "./support/state.js";
import { expectToast, heading } from "./support/ui.js";
import type { ApiClient } from "./support/api.js";
import type { Page } from "@playwright/test";
import type { World } from "./support/state.js";

/** Lignes du bordereau : la page affiche aussi l'historique des exports, qui a ses propres `tbody tr`. */
const bordereauRows = (page: Page) => page.locator("table").first().locator("tbody tr");

/**
 * UC-FE-ADM-PAY-BORD / PAY-EXP / PAY-IMP — chaîne complète sur une SEMAINE DE PAIE VIERGE
 * (garde-fou : `periodIso` est stocké sous la forme S<n> sans année ; la génération supprime tous les paiements
 * PENDING de cette période). Si aucune semaine vierge n'a été trouvée par le setup, tout est ignoré.
 */
const BORD = "UC-FE-ADM-PAY-BORD";
const EXP = "UC-FE-ADM-PAY-EXP";
const IMP = "UC-FE-ADM-PAY-IMP";
const ALTERRA_ACCOUNT = "0382019280"; // compte émetteur des relevés MVola (constante métier du parseur)

test.describe.configure({ mode: "serial" });

async function guardWeek(admin: ApiClient, world: World) {
  const pay = world.pay!;
  const res = await admin.get(`/payments?periodIso=${pay.shortPeriod}&referenceYear=${pay.year}`);
  expectStatus(res, 200);
  const foreign = (res.body.data as any[]).filter((p) => !String(p.worker?.matricule ?? "").startsWith("E2E-S3-"));
  expect(foreign, `GARDE-FOU : la période ${pay.shortPeriod} contient des paiements non E2E — arrêt`).toHaveLength(0);
  return res.body.data as any[];
}

async function listMine(admin: ApiClient, world: World) {
  const rows = await guardWeek(admin, world);
  return rows.filter((p) => world.workers.some((w) => w.id === p.workerId));
}

async function gotoPayments(page: Page, world: World) {
  await page.goto("/payments");
  await expect(heading(page, "Paiements")).toBeVisible();
  await page.locator("#pay-period").fill(world.pay!.periodIso);
}

const state: { pointageIds: string[] } = { pointageIds: [] };

test.describe(`Paiements MVola — semaine vierge réservée`, () => {
  test.beforeEach(({ world }) => {
    test.skip(!world.pay, "Aucune semaine de paie vierge : écritures du bordereau ignorées (lecture seule).");
  });

  test(`${BORD} › préparation : pointages validés (bio OK) et garde-fou de période`, async ({ admin, apiOf, world }) => {
    test.setTimeout(240_000);
    await guardWeek(admin, world);
    const cde = await apiOf("e2e_cde");
    const cds = await apiOf("e2e_cds");
    const monday = world.pay!.monday;
    const plan = [
      { worker: world.workers[0], quantity: 4, date: monday }, // 4 000 Ar, bio OK
      { worker: world.workers[1], quantity: 2, date: addDays(monday, 1) }, // 2 000 Ar, bio OK
      { worker: world.workers[2], quantity: 1, date: addDays(monday, 2) }, // 1 000 Ar, bio KO à la génération
    ];
    const { results } = await createPointages(
      cde,
      world,
      plan.map((p) => ({ workerId: p.worker.id, quantity: p.quantity, date: p.date })),
    );
    for (const r of results) expect(r.status).toBe("created");
    state.pointageIds = results.map((r) => r.id!);

    // Bio OK pour la semaine, puis validation par le CDS du site E2E
    const modes = new Set<string>();
    for (const p of plan) modes.add(await setBio(admin, p.worker.id, monday, "OK"));
    test.info().annotations.push({ type: "biométrie", description: `contrôle bio obtenu via : ${[...modes].join(", ")}` });
    for (const id of state.pointageIds) {
      let res = await cds.patch(`/pointages/${id}/validate`);
      if (res.status >= 500) {
        // Constat : la validation par le CDS échoue en erreur serveur ; on valide avec l'admin pour poursuivre la chaîne.
        test.info().annotations.push({ type: "constat", description: `validation CDS → HTTP ${res.status}, repli sur validation admin` });
        res = await admin.patch(`/pointages/${id}/validate`);
      }
      expectStatus(res, 200);
      expect(res.body.status).toBe("VALIDATED");
    }
    // Le dernier contrôle bio du MOC 3 devient KO => ligne « bloquée bio » dans le bordereau
    await new Promise((r) => setTimeout(r, 1200));
    await setBio(admin, world.workers[2].id, monday, "KO");
    await guardWeek(admin, world);
  });

  test(`${BORD} › état vide, génération du bordereau, statut bio, régénération`, async ({ openAdmin, admin, world }) => {
    test.setTimeout(180_000);
    const page = await openAdmin("admin");
    const [listResp] = await Promise.all([
      page.waitForResponse((r) => /\/api\/v1\/payments\?/.test(r.url()) && r.request().method() === "GET"),
      gotoPayments(page, world),
    ]);
    void listResp;
    // Période vierge : état vide
    await expect(page.getByText("Aucune ligne pour cette période.")).toBeVisible({ timeout: 20_000 });

    const [gen] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/v1/payments/generate") && r.request().method() === "POST"),
      page.getByRole("button", { name: "Générer bordereau" }).click(),
    ]);
    expect(gen.status()).toBe(201);
    const generated = await gen.json();
    expect(generated.created).toBe(3);
    expect(generated.payments.filter((p: any) => p.bioValid)).toHaveLength(2);
    await expectToast(page, "Bordereau généré");

    const rows = bordereauRows(page);
    await expect(rows).toHaveCount(3, { timeout: 20_000 });
    const mine = await listMine(admin, world);
    expect(mine).toHaveLength(3);
    for (const p of mine) track("payment", p.id, `${world.pay!.shortPeriod}:${p.worker.matricule}`);
    const byWorker = new Map(mine.map((p: any) => [p.workerId, p]));

    // Montants, description MVola, bordereau, statut bio
    const p1 = byWorker.get(world.workers[0].id)!;
    const p2 = byWorker.get(world.workers[1].id)!;
    const p3 = byWorker.get(world.workers[2].id)!;
    expect(Number(p1.amount)).toBe(4000);
    expect(Number(p2.amount)).toBe(2000);
    expect(Number(p3.amount)).toBe(1000);
    expect(p1.bioValid).toBe(true);
    expect(p2.bioValid).toBe(true);
    expect(p3.bioValid).toBe(false);
    for (const p of mine) {
      expect(p.status).toBe("PENDING");
      expect(p.description).toContain(`S${world.pay!.weekNumber}`);
      expect(p.description).toContain(world.site.code);
      expect(p.description).toContain(world.category.code);
      expect(p.description).toContain("ESSAI");
    }
    const row3 = rows.filter({ hasText: world.workers[2].mvolaNumber });
    await expect(row3).toContainText("NON");
    await expect(row3).toContainText("En attente");
    await expect(rows.filter({ hasText: world.workers[0].mvolaNumber })).toContainText(/4\D?000/);
    await expect(page.getByText("Exportables (bio OK)").locator("..")).toContainText("2");
    await expect(page.getByText("Bloquées bio").locator("..")).toContainText("1");

    // Régénération : les lignes PENDING sont remplacées (mêmes 3 lignes, nouveaux identifiants)
    const oldIds = new Set(mine.map((p: any) => p.id));
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/v1/payments/generate")),
      page.getByRole("button", { name: "Générer bordereau" }).click(),
    ]);
    await expect(rows).toHaveCount(3);
    const again = await listMine(admin, world);
    expect(again).toHaveLength(3);
    for (const p of again) track("payment", p.id, `${world.pay!.shortPeriod}:${p.worker.matricule}`);
    test.info().annotations.push({
      type: "constat",
      description: `Régénération : identifiants de lignes ${again.every((p: any) => !oldIds.has(p.id)) ? "tous remplacés" : "conservés"} (suppression + recréation des lignes PENDING).`,
    });

    // Traçabilité : la génération de bordereau doit apparaître dans le journal
    await expectAudit(admin, { entityType: "Payment", entityId: again[0].id });
  });

  test(`${BORD} › correction inline du montant avec motif obligatoire`, async ({ openAdmin, admin, world }) => {
    test.setTimeout(180_000);
    const page = await openAdmin("admin");
    await gotoPayments(page, world);
    const row = bordereauRows(page).filter({ hasText: world.workers[1].mvolaNumber });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.getByRole("button", { name: "Corriger le montant" }).click();
    await row.locator('input[type="number"]').fill("2500");
    const ok = row.getByRole("button", { name: "OK", exact: true });
    await row.getByPlaceholder("Motif (min. 10 car.)").fill("court");
    await expect(ok).toBeDisabled(); // 10 caractères requis
    await row.getByPlaceholder("Motif (min. 10 car.)").fill("Ajustement recette E2E-S3");
    await expect(ok).toBeEnabled();
    const [patch] = await Promise.all([
      page.waitForResponse((r) => /\/api\/v1\/payments\/[0-9a-f-]{36}$/.test(r.url()) && r.request().method() === "PATCH"),
      ok.click(),
    ]);
    expect(patch.status()).toBe(200);
    await expectToast(page, "Montant corrigé");
    await expect(bordereauRows(page).filter({ hasText: world.workers[1].mvolaNumber })).toContainText(/2\D?500/);

    const mine = await listMine(admin, world);
    const p2 = mine.find((p: any) => p.workerId === world.workers[1].id)!;
    expect(Number(p2.amount)).toBe(2500);
    expect(Number(p2.originalAmount)).toBe(2000);
    expect(p2.correctionReason).toContain("Ajustement recette");

    // Serveur : montant nul et motif court refusés
    expectStatus(await admin.patch(`/payments/${p2.id}`, { amount: 0, correctionReason: "motif suffisamment long" }), 400, 422);
    expectStatus(await admin.patch(`/payments/${p2.id}`, { amount: 2500, correctionReason: "court" }), 400, 422);
    const audit = await expectAudit(admin, { entityType: "Payment", entityId: p2.id });
    expect(audit.length).toBeGreaterThan(0);
  });

  test(`${EXP} › export MVola : téléchargement, en-têtes, contenu vérifié colonne par colonne`, async ({ openAdmin, admin, world }) => {
    test.setTimeout(180_000);
    const page = await openAdmin("admin");
    await gotoPayments(page, world);
    await expect(bordereauRows(page)).toHaveCount(3, { timeout: 20_000 });
    await page.getByLabel("Inclure l'en-tête").check();

    const exportBtn = page.getByRole("button", { name: "Export MVola" });
    await expect(exportBtn).toBeEnabled();
    const [download, resp] = await Promise.all([
      page.waitForEvent("download"),
      page.waitForResponse((r) => r.url().includes(`/api/v1/payments/${world.pay!.shortPeriod}/export`)),
      exportBtn.click(),
    ]).then(([d, r]) => [d, r] as const);
    expect(resp.status()).toBe(200);
    expect(resp.headers()["x-alterra-exported-count"]).toBe("2");
    expect(resp.headers()["x-alterra-excluded-count"]).toBe("1"); // ligne bio KO exclue (RG-03)
    expect(download.suggestedFilename()).toMatch(new RegExp(`^ALTERRA_MVola_${world.pay!.shortPeriod}_\\d{8}_\\d{4}\\.xlsx$`));
    await expectToast(page, "Export MVola terminé");

    const file = TMP_DIR_FILE(`export-${world.runId}.xlsx`);
    await download.saveAs(file);
    const buffer = fs.readFileSync(file);
    const rows = await readXlsx(buffer);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    expect(wb.worksheets).toHaveLength(1);
    expect(wb.worksheets[0].name).toBe("Paiements");

    // Contenu : 1 en-tête + 2 lignes (MOC 1 et 2), pas le MOC 3 (bio KO)
    const mine = await listMine(admin, world);
    const byWorker = new Map(mine.map((p: any) => [p.workerId, p]));
    const body = rows.slice(1);
    expect(body).toHaveLength(2);
    const phones = body.map((r) => r[0]);
    expect(phones).toContain(world.workers[0].mvolaNumber);
    expect(phones).toContain(world.workers[1].mvolaNumber);
    expect(phones).not.toContain(world.workers[2].mvolaNumber);
    for (const r of body) {
      const w = world.workers.find((x) => x.mvolaNumber === r[0])!;
      const p = byWorker.get(w.id)!;
      expect(r[1], `description ligne ${w.matricule}`).toBe(p.description);
      const amountCol = r.length === 3 ? r[2] : r[3];
      expect(Number(amountCol), `montant ligne ${w.matricule}`).toBe(Math.round(Number(p.amount)));
    }
    // Numéro de téléphone stocké en texte (zéro initial préservé)
    expect(wb.worksheets[0].getRow(2).getCell(1).numFmt).toBe("@");

    // Écart avec docs/cadrage/mvola-format.md §3.2 (5 colonnes A–E) : constaté dans sprint3-zz-pay-format.spec.ts
    // (test indépendant, pour ne pas interrompre la chaîne export → import).
    stSave("pay-format", { header: rows[0], columns: rows[0].length });

    // Statuts après export
    const after = await listMine(admin, world);
    for (const w of [world.workers[0], world.workers[1]]) {
      const p = after.find((x: any) => x.workerId === w.id);
      expect(p.status).toBe("EXPORTED");
      expect(p.exportedAt).toBeTruthy();
    }
    expect(after.find((x: any) => x.workerId === world.workers[2].id).status).toBe("PENDING");
    await expect(bordereauRows(page).filter({ hasText: world.workers[0].mvolaNumber })).toContainText("Exporté");
    await expect(exportBtn).toBeDisabled(); // plus aucune ligne exportable
    await expect(bordereauRows(page).filter({ hasText: world.workers[0].mvolaNumber }).getByRole("button", { name: "Corriger le montant" })).toHaveCount(0);

    // Historique / audit de l'export
    const exportAudit = await admin.get("/audit-log?entityType=Payment&action=EXPORT&limit=5");
    expect(exportAudit.body.data.length).toBeGreaterThan(0);
    expect(JSON.stringify(exportAudit.body.data[0].after)).toContain(".xlsx");
  });

  test(`${EXP} › règles après export : nouvel export, régénération et correction refusés`, async ({ admin, world }) => {
    const again = await admin.get(`/payments/${world.pay!.shortPeriod}/export?referenceYear=${world.pay!.year}`);
    expect(again.status).toBe(422);
    expect(again.body?.code ?? JSON.parse(Buffer.from(again.body).toString()).code).toBe("NO_EXPORTABLE_PAYMENTS");
    const regen = await admin.post("/payments/generate", { periodIso: world.pay!.periodIso, referenceYear: world.pay!.year });
    expect(regen.status).toBe(409);
    expect(regen.body.code).toBe("PAY_CONFLICT");
    const mine = await listMine(admin, world);
    const exported = mine.find((p: any) => p.status === "EXPORTED");
    const edit = await admin.patch(`/payments/${exported.id}`, { amount: 1234, correctionReason: "Correction après export refusée" });
    expect(edit.status).toBe(422);
    expect(edit.body.code).toBe("PAYMENT_NOT_EDITABLE");
  });

  const HEADER = ["Date - heure", "Référence", "Initiateur", "Destinataire", "Type de transaction", "Description", "Montant"];
  const PREAMBLE = [["Relevé MVola — recette E2E-S3"], ["Compte", ALTERRA_ACCOUNT], ["Période", "E2E"], [], [], []];

  function releve(rows: string[][]) {
    return xlsxBuffer([...PREAMBLE, HEADER, ...rows], "Relevé");
  }

  test(`${IMP} › import : relevé sans rapprochement possible => paiements « non confirmés »`, async ({ admin, world }) => {
    const orphan = await releve([
      ["2090-12-20 09:00:00", `9${randomDigits(10)}`, ALTERRA_ACCOUNT, `0389${randomDigits(6)}`, "Transfert d'argent",
        `Inconnu Essai S${world.pay!.weekNumber} 99 ${world.site.code.toLowerCase()}`, "- 1000.00"],
    ]);
    const res = await admin.post("/payments/import-status", { contentBase64: orphan.toString("base64"), hasHeaderRow: true });
    expectStatus(res, 200);
    expect(res.body.orphelin).toBe(1);
    expect(res.body.nonConfirme).toBe(2); // les 2 paiements exportés de la semaine ne figurent pas dans le relevé
    expect(res.body.confirme).toBe(0);
  });

  test(`${IMP} › import : fichier mal formé ou colonnes manquantes`, async ({ openAdmin, admin }) => {
    const garbage = await admin.post("/payments/import-status/columns", {
      contentBase64: Buffer.from("pas un classeur").toString("base64"),
      hasHeaderRow: true,
    });
    // Constat consigné pour sprint3-zz-pay-format.spec.ts (test indépendant : n'interrompt pas la chaîne).
    stSave("pay-import-garbage", { status: garbage.status });
    test.info().annotations.push({ type: "constat", description: `fichier non Excel envoyé à /payments/import-status/columns → HTTP ${garbage.status}` });

    const noAmount = await xlsxBuffer([[...PREAMBLE[0]], [], [], [], [], [], HEADER.slice(0, 6), ["2090-12-20 10:00:00", "1", ALTERRA_ACCOUNT, "0389", "Transfert d'argent", "x"]]);
    const page = await openAdmin("admin");
    await page.goto("/payments");
    await expect(heading(page, "Paiements")).toBeVisible();
    await page.getByRole("button", { name: "Import retour MVola" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator('input[type="file"]').setInputFiles({ name: "sans-montant.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: noAmount });
    await expect(dialog.getByText(/Champs obligatoires à associer/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Prévisualiser le rapprochement" })).toBeDisabled();
    await page.keyboard.press("Escape");
    // Mauvaise extension
    await page.getByRole("button", { name: "Import retour MVola" }).click();
    await page.getByRole("dialog").locator('input[type="file"]').setInputFiles({ name: "releve.csv", mimeType: "text/csv", buffer: Buffer.from("a;b") });
    await expectToast(page, "Format invalide");
  });

  test(`${IMP} › import du relevé : confirmé, écart de montant, orphelin, frais, ignoré, interne`, async ({ openAdmin, admin, world }) => {
    test.setTimeout(180_000);
    const mine = await listMine(admin, world);
    const p1 = mine.find((p: any) => p.workerId === world.workers[0].id)!;
    const p2 = mine.find((p: any) => p.workerId === world.workers[1].id)!;
    const ref1 = `9${randomDigits(10)}`;
    const ref2 = `9${randomDigits(10)}`;
    const refOrphan = `9${randomDigits(10)}`;
    const refFee = `9${randomDigits(10)}`;
    const refIn = `9${randomDigits(10)}`;
    const refInternal = `9${randomDigits(10)}`;
    const file = await releve([
      ["2090-12-20 10:00:00", ref1, ALTERRA_ACCOUNT, world.workers[0].mvolaNumber, "Transfert d'argent", p1.description, "- 4000.00"], // confirmé
      ["2090-12-20 10:01:00", ref2, ALTERRA_ACCOUNT, world.workers[1].mvolaNumber, "Transfert d'argent", p2.description, "- 2400.00"], // écart (attendu 2 500)
      ["2090-12-20 10:02:00", refOrphan, ALTERRA_ACCOUNT, `0389${randomDigits(6)}`, "Transfert d'argent", `Inconnu Essai S${world.pay!.weekNumber} 99 ${world.site.code.toLowerCase()}`, "- 800.00"], // orphelin
      ["2090-12-20 10:03:00", refFee, ALTERRA_ACCOUNT, world.workers[0].mvolaNumber, `Frais de transfert réf ${ref1}`, "", "- 100.00"], // frais rattachés
      ["2090-12-20 10:04:00", refIn, "0340000000", ALTERRA_ACCOUNT, "Dépôt d'argent", "Approvisionnement", "50000.00"], // ignoré
      ["2090-12-20 10:05:00", refInternal, ALTERRA_ACCOUNT, "0341112223", "Transfert d'argent", "Loyer bureau", "- 20000.00"], // interne
    ]);

    const page = await openAdmin("admin");
    await gotoPayments(page, world);
    await page.getByRole("button", { name: "Import retour MVola" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.locator('input[type="file"]').setInputFiles({ name: "releve-e2e.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: file });
    await expect(dialog.getByText("Associez chaque champ requis à une colonne du relevé.")).toBeVisible();
    await expect(dialog.locator('input[type="number"]')).toHaveValue("7"); // ligne d'en-tête détectée
    // 1) Aperçu : le rapprochement est calculé mais rien n'est écrit
    const [preview] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/v1/payments/import-status") && !r.url().includes("/columns") && r.request().method() === "POST"),
      dialog.getByRole("button", { name: "Prévisualiser le rapprochement" }).click(),
    ]);
    expect(preview.status()).toBe(200);
    expect(preview.request().postDataJSON().dryRun).toBe(true);
    const previewResult = await preview.json();
    expect(previewResult.confirme).toBe(1);
    await expect(dialog.getByText(/Aperçu : rien n'est encore enregistré/)).toBeVisible();
    const untouched = await listMine(admin, world);
    expect(untouched.find((p: any) => p.workerId === world.workers[0].id)!.status, "l'aperçu ne doit rien écrire").toBe("EXPORTED");

    // 2) Confirmation : le rapprochement est enregistré
    const [imp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/v1/payments/import-status") && !r.url().includes("/columns") && r.request().method() === "POST"),
      dialog.getByRole("button", { name: "Confirmer et enregistrer" }).click(),
    ]);
    expect(imp.status()).toBe(200);
    expect(imp.request().postDataJSON().dryRun).toBe(false);
    const result = await imp.json();
    expect(result.confirme).toBe(1);
    expect(result.ecartMontant).toBe(1);
    expect(result.orphelin).toBe(1);
    expect(result.nonConfirme).toBe(0);
    expect(result.fraisRattaches).toBe(1);
    expect(result.internal).toBe(1);
    expect(result.ignored).toBe(1);
    expect(result.dejaTraite).toBe(0);
    await expectToast(page, "Rapprochement enregistré");
    await expect(dialog.getByText("Confirmés", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Écarts de montant — revue manuelle")).toBeVisible();
    await page.keyboard.press("Escape");

    // Effets sur les paiements
    const after = await listMine(admin, world);
    const a1 = after.find((p: any) => p.workerId === world.workers[0].id)!;
    const a2 = after.find((p: any) => p.workerId === world.workers[1].id)!;
    expect(a1.status).toBe("PAID");
    expect(a1.paidAt).toBeTruthy();
    expect(a2.status, "l'écart de montant laisse le paiement EXPORTED").toBe("EXPORTED");
    await expect(bordereauRows(page).filter({ hasText: world.workers[0].mvolaNumber })).toContainText("Payé");
    // Le bordereau expose le statut de rapprochement et la référence MVola
    expect((a2 as any).reconciliationStatus, "statut de rapprochement exposé par GET /payments").toBe("ECART_MONTANT");
    expect((a1 as any).reconciliationStatus).toBe("CONFIRME");
    expect((a1 as any).mvolaReference, "référence MVola exposée").toBeTruthy();
    await expect(bordereauRows(page).filter({ hasText: world.workers[1].mvolaNumber })).toContainText("Écart de montant");

    // Idempotence : réimporter le même relevé => références déjà traitées
    const replay = await admin.post("/payments/import-status", { contentBase64: file.toString("base64"), hasHeaderRow: true });
    expectStatus(replay, 200);
    expect(replay.body.dejaTraite).toBe(2);
    expect(replay.body.confirme).toBe(0);

    // Échec explicite : motif obligatoire, réservé aux paiements exportés non payés
    expectStatus(await admin.patch(`/payments/${a2.id}/fail`, { failureReason: "court" }), 400, 422);
    expectStatus(await admin.patch(`/payments/${a1.id}/fail`, { failureReason: "paiement déjà exécuté, échec refusé" }), 422);
    const failed = await admin.patch(`/payments/${a2.id}/fail`, { failureReason: "Virement non exécuté par MVola (recette)" });
    expectStatus(failed, 200);
    expect(failed.body.status).toBe("FAILED");
  });
});
