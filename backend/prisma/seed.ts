import { PrismaClient, BioProvider, Role, WorkerStatus } from "@prisma/client";
import argon2 from "argon2";
import {
  buildMockDescriptor,
  encodeTemplateData,
} from "../src/services/biometric/template.service.js";
import {
  ACTIVITIES,
  ADMIN_ID,
  ADMIN_PASSWORD,
  cdsId,
  cdeId,
  EXPECTED_SEED_COUNTS,
  pad,
  SITES,
  teamId,
  USER_PASSWORD,
  workerId,
} from "./seed-data.js";

const prisma = new PrismaClient();

async function main() {
  const [adminHash, userHash] = await Promise.all([
    argon2.hash(ADMIN_PASSWORD),
    argon2.hash(USER_PASSWORD),
  ]);

  /** IDs réels en base (peuvent différer des UUID seed-data si sites préexistants). */
  const siteIdByShortCode = new Map<string, string>();
  const teamIdBySiteAndName = new Map<string, string>();
  for (const site of SITES) {
    const row = await prisma.site.upsert({
      where: { shortCode: site.shortCode },
      update: {
        name: site.name,
        location: site.location,
      },
      create: {
        id: site.id,
        name: site.name,
        shortCode: site.shortCode,
        location: site.location,
      },
    });
    siteIdByShortCode.set(site.shortCode, row.id);
  }

  await prisma.user.upsert({
    where: { email: "admin@alterra.mg" },
    update: {},
    create: {
      id: ADMIN_ID,
      email: "admin@alterra.mg",
      passwordHash: adminHash,
      role: Role.ADMIN,
      firstName: "Admin",
      lastName: "ALTERRA",
    },
  });

  for (let siteIndex = 1; siteIndex <= SITES.length; siteIndex++) {
    const site = SITES[siteIndex - 1]!;
    const siteId = siteIdByShortCode.get(site.shortCode)!;
    const cdsEmail = `cds.${site.shortCode.toLowerCase()}@alterra.test`;

    await prisma.user.upsert({
      where: { email: cdsEmail },
      update: {},
      create: {
        id: cdsId(siteIndex),
        email: cdsEmail,
        passwordHash: userHash,
        role: Role.CHEF_SERVICE,
        firstName: "Chef",
        lastName: `Service ${site.shortCode}`,
        siteId,
      },
    });

    for (let teamIndex = 1; teamIndex <= 3; teamIndex++) {
      const teamName = `${site.shortCode}-${teamIndex}`;
      const tid = teamId(siteIndex, teamIndex);
      const cdeEmail = `cde.${site.shortCode.toLowerCase()}${teamIndex}@alterra.test`;
      const cdeUserId = cdeId(siteIndex, teamIndex);

      const teamRow = await prisma.team.upsert({
        where: { siteId_name: { siteId, name: teamName } },
        update: {},
        create: {
          id: tid,
          siteId,
          name: teamName,
        },
      });
      teamIdBySiteAndName.set(`${site.shortCode}::${teamName}`, teamRow.id);

      await prisma.user.upsert({
        where: { email: cdeEmail },
        update: {},
        create: {
          id: cdeUserId,
          email: cdeEmail,
          passwordHash: userHash,
          role: Role.CHEF_EQUIPE,
          firstName: "Chef",
          lastName: `Équipe ${teamName}`,
          siteId,
          teamId: teamRow.id,
        },
      });

      await prisma.team.update({
        where: { id: teamRow.id },
        data: { chefId: cdeUserId },
      });
    }
  }

  for (let i = 0; i < ACTIVITIES.length; i++) {
    const activity = ACTIVITIES[i]!;
    const site = i < SITES.length ? SITES[i]! : null;

    await prisma.activity.upsert({
      where: { id: activity.id },
      update: {},
      create: {
        id: activity.id,
        label: activity.label,
        unit: activity.unit,
        unitRate: activity.unitRate,
        validFrom: new Date("2026-01-01"),
        siteId: site ? (siteIdByShortCode.get(site.shortCode) ?? null) : null,
      },
    });
  }

  for (let n = 1; n <= EXPECTED_SEED_COUNTS.workers; n++) {
    const siteIndex = Math.floor((n - 1) / 10);
    const site = SITES[siteIndex]!;
    const siteId = siteIdByShortCode.get(site.shortCode)!;
    const teamIndex = ((n - 1) % 3) + 1;
    const workerInSite = ((n - 1) % 10) + 1;
    const teamName = `${site.shortCode}-${teamIndex}`;
    const resolvedTeamId = teamIdBySiteAndName.get(`${site.shortCode}::${teamName}`)!;
    const matricule = `MOC-${site.shortCode}-${pad(workerInSite, 2)}`;
    const mvolaNumber = `034${pad(n, 7)}`;

    await prisma.worker.upsert({
      where: { matricule },
      update: {},
      create: {
        id: workerId(n),
        matricule,
        firstName: "MOC",
        lastName: `${site.shortCode}-${pad(workerInSite, 2)}`,
        mvolaNumber,
        siteId,
        teamId: resolvedTeamId,
        status: WorkerStatus.ACTIVE,
        hiredAt: new Date("2025-01-01"),
      },
    });
  }

  for (let n = 1; n <= Math.min(10, EXPECTED_SEED_COUNTS.workers); n += 1) {
    const wid = workerId(n);
    await prisma.biometricTemplate.upsert({
      where: { workerId: wid },
      update: {},
      create: {
        workerId: wid,
        templateData: encodeTemplateData(buildMockDescriptor(wid)),
        source: BioProvider.MOCK,
        capturedAt: new Date("2026-01-01"),
        expiresAt: new Date("2027-12-31"),
      },
    });
  }

  console.log(
    "Seed OK — %d sites, %d users (1 admin, %d CDS, %d CDE), %d activités, %d MOC",
    EXPECTED_SEED_COUNTS.sites,
    1 + EXPECTED_SEED_COUNTS.cds + EXPECTED_SEED_COUNTS.cde,
    EXPECTED_SEED_COUNTS.cds,
    EXPECTED_SEED_COUNTS.cde,
    EXPECTED_SEED_COUNTS.activities,
    EXPECTED_SEED_COUNTS.workers,
  );
  console.log("Admin: admin@alterra.mg / %s", ADMIN_PASSWORD);
  console.log("CDS/CDE: *@alterra.test / %s", USER_PASSWORD);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
