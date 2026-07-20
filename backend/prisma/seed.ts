import { PrismaClient, Role } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();

async function main() {
  const site = await prisma.site.upsert({
    where: { shortCode: "MNK" },
    update: {},
    create: {
      name: "Mankarana",
      shortCode: "MNK",
      location: "Antananarivo",
    },
  });

  const passwordHash = await argon2.hash("ChangeMe123!");

  await prisma.user.upsert({
    where: { email: "admin@alterra.mg" },
    update: {},
    create: {
      email: "admin@alterra.mg",
      passwordHash,
      role: Role.ADMIN,
      firstName: "Admin",
      lastName: "ALTERRA",
      siteId: site.id,
    },
  });

  await prisma.activity.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      label: "Trouaison",
      unit: "trou",
      unitRate: 150,
      validFrom: new Date("2026-01-01"),
      siteId: site.id,
    },
  });

  console.log("Seed OK — site %s, admin@alterra.mg / ChangeMe123!", site.shortCode);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
