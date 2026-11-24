-- Nombre de décimales des montants de paiement, réglable dans Paramètres (0 à 2).
ALTER TABLE "AppSetting" ADD COLUMN "amountDecimals" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Bordereau" ADD COLUMN "amountDecimals" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "AppSetting" ADD CONSTRAINT "AppSetting_amountDecimals_range" CHECK ("amountDecimals" BETWEEN 0 AND 2);
ALTER TABLE "Bordereau" ADD CONSTRAINT "Bordereau_amountDecimals_range" CHECK ("amountDecimals" BETWEEN 0 AND 2);

-- L'ancien réglage d'arrondi devient un nombre de décimales : arrondi à l'unité = 0, sans arrondi = 2.
UPDATE "AppSetting" SET "amountDecimals" = CASE WHEN "isiRounding" = 'UNIT' THEN 0 ELSE 2 END;
UPDATE "Bordereau" SET "amountDecimals" = CASE WHEN "isiRounding" = 'UNIT' THEN 0 ELSE 2 END;
