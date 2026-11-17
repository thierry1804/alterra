CREATE TABLE "PaymentAdjustment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "paymentId" UUID NOT NULL,
    "bordereauId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentAdjustment_paymentId_idx" ON "PaymentAdjustment"("paymentId");
CREATE INDEX "PaymentAdjustment_bordereauId_idx" ON "PaymentAdjustment"("bordereauId");

ALTER TABLE "PaymentAdjustment" ADD CONSTRAINT "PaymentAdjustment_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAdjustment" ADD CONSTRAINT "PaymentAdjustment_bordereauId_fkey" FOREIGN KEY ("bordereauId") REFERENCES "Bordereau"("id") ON DELETE CASCADE ON UPDATE CASCADE;
