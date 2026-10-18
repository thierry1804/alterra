-- AlterTable: backfill avec createdAt pour les factures existantes (jamais régénérées).
ALTER TABLE "Invoice" ADD COLUMN     "updatedAt" TIMESTAMP(3);
UPDATE "Invoice" SET "updatedAt" = "createdAt";
ALTER TABLE "Invoice" ALTER COLUMN "updatedAt" SET NOT NULL;
