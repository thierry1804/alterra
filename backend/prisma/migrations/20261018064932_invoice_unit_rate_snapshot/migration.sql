-- AlterTable: colonne nullable d'abord pour pouvoir backfiller les factures déjà générées.
ALTER TABLE "Invoice" ADD COLUMN     "unitRateSnapshot" DECIMAL(12,2);

-- Backfill : pas de tarif capturé à la génération pour les factures existantes — on reprend le
-- tarif courant de l'activité (meilleure approximation disponible, peut différer du tarif réel
-- facturé si le tarif a changé depuis).
UPDATE "Invoice" i
SET "unitRateSnapshot" = sub."unitRate"
FROM "ActivitySubActivity" sub
WHERE i."subActivityId" = sub."id";

ALTER TABLE "Invoice" ALTER COLUMN "unitRateSnapshot" SET NOT NULL;
