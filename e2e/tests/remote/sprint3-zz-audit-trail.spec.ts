import { test, expect } from "./support/fixtures.js";
import { loadRegistry, type RegistryKind } from "./support/state.js";

/**
 * Transverse — chaque mutation de test doit laisser une trace dans le journal d'audit.
 * S'exécute en dernier (ordre alphabétique) : tout ce que les autres specs ont créé est dans le registre.
 */
const ENTITY: Record<RegistryKind, string> = {
  site: "Site",
  category: "ActivityCategory",
  subActivity: "ActivitySubActivity",
  worker: "Worker",
  user: "User",
  team: "Team",
  pointage: "Pointage",
  payment: "Payment",
};

test("Transverse › toutes les entités créées par la recette sont tracées dans l'audit (API = source de l'écran Audit)", async ({ admin }) => {
  test.setTimeout(300_000);
  const registry = loadRegistry();
  expect(registry.length, "registre vide : aucune donnée créée ?").toBeGreaterThan(0);
  const byType = new Map<string, Set<string>>();
  for (const type of new Set(registry.map((e) => ENTITY[e.kind]))) {
    const ids = new Set<string>();
    for (let page = 1; page <= 40; page++) {
      const res = await admin.get(`/audit-log?entityType=${type}&limit=100&page=${page}`);
      expect(res.ok).toBe(true);
      for (const row of res.body.data as any[]) if (row.entityId) ids.add(row.entityId);
      if (!res.body.hasMore) break;
    }
    byType.set(type, ids);
  }
  const missing = registry.filter((e) => !byType.get(ENTITY[e.kind])!.has(e.id));
  const summary = [...new Set(registry.map((e) => e.kind))].map((kind) => {
    const all = registry.filter((e) => e.kind === kind);
    return `${kind}: ${all.length - missing.filter((m) => m.kind === kind).length}/${all.length} tracés`;
  });
  test.info().annotations.push({ type: "audit", description: summary.join(" ; ") });
  expect(
    missing.map((m) => `${m.kind}:${m.id}`),
    `Entités sans entrée d'audit (${summary.join(" ; ")})`,
  ).toEqual([]);
});
