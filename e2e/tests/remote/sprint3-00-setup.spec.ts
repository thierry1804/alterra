import { execSync } from "node:child_process";
import { test, expect, request } from "@playwright/test";
import { ApiClient } from "./support/api.js";
import { ADMIN_URL, PWA_URL, E2E_PREFIX, realCredentials, usersPassword } from "./support/env.js";
import {
  e2eName,
  isoWeekMonday,
  newRunId,
  randomDigits,
  randomLetters,
  saveWorld,
  sha1,
  track,
  writeTmp,
  type World,
} from "./support/state.js";
import { expectStatus, foreignPaymentsForWeek } from "./support/helpers.js";

test.describe.configure({ mode: "serial" });

async function snapshotFront(baseURL: string) {
  const ctx = await request.newContext({ baseURL });
  const index = await ctx.get("/");
  const html = await index.text();
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]);
  const sw = await ctx.get("/sw.js");
  const swBody = sw.ok() ? await sw.body() : Buffer.from("");
  const info = {
    baseURL,
    indexStatus: index.status(),
    lastModified: index.headers()["last-modified"] ?? null,
    etag: index.headers()["etag"] ?? null,
    date: index.headers()["date"] ?? null,
    assets,
    serviceWorkerStatus: sw.status(),
    serviceWorkerHash: swBody.length ? sha1(swBody) : null,
  };
  await ctx.dispose();
  return info;
}

test("Sprint 3 — version déployée (lecture seule)", async () => {
  const head = (() => {
    try {
      return execSync('git log -1 --format="%H %cI"', { encoding: "utf8" }).trim();
    } catch {
      return "inconnu";
    }
  })();
  const info = {
    testedAt: new Date().toISOString(),
    localHead: head,
    admin: await snapshotFront(ADMIN_URL),
    pwa: await snapshotFront(PWA_URL),
  };
  writeTmp("deployed.json", JSON.stringify(info, null, 2));
  expect(info.admin.indexStatus).toBe(200);
  expect(info.pwa.indexStatus).toBe(200);
});

test("Sprint 3 — provisionnement du jeu de test E2E-S3-", async () => {
  test.setTimeout(300_000);
  usersPassword(); // échoue vite si la variable manque
  realCredentials("admin");

  const admin = new ApiClient(realCredentials("admin").email, realCredentials("admin").password);
  await admin.login(); // MfaRequiredError => arrêt explicite
  const me = await admin.get("/me");
  expectStatus(me, 200);
  expect(me.body.role).toBe("ADMIN");

  const runId = newRunId();

  /* ---- Semaine de paie vierge (les périodes sont qualifiées par l'année : les tests écrivent en 2090) ---- */
  // E2E_S3_SKIP_PAY=1 : n'écrit rien côté paiements (chaîne bordereau/export/import ignorée). Chaque exécution de la chaîne
  // consomme définitivement un numéro de semaine (paiements EXPORTED/PAID non supprimables par l'API).
  let pay: World["pay"] = null;
  const candidateWeeks = process.env.E2E_S3_SKIP_PAY === "1" ? [] : [46, 45, 44, 43, 42, 41, 40, 39, 38];
  for (const week of candidateWeeks) {
    const res = await admin.get(`/payments?periodIso=S${week}&referenceYear=2090`);
    expectStatus(res, 200);
    // L'export MVola ignore encore l'année : la semaine ne doit contenir AUCUN paiement réel, quelle que soit l'année.
    if ((res.body.data as unknown[]).length === 0 && (await foreignPaymentsForWeek(admin, week)) === 0) {
      const year = 2090;
      pay = {
        year,
        weekNumber: week,
        periodIso: `${year}-W${String(week).padStart(2, "0")}`,
        shortPeriod: `S${week}`,
        monday: isoWeekMonday(year, week),
      };
      break;
    }
  }

  /* ---- Site ---- */
  let site: World["site"] | undefined;
  for (let i = 0; i < 40 && !site; i++) {
    const code = randomLetters(3);
    const res = await admin.post("/sites", { name: e2eName(runId, "SITE"), shortCode: code, location: `${E2E_PREFIX}zone de test` });
    if (res.status === 201) {
      site = { id: res.body.id, code, name: res.body.name };
      track("site", site.id, site.name);
    } else expectStatus(res, 409);
  }
  expect(site, "Aucun code site libre trouvé").toBeTruthy();

  /* ---- Catégorie (code ACTnn pour respecter la grammaire du libellé MVola) + sous-activité ----
     Un code de catégorie n'est jamais réutilisable après désactivation : ACT90 à ACT99 sont épuisés (runs du
     20/09), la série ACT80 à ACT89 prend le relais. Prévoir une nouvelle série avant d'en manquer. */
  const units = await admin.get("/units?take=100");
  expectStatus(units, 200);
  const unit = ((units.body.data ?? units.body) as any[]).find((u) => u.active !== false);
  expect(unit, "Aucune unité active disponible").toBeTruthy();

  let category: World["category"] | undefined;
  for (let i = 0; i < 20 && !category; i++) {
    const code = `ACT8${randomDigits(1)}`;
    const res = await admin.post("/activity-categories", { code, label: e2eName(runId, "CAT") });
    if (res.status === 201) {
      category = { id: res.body.id, code };
      track("category", category.id, code);
    } else expectStatus(res, 409);
  }
  expect(category, "Aucun code catégorie libre").toBeTruthy();

  const subLabel = e2eName(runId, "ACT");
  const sub = await admin.post("/sub-activities", {
    categoryId: category!.id,
    label: subLabel,
    shortLabel: "Essai",
    unitId: unit.id,
    unitRate: 1000,
    siteId: site!.id,
  });
  expectStatus(sub, 201);
  track("subActivity", sub.body.id, subLabel);

  /* ---- Utilisateurs E2E (mots de passe aléatoires, jamais journalisés) ---- */
  // NB : la création avec un mot de passe explicite renvoie HTTP 500 (anomalie couverte par sprint3-users) ;
  // le jeu de test utilise donc le mot de passe temporaire généré par le serveur.
  async function createUser(role: "CHEF_SERVICE" | "CHEF_EQUIPE", tag: string) {
    const email = `e2e-s3-${tag}-${runId.toLowerCase()}@alterra.test`;
    const res = await admin.post("/users", {
      email,
      role,
      firstName: `${E2E_PREFIX}${tag.toUpperCase()}`,
      lastName: runId,
      siteId: site!.id,
    });
    expectStatus(res, 201);
    track("user", res.body.user.id, email);
    expect(res.body.temporaryPassword, "mot de passe temporaire absent de la réponse").toBeTruthy();
    return { id: res.body.user.id as string, email, password: res.body.temporaryPassword as string };
  }
  const cds = await createUser("CHEF_SERVICE", "cds");
  const cde = await createUser("CHEF_EQUIPE", "cde");

  /* ---- Équipe (création par le CDS E2E de son propre site) ---- */
  const cdsClient = new ApiClient(cds.email, cds.password);
  await cdsClient.login();
  const teamName = e2eName(runId, "TEAM");
  const team = await cdsClient.post("/teams", { name: teamName, chefId: cde.id });
  expectStatus(team, 201);
  track("team", team.body.id, teamName);
  await cdsClient.dispose();

  /* ---- Travailleurs (numéros MVola vérifiés inexistants) ---- */
  const workers: World["workers"] = [];
  for (let i = 1; i <= 3; i++) {
    let mvola = "";
    for (let attempt = 0; attempt < 30; attempt++) {
      const candidate = `0389${randomDigits(6)}`;
      const found = await admin.get(`/workers?q=${candidate}`);
      expectStatus(found, 200);
      if ((found.body.data as unknown[]).length === 0) {
        mvola = candidate;
        break;
      }
    }
    expect(mvola, "Aucun numéro MVola libre").toBeTruthy();
    const matricule = `${E2E_PREFIX}${runId}-W${i}`;
    const res = await admin.post("/workers", {
      matricule,
      firstName: `${E2E_PREFIX}W${i}`,
      lastName: runId,
      mvolaNumber: mvola,
      siteId: site!.id,
      teamId: team.body.id,
      hiredAt: "2026-01-01",
    });
    expectStatus(res, 201);
    track("worker", res.body.id, matricule);
    workers.push({ id: res.body.id, matricule, firstName: `${E2E_PREFIX}W${i}`, lastName: runId, mvolaNumber: mvola });
  }

  const world: World = {
    runId,
    site: site!,
    category: category!,
    unitId: unit.id,
    subActivity: { id: sub.body.id, groupKey: sub.body.groupKey, label: subLabel, shortLabel: "Essai", rate: 1000 },
    cds,
    cde,
    team: { id: team.body.id, name: teamName },
    workers,
    pay,
  };
  saveWorld(world);
  await admin.dispose();
  test.info().annotations.push({
    type: "semaine-paie",
    description: pay ? `${pay.periodIso} (${pay.shortPeriod}) vierge` : "AUCUNE semaine vierge : tests d'écriture du bordereau ignorés",
  });
});
