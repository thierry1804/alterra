import { PrismaClient, Role, WorkerStatus } from "@prisma/client";
import argon2 from "argon2";
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

  for (const site of SITES) {
    await prisma.site.upsert({
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
        siteId: site.id,
      },
    });

    for (let teamIndex = 1; teamIndex <= 3; teamIndex++) {
      const teamName = `${site.shortCode}-${teamIndex}`;
      const tid = teamId(siteIndex, teamIndex);
      const cdeEmail = `cde.${site.shortCode.toLowerCase()}${teamIndex}@alterra.test`;
      const cdeUserId = cdeId(siteIndex, teamIndex);

      await prisma.team.upsert({
        where: { siteId_name: { siteId: site.id, name: teamName } },
        update: {},
        create: {
          id: tid,
          siteId: site.id,
          name: teamName,
        },
      });

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
          siteId: site.id,
          teamId: tid,
        },
      });

      await prisma.team.update({
        where: { id: tid },
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
        siteId: site?.id ?? null,
      },
    });
  }

  for (let n = 1; n <= EXPECTED_SEED_COUNTS.workers; n++) {
    const siteIndex = Math.floor((n - 1) / 10);
    const site = SITES[siteIndex]!;
    const teamIndex = ((n - 1) % 3) + 1;
    const workerInSite = ((n - 1) % 10) + 1;
    const tid = teamId(siteIndex + 1, teamIndex);
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
        siteId: site.id,
        teamId: tid,
        status: WorkerStatus.ACTIVE,
        hiredAt: new Date("2025-01-01"),
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
