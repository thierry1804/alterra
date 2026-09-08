/*
  Warnings:

  - Added the required column `bordereau` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "code" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "bordereau" INTEGER NOT NULL;
