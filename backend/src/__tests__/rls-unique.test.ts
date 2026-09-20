import { Role } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { basePrisma, prisma } from "../lib/prisma.js";
import { mergeUniqueWhere, runWithRequestContext } from "../middleware/prisma-rls.js";

// Les requêtes Prisma sont paresseuses : elles doivent être attendues DANS le contexte de requête,
// sinon la portée (AsyncLocalStorage) est perdue et le test ne prouve rien.
function scoped<T>(ctx: Parameters<typeof runWithRequestContext>[0], fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(ctx, fn);
}


describe("mergeUniqueWhere", () => {
  it("garde la clé unique au premier niveau et ajoute la portée dans AND", () => {
    expect(mergeUniqueWhere({ id: "a" }, { siteId: "s" })).toEqual({ id: "a", AND: [{ siteId: "s" }] });
  });

  it("n'écrase pas un champ de même nom que la portée (équipe : { id: teamId })", () => {
    expect(mergeUniqueWhere({ id: "t1" }, { id: "t2" })).toEqual({ id: "t1", AND: [{ id: "t2" }] });
  });

  it("conserve un AND existant", () => {
    expect(mergeUniqueWhere({ id: "a", AND: [{ x: 1 }] }, { y: 2 })).toEqual({ id: "a", AND: [{ x: 1 }, { y: 2 }] });
  });

  it("retourne la portée seule quand il n'y a pas de where", () => {
    expect(mergeUniqueWhere(undefined, { siteId: "s" })).toEqual({ siteId: "s" });
  });
});

/**
 * Régression A1/A2/A3 (recette Sprint 3) : les lectures par clé unique (`GET /me`, rejeu de synchro,
 * validation) plantaient en 500 pour les rôles à portée. Ces tests interrogent le vrai client étendu,
 * en lecture seule ; ils sont ignorés si la base ne contient pas de compte à portée avec des données.
 */
describe("lectures par clé unique avec portée (base réelle, lecture seule)", () => {
  it("CHEF_SERVICE : findUniqueOrThrow sur son propre compte et sur un pointage de son site", async () => {
    const cds = await basePrisma.user.findFirst({
      where: { role: Role.CHEF_SERVICE, active: true, deletedAt: null, siteId: { not: null } },
    });
    if (!cds?.siteId) return;
    const ctx = { userId: cds.id, role: Role.CHEF_SERVICE, siteId: cds.siteId, teamId: cds.teamId };

    const me = await scoped(ctx, async () => await prisma.user.findUniqueOrThrow({ where: { id: cds.id } }));
    expect(me.id).toBe(cds.id);

    const inSite = await basePrisma.pointage.findFirst({ where: { worker: { siteId: cds.siteId } } });
    if (inSite) {
      const found = await scoped(ctx, async () => await prisma.pointage.findUniqueOrThrow({ where: { id: inSite.id } }));
      expect(found.id).toBe(inSite.id);
      const byUuid = await scoped(ctx, async () => await prisma.pointage.findUnique({ where: { clientUuid: inSite.clientUuid } }));
      expect(byUuid?.id).toBe(inSite.id);
    }

    const elsewhere = await basePrisma.pointage.findFirst({ where: { worker: { siteId: { not: cds.siteId } } } });
    if (elsewhere) {
      const hidden = await scoped(ctx, async () => await prisma.pointage.findUnique({ where: { id: elsewhere.id } }));
      expect(hidden).toBeNull();
    }
  });

  it("CHEF_EQUIPE : findUniqueOrThrow sur son propre compte et sur une équipe", async () => {
    const cde = await basePrisma.user.findFirst({
      where: { role: Role.CHEF_EQUIPE, active: true, deletedAt: null, teamId: { not: null } },
    });
    if (!cde?.teamId) return;
    const ctx = { userId: cde.id, role: Role.CHEF_EQUIPE, siteId: cde.siteId, teamId: cde.teamId };

    const me = await scoped(ctx, async () => await prisma.user.findUniqueOrThrow({ where: { id: cde.id } }));
    expect(me.id).toBe(cde.id);

    const team = await scoped(ctx, async () => await prisma.team.findUnique({ where: { id: cde.teamId! } }));
    expect(team?.id).toBe(cde.teamId);

    const other = await basePrisma.team.findFirst({ where: { id: { not: cde.teamId } } });
    if (other) {
      const hidden = await scoped(ctx, async () => await prisma.team.findUnique({ where: { id: other.id } }));
      expect(hidden).toBeNull();
    }
  });
});
