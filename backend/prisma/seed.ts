import { randomBytes } from "node:crypto";
import { PrismaClient, BioProvider, Role, WorkerStatus } from "@prisma/client";
import argon2 from "argon2";
import {
  buildMockDescriptor,
  encodeTemplateData,
} from "../src/services/biometric/template.service.js";
import {
  ACTIVITY_CATEGORIES,
  UNITS,
  ADMIN_ID,
  cdsId,
  cdeId,
  EXPECTED_SEED_COUNTS,
  pad,
  SITES,
  SUB_ACTIVITIES,
  teamId,
  workerId,
} from "./seed-data.js";

const prisma = new PrismaClient();

/** Mot de passe fourni par l'environnement, sinon généré au hasard : jamais écrit dans le code. */
function passwordFor(envKey: string): { value: string; generated: boolean } {
  const provided = process.env[envKey];
  if (provided) {
    if (provided.length < 12) throw new Error(`${envKey} doit faire au moins 12 caractères`);
    return { value: provided, generated: false };
  }
  return { value: randomBytes(18).toString("base64url"), generated: true };
}

async function main() {
  const admin = passwordFor("SEED_ADMIN_PASSWORD");
  const user = passwordFor("SEED_USER_PASSWORD");
  const [adminHash, userHash] = await Promise.all([argon2.hash(admin.value), argon2.hash(user.value)]);
  const emailsBefore = new Set((await prisma.user.findMany({ select: { email: true } })).map((u) => u.email));

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

  for (const category of ACTIVITY_CATEGORIES) {
    await prisma.activityCategory.upsert({
      where: { id: category.id },
      update: {},
      create: {
        id: category.id,
        code: category.code,
        label: category.label,
      },
    });
  }

  for (const unit of UNITS) {
    await prisma.unit.upsert({
      where: { id: unit.id },
      update: {},
      create: {
        id: unit.id,
        code: unit.code,
        label: unit.label,
      },
    });
  }

  for (const subActivity of SUB_ACTIVITIES) {
    await prisma.activitySubActivity.upsert({
      where: { id: subActivity.id },
      update: {},
      create: {
        id: subActivity.id,
        categoryId: subActivity.categoryId,
        label: subActivity.label,
        shortLabel: subActivity.shortLabel,
        unitId: subActivity.unitId,
        unitRate: subActivity.unitRate,
        validFrom: new Date("2026-01-01"),
        siteId: null,
        groupKey: subActivity.id,
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
    "Seed OK — %d sites, %d users (1 admin, %d CDS, %d CDE), %d catégories / %d sous-activités, %d MOC",
    EXPECTED_SEED_COUNTS.sites,
    1 + EXPECTED_SEED_COUNTS.cds + EXPECTED_SEED_COUNTS.cde,
    EXPECTED_SEED_COUNTS.cds,
    EXPECTED_SEED_COUNTS.cde,
    EXPECTED_SEED_COUNTS.activityCategories,
    EXPECTED_SEED_COUNTS.subActivities,
    EXPECTED_SEED_COUNTS.workers,
  );

  // Les mots de passe ne vivent qu'en base (hachés). Un mot de passe généré n'est affiché qu'ici, une seule fois,
  // et seulement pour les comptes réellement créés par ce passage (un compte existant garde son mot de passe).
  const emailsAfter = (await prisma.user.findMany({ select: { email: true } })).map((u) => u.email);
  const created = emailsAfter.filter((email) => !emailsBefore.has(email));
  const report = (label: string, emails: string[], secret: { value: string; generated: boolean }, envKey: string) => {
    if (emails.length === 0) return console.log("%s : comptes existants conservés, mot de passe inchangé", label);
    console.log(
      "%s : %d compte(s) créé(s) — mot de passe %s",
      label,
      emails.length,
      secret.generated ? `généré (à noter maintenant, non récupérable) : ${secret.value}` : `fourni par ${envKey}`,
    );
  };
  report("Admin (admin@alterra.mg)", created.filter((e) => e === "admin@alterra.mg"), admin, "SEED_ADMIN_PASSWORD");
  report("CDS/CDE (*@alterra.test)", created.filter((e) => e.endsWith("@alterra.test")), user, "SEED_USER_PASSWORD");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
