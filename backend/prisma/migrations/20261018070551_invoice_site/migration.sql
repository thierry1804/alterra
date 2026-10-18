-- AlterTable: nullable d'abord pour backfiller les 3 factures existantes (toutes du site AMB,
-- vérifié via les pointages validés de leur période — aucune ne couvre plusieurs sites).
ALTER TABLE "Invoice" ADD COLUMN     "siteId" UUID;

UPDATE "Invoice" SET "siteId" = '00000000-0000-0000-0001-000000000005';

ALTER TABLE "Invoice" ALTER COLUMN "siteId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
