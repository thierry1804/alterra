-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "legacyMocId" INTEGER;

-- CreateIndex
CREATE INDEX "Worker_legacyMocId_idx" ON "Worker"("legacyMocId");
