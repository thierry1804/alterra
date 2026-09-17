-- ActivityRequest.proposedUnit (texte libre) -> unitId (FK vers le référentiel Unit)
-- Table vide en pratique à ce stade (0 ligne) — pas de backfill nécessaire.
ALTER TABLE "ActivityRequest" ADD COLUMN "unitId" UUID NOT NULL;
ALTER TABLE "ActivityRequest" DROP COLUMN "proposedUnit";

ALTER TABLE "ActivityRequest" ADD CONSTRAINT "ActivityRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
