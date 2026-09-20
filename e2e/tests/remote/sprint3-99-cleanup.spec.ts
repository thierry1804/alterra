import { test } from "@playwright/test";
import { ApiClient } from "./support/api.js";
import { E2E_PREFIX, realCredentials } from "./support/env.js";
import { loadRegistry, worldExists, loadWorld, writeTmp } from "./support/state.js";

/**
 * Teardown du projet `setup` : s'exécute même si des tests ont échoué.
 * Désactive / rejette uniquement les entités dont le libellé commence par E2E-S3-
 * (registre + balayage par préfixe). Les pointages et paiements ne sont pas supprimables
 * par l'API : ils restent et sont listés avec leur statut. Les entrées d'audit restent.
 */
test("Sprint 3 — nettoyage des données E2E-S3-", async () => {
  test.setTimeout(300_000);
  // Uniquement pour itérer pendant l'écriture des specs : E2E_S3_KEEP=1 garde le jeu de test entre deux lancements.
  test.skip(process.env.E2E_S3_KEEP === "1", "E2E_S3_KEEP=1 : nettoyage différé");
  const admin = new ApiClient(realCredentials("admin").email, realCredentials("admin").password);
  await admin.login();

  const report: Record<string, any> = {
    at: new Date().toISOString(),
    sites: [],
    categories: [],
    subActivities: [],
    workers: [],
    users: [],
    teams: [],
    pointages: [],
    payments: [],
    errors: [] as string[],
  };
  const note = (msg: string) => (report.errors as string[]).push(msg);
  const isE2E = (s?: string | null) => !!s && s.startsWith(E2E_PREFIX);

  /* ---- Équipes (désactivation) ---- */
  for (const entry of loadRegistry().filter((e) => e.kind === "team")) {
    const res = await admin.patch(`/teams/${entry.id}`, { active: false });
    report.teams.push({ id: entry.id, name: entry.label, state: res.ok ? "désactivée" : `échec HTTP ${res.status}` });
    if (!res.ok) note(`team ${entry.id}: HTTP ${res.status} ${JSON.stringify(res.body)?.slice(0, 120)}`);
  }

  /* ---- Travailleurs E2E : pointages en attente rejetés, puis suppression logique ---- */
  const workersRes = await admin.getAllCursor<any>(`/workers?q=${encodeURIComponent(E2E_PREFIX)}&take=100`);
  const e2eWorkers = workersRes.filter((w) => isE2E(w.firstName) || isE2E(w.matricule));

  /* ---- Semaines de paie touchées : neutraliser les lignes PENDING E2E (sinon un export réel les embarquerait) ---- */
  const periods = new Set<string>(
    loadRegistry()
      .filter((e) => e.kind === "payment")
      .map((e) => e.label.split(":")[0])
      .filter((l) => /^S\d+$/.test(l)),
  );
  if (worldExists()) {
    const w = loadWorld();
    if (w.pay) periods.add(w.pay.shortPeriod);
  }
  report.paymentPeriods = [];
  for (const shortPeriod of periods) {
    const res = await admin.get(`/payments?periodIso=${shortPeriod}&referenceYear=2090`);
    if (!res.ok) {
      note(`période ${shortPeriod}: lecture impossible (HTTP ${res.status})`);
      continue;
    }
    const rows = res.body.data as any[];
    if (rows.some((p) => !isE2E(p.worker?.matricule))) {
      report.paymentPeriods.push({ shortPeriod, state: "paiements non E2E présents : neutralisation ignorée" });
      note(`période ${shortPeriod}: paiements non E2E présents — lignes E2E laissées en l'état`);
      continue;
    }
    if (rows.some((p) => p.status !== "PENDING")) {
      report.paymentPeriods.push({ shortPeriod, state: "verrouillée (EXPORTED/PAID) : lignes E2E conservées, lignes PENDING restantes non exportables (bio KO)" });
      continue;
    }
    if (rows.length === 0) {
      report.paymentPeriods.push({ shortPeriod, state: "déjà vide" });
      continue;
    }
    // Rejette les pointages VALIDATED E2E de l'année de test, puis régénère : les lignes PENDING E2E disparaissent
    for (const worker of e2eWorkers) {
      const pts = await admin.getAllCursor<any>(`/pointages?workerId=${worker.id}`);
      for (const p of pts.filter((x) => x.status === "VALIDATED" && String(x.date).startsWith("2090"))) {
        await admin.patch(`/pointages/${p.id}/reject`, { rejectionReason: "E2E-S3 nettoyage de la recette" });
      }
    }
    const n = Number(shortPeriod.slice(1));
    const gen = await admin.post("/payments/generate", { periodIso: `2090-W${String(n).padStart(2, "0")}`, referenceYear: 2090 });
    report.paymentPeriods.push({ shortPeriod, state: gen.ok ? `neutralisée (${gen.body.created} ligne(s) restante(s))` : `échec HTTP ${gen.status}` });
    if (!gen.ok) note(`période ${shortPeriod}: régénération de neutralisation refusée (HTTP ${gen.status})`);
  }

  for (const worker of e2eWorkers) {
    const pts = await admin.getAllCursor<any>(`/pointages?workerId=${worker.id}`);
    for (const p of pts) {
      let status = p.status as string;
      if (status === "PENDING" || status === "NEEDS_CLARIFICATION") {
        const rej = await admin.patch(`/pointages/${p.id}/reject`, { rejectionReason: "E2E-S3 nettoyage de la recette" });
        status = rej.ok ? "REJECTED (nettoyage)" : `${status} (rejet impossible, HTTP ${rej.status})`;
      }
      report.pointages.push({ id: p.id, workerMatricule: worker.matricule, status });
    }
  }
  for (const worker of e2eWorkers) {
    const res = await admin.delete(`/workers/${worker.id}`);
    report.workers.push({ id: worker.id, matricule: worker.matricule, state: res.ok ? "supprimé (logique)" : `échec HTTP ${res.status}` });
    if (!res.ok) note(`worker ${worker.id}: HTTP ${res.status}`);
  }

  /* ---- Paiements résiduels (non supprimables) ---- */
  for (const shortPeriod of periods) {
    for (const year of [2090, 2091]) {
      const res = await admin.get(`/payments?periodIso=${shortPeriod}&referenceYear=${year}`);
      if (res.ok) {
        for (const p of res.body.data as any[]) {
          if (isE2E(p.worker?.matricule)) {
            report.payments.push({ id: p.id, period: `${shortPeriod}/${year}`, matricule: p.worker.matricule, status: p.status, bioValid: p.bioValid, amount: p.amount });
          }
        }
      }
    }
  }

  /* ---- Sous-activités (toutes versions) et catégories ---- */
  const subs = await admin.getAllCursor<any>("/sub-activities?take=100&history=true");
  for (const s of subs.filter((s) => isE2E(s.label))) {
    if (s.active === false) {
      report.subActivities.push({ id: s.id, label: s.label, state: "déjà inactive" });
      continue;
    }
    const res = await admin.delete(`/sub-activities/${s.id}`);
    report.subActivities.push({ id: s.id, label: s.label, state: res.ok ? "désactivée" : `échec HTTP ${res.status}` });
    if (!res.ok) note(`sub-activity ${s.id}: HTTP ${res.status}`);
  }
  const cats = await admin.getAllCursor<any>("/activity-categories?take=100");
  for (const c of cats.filter((c) => isE2E(c.label))) {
    if (c.active === false) {
      report.categories.push({ id: c.id, label: c.label, code: c.code, state: "déjà inactive" });
      continue;
    }
    const res = await admin.delete(`/activity-categories/${c.id}`);
    report.categories.push({ id: c.id, label: c.label, code: c.code, state: res.ok ? "désactivée" : `échec HTTP ${res.status}` });
    if (!res.ok) note(`category ${c.id}: HTTP ${res.status}`);
  }

  /* ---- Utilisateurs (désactivation) ---- */
  const users = await admin.getAllCursor<any>("/users?take=100");
  for (const u of users.filter((u) => isE2E(u.firstName) || (u.email ?? "").startsWith("e2e-s3-"))) {
    if (u.active === false) {
      report.users.push({ id: u.id, email: u.email, state: "déjà inactif" });
      continue;
    }
    const res = await admin.post(`/users/${u.id}/deactivate`);
    report.users.push({ id: u.id, email: u.email, state: res.ok ? "désactivé" : `échec HTTP ${res.status}` });
    if (!res.ok) note(`user ${u.id}: HTTP ${res.status}`);
  }

  /* ---- Sites (désactivation) ---- */
  const sites = await admin.get("/sites");
  for (const s of (sites.body.data as any[]).filter((s) => isE2E(s.name))) {
    if (s.active === false) {
      report.sites.push({ id: s.id, name: s.name, code: s.shortCode, state: "déjà inactif" });
      continue;
    }
    const res = await admin.delete(`/sites/${s.id}`);
    report.sites.push({ id: s.id, name: s.name, code: s.shortCode, state: res.ok ? "désactivé" : `échec HTTP ${res.status}` });
    if (!res.ok) note(`site ${s.id}: HTTP ${res.status}`);
  }

  writeTmp("cleanup.json", JSON.stringify(report, null, 2));
  await admin.dispose();
  if ((report.errors as string[]).length > 0) {
    throw new Error(`Nettoyage incomplet :\n${(report.errors as string[]).join("\n")}`);
  }
});
