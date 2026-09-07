import { PaymentCycle, PaymentStatus } from "@prisma/client";
import { basePrisma as prisma } from "../src/lib/prisma-base.js";

const PERIOD = process.argv[2] ?? "S37";

async function main() {
  const worker = await prisma.worker.findFirstOrThrow({
    where: { status: "ACTIVE" },
    orderBy: { matricule: "asc" },
  });

  const payment = await prisma.payment.create({
    data: {
      workerId: worker.id,
      periodIso: PERIOD,
      cycle: PaymentCycle.WEEKLY,
      amount: 1000,
      description: `${worker.firstName} ${worker.lastName} ${PERIOD} TEST`,
      bioValid: true,
      status: PaymentStatus.EXPORTED,
      exportedAt: new Date(),
    },
  });

  console.log(`Payment ${payment.id} créé en EXPORTED pour la période ${PERIOD}.`);
  console.log(`Va maintenant dans /payments, saisis "${PERIOD.replace("S", "2026-W")}" et clique "Générer bordereau" → tu dois voir le conflit PAY_CONFLICT.`);
}

main().finally(() => prisma.$disconnect());
