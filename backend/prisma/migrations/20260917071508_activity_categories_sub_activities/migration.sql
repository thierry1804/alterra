-- CreateTable
CREATE TABLE "ActivityCategory" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivitySubActivity" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "shortLabel" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitRate" DECIMAL(12,2) NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "siteId" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivitySubActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityCategory_code_key" ON "ActivityCategory"("code");

-- CreateIndex
CREATE INDEX "ActivityCategory_active_idx" ON "ActivityCategory"("active");

-- CreateIndex
CREATE INDEX "ActivitySubActivity_categoryId_active_idx" ON "ActivitySubActivity"("categoryId", "active");

-- CreateIndex
CREATE INDEX "ActivitySubActivity_siteId_active_idx" ON "ActivitySubActivity"("siteId", "active");

-- CreateIndex
CREATE INDEX "ActivitySubActivity_validFrom_validTo_idx" ON "ActivitySubActivity"("validFrom", "validTo");

-- AddForeignKey
ALTER TABLE "ActivitySubActivity" ADD CONSTRAINT "ActivitySubActivity_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ActivityCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Dev-only test data cleared as part of this restructure (pré-lancement, aucune donnée réelle) : les Pointage/ClarificationRequest existants référencent l'ancien modèle Activity plat.
DELETE FROM "ClarificationRequest";
DELETE FROM "Pointage";

-- AlterTable Pointage: activityId -> subActivityId
ALTER TABLE "Pointage" DROP CONSTRAINT "Pointage_activityId_fkey";
ALTER TABLE "Pointage" DROP COLUMN "activityId";
ALTER TABLE "Pointage" ADD COLUMN "subActivityId" UUID NOT NULL;
ALTER TABLE "Pointage" ADD CONSTRAINT "Pointage_subActivityId_fkey" FOREIGN KEY ("subActivityId") REFERENCES "ActivitySubActivity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropTable
DROP TABLE "Activity";

-- AlterTable ActivityRequest
ALTER TABLE "ActivityRequest" ADD COLUMN "categoryId" UUID;
ALTER TABLE "ActivityRequest" ALTER COLUMN "categoryId" SET NOT NULL;
ALTER TABLE "ActivityRequest" RENAME COLUMN "createdActivityId" TO "createdSubActivityId";
ALTER TABLE "ActivityRequest" ADD CONSTRAINT "ActivityRequest_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ActivityCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
