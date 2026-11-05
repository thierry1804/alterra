-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "exportBatchId" UUID;

-- CreateTable
CREATE TABLE "MvolaExportBatch" (
    "id" UUID NOT NULL,
    "periodIso" TEXT NOT NULL,
    "referenceYear" INTEGER,
    "version" INTEGER NOT NULL,
    "fileKey" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "exportedCount" INTEGER NOT NULL,
    "excludedCount" INTEGER NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MvolaExportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MvolaExportBatch_periodIso_referenceYear_idx" ON "MvolaExportBatch"("periodIso", "referenceYear");

-- CreateIndex
CREATE UNIQUE INDEX "MvolaExportBatch_periodIso_referenceYear_version_key" ON "MvolaExportBatch"("periodIso", "referenceYear", "version");

-- CreateIndex
CREATE INDEX "Payment_exportBatchId_idx" ON "Payment"("exportBatchId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_exportBatchId_fkey" FOREIGN KEY ("exportBatchId") REFERENCES "MvolaExportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
