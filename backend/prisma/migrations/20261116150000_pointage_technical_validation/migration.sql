-- AlterTable
ALTER TABLE "Pointage" ADD COLUMN "technicalValidatedAt" TIMESTAMP(3),
ADD COLUMN "technicalValidatedById" UUID;

-- Reprise : les pointages déjà validés avant l'étape technique restent éligibles aux bordereaux
-- (sans cela la paie en cours serait bloquée). L'auteur reste vide : validation historique.
UPDATE "Pointage" SET "technicalValidatedAt" = COALESCE("validatedAt", "updatedAt") WHERE "status" = 'VALIDATED';

-- CreateIndex
CREATE INDEX "Pointage_status_technicalValidatedAt_date_idx" ON "Pointage"("status", "technicalValidatedAt", "date");
