-- Les périodes de paie (S47, D138) se répètent chaque année : sans année, un bordereau exporté en 2026
-- bloquait la même semaine de 2027. Colonne nullable (additive) ; backfill : année de création de la ligne.
ALTER TABLE "Payment" ADD COLUMN "referenceYear" INTEGER;

UPDATE "Payment" SET "referenceYear" = EXTRACT(YEAR FROM "createdAt")::INTEGER WHERE "referenceYear" IS NULL;

CREATE INDEX "Payment_referenceYear_periodIso_idx" ON "Payment"("referenceYear", "periodIso");
