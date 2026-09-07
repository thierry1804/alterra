import { randomUUID } from "node:crypto";
import { BioContext, BioProvider, BioResult, PointageStatus, Prisma } from "@prisma/client";
import { basePrisma as prisma } from "../src/lib/prisma-base.js";
import { getIsoWeekString } from "../src/lib/week-iso.js";

const SITE_CODE = process.env.SEED_SITE ?? "MNK";
const POINTAGE_DATE = new Date(Date.UTC(2026, 8, 9)); // mercredi 2026-09-09
const WORKERS_TO_PAY = Number(process.env.SEED_WORKERS ?? 6);
const WORKERS_WITHOUT_BIO = 1; // pour tester la ligne "bloquée bio" dans /payments

async function main() {
  const site = await prisma.site.findFirstOrThrow({ where: { shortCode: SITE_CODE } });

  const cde = await prisma.user.findFirstOrThrow({
    where: { siteId: site.id, role: "CHEF_EQUIPE" },
    orderBy: { email: "asc" },
  });
  const cds = await prisma.user.findFirstOrThrow({
    where: { siteId: site.id, role: "CHEF_SERVICE" },
  });
  const activity = await prisma.activity.findFirstOrThrow({
    where: { OR: [{ siteId: site.id }, { siteId: null }], unitRate: { gt: 0 } },
    orderBy: { unitRate: "desc" },
  });

  const workers = await prisma.worker.findMany({
    where: { siteId: site.id, status: "ACTIVE" },
    orderBy: { matricule: "asc" },
    take: WORKERS_TO_PAY,
  });

  if (workers.length === 0) {
    throw new Error(`Aucun travailleur ACTIVE trouvé pour le site ${SITE_CODE}`);
  }

  const weekIso = getIsoWeekString(POINTAGE_DATE);
  const unitRate = activity.unitRate;

  console.log(`Site ${site.shortCode} · activité "${activity.label}" (${unitRate} Ar/${activity.unit})`);
  console.log(`Date pointage: ${POINTAGE_DATE.toISOString().slice(0, 10)} · semaine ISO: ${weekIso}`);
  console.log(`Chef d'équipe: ${cde.email} · Chef de service: ${cds.email}`);

  let created = 0;
  for (const [index, worker] of workers.entries()) {
    const quantity = new Prisma.Decimal(15 + index * 3);
    const amount = quantity.mul(unitRate);

    const pointage = await prisma.pointage.create({
      data: {
        clientUuid: randomUUID(),
        workerId: worker.id,
        activityId: activity.id,
        quantity,
        unitRateSnapshot: unitRate,
        amount,
        date: POINTAGE_DATE,
        status: PointageStatus.VALIDATED,
        enteredById: cde.id,
        validatedById: cds.id,
        validatedAt: new Date(),
        createdByClientAt: POINTAGE_DATE,
      },
    });

    const skipBio = index < WORKERS_WITHOUT_BIO;
    if (!skipBio) {
      await prisma.biometricCheck.create({
        data: {
          workerId: worker.id,
          context: BioContext.WEEKLY_VALIDATION,
          result: BioResult.OK,
          score: 0.97,
          provider: BioProvider.MOCK,
          performedById: cds.id,
          weekIso,
        },
      });
    }

    console.log(
      `  ${worker.matricule} ${worker.firstName} ${worker.lastName} — ${quantity} ${activity.unit} = ${amount} Ar` +
        (skipBio ? "  [SANS contrôle bio — restera bloqué à l'export]" : "  [bio OK]"),
    );
    created += 1;
  }

  console.log(`\n${created} pointage(s) VALIDATED créés.`);
  console.log(`\nDans /payments (admin), saisir la période : ${weekIso}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
