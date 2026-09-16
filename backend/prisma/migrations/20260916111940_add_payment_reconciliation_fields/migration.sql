-- CreateEnum
CREATE TYPE "PaymentReconciliationStatus" AS ENUM ('CONFIRME', 'ECART_MONTANT', 'ORPHELIN', 'NON_CONFIRME');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "mvolaExecutedAt" TIMESTAMP(3),
ADD COLUMN     "mvolaReference" TEXT,
ADD COLUMN     "reconciliationStatus" "PaymentReconciliationStatus",
ADD COLUMN     "transferFee" DECIMAL(12,2);
