-- CreateTable
CREATE TABLE "Unit" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Unit_code_key" ON "Unit"("code");

-- CreateIndex
CREATE INDEX "Unit_active_idx" ON "Unit"("active");

-- Référentiel initial — cf. CATEGORIES DES ACTIVITES MOC PAR SITE.xlsx
INSERT INTO "Unit" ("id", "code", "label") VALUES
    ('00000000-0000-0000-0009-000000000001', 'PIECE', 'Pièce'),
    ('00000000-0000-0000-0009-000000000002', 'TROU', 'Trou'),
    ('00000000-0000-0000-0009-000000000003', 'HA', 'Ha'),
    ('00000000-0000-0000-0009-000000000004', 'KM', 'Km'),
    ('00000000-0000-0000-0009-000000000005', 'JOUR', 'Jour'),
    ('00000000-0000-0000-0009-000000000006', 'PIED', 'Pied');

-- AlterTable ActivitySubActivity: unit (texte libre) -> unitId (FK)
ALTER TABLE "ActivitySubActivity" ADD COLUMN "unitId" UUID;

UPDATE "ActivitySubActivity" SET "unitId" = '00000000-0000-0000-0009-000000000001' WHERE "unit" = 'Pièce';
UPDATE "ActivitySubActivity" SET "unitId" = '00000000-0000-0000-0009-000000000002' WHERE "unit" = 'Trou';
UPDATE "ActivitySubActivity" SET "unitId" = '00000000-0000-0000-0009-000000000003' WHERE "unit" = 'Ha';
UPDATE "ActivitySubActivity" SET "unitId" = '00000000-0000-0000-0009-000000000004' WHERE "unit" = 'Km';
UPDATE "ActivitySubActivity" SET "unitId" = '00000000-0000-0000-0009-000000000005' WHERE "unit" = 'Jour';
UPDATE "ActivitySubActivity" SET "unitId" = '00000000-0000-0000-0009-000000000006' WHERE "unit" = 'Pied';

ALTER TABLE "ActivitySubActivity" ALTER COLUMN "unitId" SET NOT NULL;
ALTER TABLE "ActivitySubActivity" DROP COLUMN "unit";

-- CreateIndex
CREATE INDEX "ActivitySubActivity_unitId_idx" ON "ActivitySubActivity"("unitId");

-- AddForeignKey
ALTER TABLE "ActivitySubActivity" ADD CONSTRAINT "ActivitySubActivity_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
