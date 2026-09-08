-- Code unique par site (Zone) / par zone (Parcelle), ex: "VLB-Z1".
-- code est nullable : Postgres traite chaque NULL comme distinct dans un
-- index unique, donc les lignes sans code (cas actuel de toutes les
-- zones/parcelles existantes) ne se bloquent jamais entre elles.
ALTER TABLE "Zone" ADD COLUMN "code" TEXT;
ALTER TABLE "Parcelle" ADD COLUMN "code" TEXT;

CREATE UNIQUE INDEX "Zone_siteId_code_key" ON "Zone" ("siteId", "code");
CREATE UNIQUE INDEX "Parcelle_zoneId_code_key" ON "Parcelle" ("zoneId", "code");
