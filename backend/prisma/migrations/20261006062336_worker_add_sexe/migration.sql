-- CreateEnum
CREATE TYPE "Sexe" AS ENUM ('MASCULIN', 'FEMININ');

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "sexe" "Sexe";
