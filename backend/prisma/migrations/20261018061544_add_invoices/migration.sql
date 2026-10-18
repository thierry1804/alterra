-- CreateTable
CREATE TABLE "Invoice" (
    "id" UUID NOT NULL,
    "periodIso" TEXT NOT NULL,
    "referenceYear" INTEGER,
    "subActivityId" UUID NOT NULL,
    "fileKey" TEXT NOT NULL,
    "workerCount" INTEGER NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Invoice_periodIso_referenceYear_idx" ON "Invoice"("periodIso", "referenceYear");

-- CreateIndex
CREATE INDEX "Invoice_subActivityId_idx" ON "Invoice"("subActivityId");

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_subActivityId_fkey" FOREIGN KEY ("subActivityId") REFERENCES "ActivitySubActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
