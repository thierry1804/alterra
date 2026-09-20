import { test, expect } from "./support/fixtures.js";
import {
  createPointages,
  expectStatus,
  foreignPaymentsForWeek,
  setBio,
  xlsxBuffer,
} from "./support/helpers.js";
import { addDays, isoWeekMonday, randomDigits, track } from "./support/state.js";

/**
 * UC-FE-ADM-PAY-EXP / PAY-IMP — portée par année de l'export et du rapprochement MVola.
 *
 * Les périodes de paie sont désormais qualifiées par l'année (`Payment.referenceYear`) pour la génération, la liste et le
 * verrou. Ce test vérifie que l'EXPORT et le RAPPROCHEMENT le sont aussi : un même numéro de semaine existe en 2090 et en
 * 2091 (données 100 % E2E-S3-) ; exporter ou rapprocher 2090 ne doit rien changer à 2091.
 *
 * Garde-fou : la semaine choisie ne contient aucun paiement réel, quelle que soit l'année (2024 à 2031), car tant que
 * l'export ignore l'année il pourrait embarquer des lignes réelles du même numéro de semaine.
 * Le rapprochement est lu en aperçu (`dryRun`) : aucune écriture.
 */
const HEADER = ["Date - heure", "Référence", "Initiateur", "Destinataire", "Type de transaction", "Description", "Montant"];
const PREAMBLE = [["Relevé MVola — recette E2E-S3-"], ["Compte", "0382019280"], ["Période", "E2E"], [], [], []];

test("UC-FE-ADM-PAY-EXP › l'export d'une année n'embarque pas les lignes des autres années ; le rapprochement ne marque pas « non confirmés » les paiements d'une autre année", async ({
  admin,
  apiOf,
  world,
}, testInfo) => {
  test.setTimeout(300_000);
  test.skip(process.env.E2E_S3_SKIP_PAY === "1", "E2E_S3_SKIP_PAY=1 : aucune écriture de paiement");

  /* ---- Semaine sans aucun paiement, ni réel (2024–2031) ni de test (2090, 2091) ---- */
  const avoid = world.pay?.weekNumber;
  let week = 0;
  for (const candidate of [36, 35, 34, 33, 32, 31, 30, 29, 28, 45, 44, 43, 42, 41, 40, 39, 38]) {
    if (candidate === avoid) continue;
    const empty90 = ((await admin.get(`/payments?periodIso=S${candidate}&referenceYear=2090`)).body.data as unknown[]).length === 0;
    const empty91 = ((await admin.get(`/payments?periodIso=S${candidate}&referenceYear=2091`)).body.data as unknown[]).length === 0;
    if (empty90 && empty91 && (await foreignPaymentsForWeek(admin, candidate)) === 0) {
      week = candidate;
      break;
    }
  }
  test.skip(week === 0, "Aucune semaine libre dans toutes les années : test ignoré (aucune écriture).");
  const wk = String(week).padStart(2, "0");
  const years = [2090, 2091] as const;
  testInfo.annotations.push({ type: "semaine", description: `S${week} en 2090 et 2091 (données E2E-S3- uniquement)` });

  /* ---- Pointages validés (bio OK) puis bordereau, pour chaque année ---- */
  const cde = await apiOf("e2e_cde");
  const cds = await apiOf("e2e_cds");
  const [w0, w1] = world.workers;
  for (const year of years) {
    const monday = isoWeekMonday(year, week);
    const { results } = await createPointages(cde, world, [
      { workerId: w0.id, quantity: 3, date: monday },
      { workerId: w1.id, quantity: 2, date: addDays(monday, 1) },
    ]);
    for (const r of results) expect(r.status).toBe("created");
    await setBio(admin, w0.id, monday, "OK");
    await setBio(admin, w1.id, addDays(monday, 1), "OK");
    for (const r of results) {
      let res = await cds.patch(`/pointages/${r.id}/validate`);
      if (res.status >= 500) res = await admin.patch(`/pointages/${r.id}/validate`);
      expectStatus(res, 200);
    }
    const gen = await admin.post("/payments/generate", { periodIso: `${year}-W${wk}`, referenceYear: year });
    expectStatus(gen, 201);
    expect(gen.body.created, `bordereau ${year}-W${wk}`).toBe(2);
  }

  const list = async (year: number) => {
    const res = await admin.get(`/payments?periodIso=S${week}&referenceYear=${year}`);
    expectStatus(res, 200);
    return res.body.data as any[];
  };
  const rows90 = await list(2090);
  const rows91 = await list(2091);
  expect(rows90).toHaveLength(2);
  expect(rows91).toHaveLength(2);
  for (const p of [...rows90, ...rows91]) track("payment", p.id, `S${week}:${p.worker.matricule}`);
  const ids91 = new Set(rows91.map((p) => p.id));

  /* ---- Export de 2090 seulement ---- */
  const exp = await admin.get(`/payments/S${week}/export?referenceYear=2090`);
  expectStatus(exp, 200);
  const exportedCount = Number(exp.headers["x-alterra-exported-count"]);
  const after91 = await list(2091);
  const statuses91 = after91.map((p) => p.status).join(",");
  testInfo.annotations.push({
    type: "export",
    description: `export S${week}/2090 → ${exportedCount} ligne(s) exportée(s) ; statuts 2091 après l'export : ${statuses91}`,
  });

  // Quoi qu'il arrive, on exporte 2091 pour disposer de lignes EXPORTED dans les deux années (test du rapprochement)
  const exp91 = await admin.get(`/payments/S${week}/export?referenceYear=2091`);
  expect([200, 422]).toContain(exp91.status);

  /* ---- Rapprochement en aperçu : un relevé qui ne confirme qu'un paiement de 2090 ---- */
  const p90 = (await list(2090)).find((p) => p.workerId === w0.id)!;
  const releve = await xlsxBuffer(
    [
      ...PREAMBLE,
      HEADER,
      ["2090-12-20 10:00:00", `9${randomDigits(10)}`, "0382019280", w0.mvolaNumber, "Transfert d'argent", p90.description, `- ${Math.round(Number(p90.amount))}.00`],
    ],
    "Relevé",
  );
  const preview = await admin.post("/payments/import-status", { contentBase64: releve.toString("base64"), hasHeaderRow: true, dryRun: true });
  expectStatus(preview, 200);
  const nonConfirmes = (preview.body.nonConfirmes as Array<{ paymentId: string }>).map((n) => n.paymentId);
  const crossYear = nonConfirmes.filter((id) => ids91.has(id));
  testInfo.annotations.push({
    type: "rapprochement",
    description: `aperçu : confirmé ${preview.body.confirme}, non confirmés ${preview.body.nonConfirme} dont ${crossYear.length} de l'année 2091`,
  });
  expect(preview.body.confirme, "le paiement de 2090 confirmé par le relevé").toBe(1);

  /* ---- Verdicts (les deux sont évalués même si le premier échoue) ---- */
  expect
    .soft(
      { exportedCount, statuses91 },
      "EXPORT : l'export de S" + week + " demandé pour 2090 a aussi exporté les lignes de 2091 (mvola-export.service.ts filtre sur periodIso sans referenceYear)",
    )
    .toEqual({ exportedCount: 2, statuses91: "PENDING,PENDING" });
  expect
    .soft(
      crossYear,
      "RAPPROCHEMENT : un relevé de la semaine " + week + " marque « non confirmés » des paiements exportés d'une autre année (mvola-reconciliation.service.ts raisonne sur le numéro de semaine seul)",
    )
    .toEqual([]);
});
