CREATE TYPE "IsiRounding" AS ENUM ('UNIT', 'NONE');

ALTER TABLE "AppSetting" ADD COLUMN "isiRate" DECIMAL(6,4) NOT NULL DEFAULT 0.05;
ALTER TABLE "AppSetting" ADD COLUMN "isiRounding" "IsiRounding" NOT NULL DEFAULT 'UNIT';

ALTER TABLE "Bordereau" ADD COLUMN "isiRate" DECIMAL(6,4) NOT NULL DEFAULT 0.05;
ALTER TABLE "Bordereau" ADD COLUMN "isiRounding" "IsiRounding" NOT NULL DEFAULT 'UNIT';

ALTER TABLE "Payment" ADD COLUMN "isiAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "Payment" ADD COLUMN "netAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- Les paiements et bordereaux existants ont été envoyés à MVola en brut, sans retenue : on garde leur réalité.
UPDATE "Payment" SET "netAmount" = "amount", "isiAmount" = 0;
UPDATE "Bordereau" SET "isiRate" = 0;
