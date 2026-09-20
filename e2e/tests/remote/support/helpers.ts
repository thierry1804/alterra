import { expect } from "@playwright/test";
import ExcelJS from "exceljs";
import type { ApiClient, ApiResult } from "./api.js";
import { newUuid, today, track } from "./state.js";
import type { World } from "./state.js";

/* ------------------------------------------------------------------ */
/* Audit                                                               */
/* ------------------------------------------------------------------ */

export interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  before: any;
  after: any;
  userEmail: string | null;
  createdAt: string;
}

/** Cherche les entrées d'audit d'une entité (poll court : l'écriture peut être asynchrone). */
export async function findAudit(
  admin: ApiClient,
  q: { entityType: string; entityId: string },
): Promise<AuditRow[]> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const found: AuditRow[] = [];
    for (let page = 1; page <= 5; page++) {
      const res = await admin.get(
        `/audit-log?entityType=${encodeURIComponent(q.entityType)}&dateFrom=${today()}&limit=100&page=${page}`,
      );
      if (!res.ok) throw new Error(`GET /audit-log → HTTP ${res.status}`);
      found.push(...(res.body.data as AuditRow[]).filter((r) => r.entityId === q.entityId));
      if (!res.body.hasMore) break;
    }
    if (found.length > 0) return found;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return [];
}

/** Vérifie qu'une mutation de test est tracée dans le journal (et, si demandé, avec l'action attendue). */
export async function expectAudit(
  admin: ApiClient,
  q: { entityType: string; entityId: string; action?: string | string[] },
): Promise<AuditRow[]> {
  const rows = await findAudit(admin, q);
  expect(rows.length, `Aucune entrée d'audit pour ${q.entityType} ${q.entityId}`).toBeGreaterThan(0);
  if (q.action) {
    const accepted = Array.isArray(q.action) ? q.action : [q.action];
    expect(
      rows.some((r) => accepted.includes(r.action)),
      `Audit ${q.entityType} ${q.entityId} : action attendue ${accepted.join("|")}, trouvées ${rows.map((r) => r.action).join(",")}`,
    ).toBe(true);
  }
  return rows;
}

/* ------------------------------------------------------------------ */
/* Aides métier (API)                                                  */
/* ------------------------------------------------------------------ */

export function expectStatus(res: ApiResult, ...statuses: number[]): void {
  expect(
    statuses,
    `HTTP ${res.status} ${JSON.stringify(res.body)?.slice(0, 300)}`,
  ).toContain(res.status);
}

/** Années « réelles » à protéger : l'export et le rapprochement MVola raisonnent (encore) sur le numéro de semaine seul. */
export const REAL_YEARS = [2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031];

/**
 * Nombre de paiements NON `E2E-S3-` portant ce numéro de semaine, toutes années réelles confondues.
 * Un serveur qui ignore `referenceYear` renvoie toutes les années à chaque appel : le résultat est alors plus prudent.
 */
export async function foreignPaymentsForWeek(admin: ApiClient, week: number, years: number[] = REAL_YEARS): Promise<number> {
  let foreign = 0;
  for (const year of years) {
    const res = await admin.get(`/payments?periodIso=S${week}&referenceYear=${year}`);
    expectStatus(res, 200);
    foreign += (res.body.data as any[]).filter((p) => !String(p.worker?.matricule ?? "").startsWith("E2E-S3-")).length;
  }
  return foreign;
}

export async function createPointages(
  cde: ApiClient,
  world: World,
  items: Array<{ workerId: string; quantity: number; date: string; subActivityId?: string }>,
) {
  const batch = items.map((i) => ({
    clientUuid: newUuid(),
    workerId: i.workerId,
    subActivityId: i.subActivityId ?? world.subActivity.id,
    quantity: i.quantity,
    date: `${i.date}T08:00:00.000Z`,
    notes: "E2E-S3 pointage de test",
    createdByClientAt: new Date().toISOString(),
  }));
  const res = await cde.post("/pointages/sync", { batch });
  expectStatus(res, 200);
  const results = res.body.results as Array<{ clientUuid: string; status: string; id?: string; reason?: string }>;
  results.forEach((r, i) => {
    if (r.id) track("pointage", r.id, `${items[i].workerId}@${items[i].date}`);
  });
  return { batch, results };
}

/** Rend le travailleur « bio OK » pour la semaine d'une date (contrôle serveur, repli hors-ligne). */
export async function setBio(
  admin: ApiClient,
  workerId: string,
  referenceDate: string,
  result: "OK" | "KO" = "OK",
): Promise<"check" | "offline"> {
  const referenceIso = `${referenceDate}T08:00:00.000Z`;
  if (result === "OK") {
    const res = await admin.post("/biometric/check", { workerId, referenceDate: referenceIso });
    if (res.status === 201 && res.body?.result === "OK") return "check";
  }
  const off = await admin.post("/biometric/check-offline", {
    clientUuid: newUuid(),
    workerId,
    result,
    score: result === "OK" ? 0.99 : 0.1,
    referenceDate: referenceIso,
    performedAt: new Date().toISOString(),
  });
  expectStatus(off, 200, 201);
  return "offline";
}

/* ------------------------------------------------------------------ */
/* Excel                                                               */
/* ------------------------------------------------------------------ */

export async function xlsxBuffer(rows: unknown[][], sheetName = "Feuille1"): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  rows.forEach((r) => ws.addRow(r));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function readXlsx(buffer: Buffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const ws = wb.worksheets[0];
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = (row.values as any[]).slice(1).map((v) => (v == null ? "" : String(v?.text ?? v)));
    rows.push(values);
  });
  return rows;
}
