import { Role } from "@prisma/client";
import { beforeAll, describe, expect, it } from "vitest";
import { EXPECTED_SEED_COUNTS } from "../../prisma/seed-data.js";
import { prisma } from "../lib/prisma.js";

let dbReady = false;

beforeAll(async () => {
  if (!process.env.DATABASE_URL) return;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbReady = true;
  } catch {
    dbReady = false;
  }
});

describe("seed data counts", () => {
  it("matches expected deterministic seed counts", async ({ skip }) => {
    if (!dbReady) skip();

    const [admin, cds, cde, sites, activities, workers, teams] = await Promise.all([
      prisma.user.count({ where: { role: Role.ADMIN } }),
      prisma.user.count({ where: { role: Role.CHEF_SERVICE } }),
      prisma.user.count({ where: { role: Role.CHEF_EQUIPE } }),
      prisma.site.count(),
      prisma.activity.count(),
      prisma.worker.count(),
      prisma.team.count(),
    ]);

    expect(admin).toBe(EXPECTED_SEED_COUNTS.admin);
    expect(cds).toBe(EXPECTED_SEED_COUNTS.cds);
    expect(cde).toBe(EXPECTED_SEED_COUNTS.cde);
    expect(sites).toBe(EXPECTED_SEED_COUNTS.sites);
    expect(activities).toBe(EXPECTED_SEED_COUNTS.activities);
    expect(workers).toBe(EXPECTED_SEED_COUNTS.workers);
    expect(teams).toBe(EXPECTED_SEED_COUNTS.teams);
  }, 15_000);
});
