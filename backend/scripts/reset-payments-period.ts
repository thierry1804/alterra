import { basePrisma as prisma } from "../src/lib/prisma-base.js";

const PERIOD = process.argv[2] ?? "S37";

async function main() {
  const result = await prisma.payment.deleteMany({ where: { periodIso: PERIOD } });
  console.log(`${result.count} paiement(s) supprimé(s) pour la période ${PERIOD}.`);
}

main().finally(() => prisma.$disconnect());
