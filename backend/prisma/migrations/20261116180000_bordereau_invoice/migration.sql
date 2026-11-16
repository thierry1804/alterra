CREATE TABLE "BordereauInvoice" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "bordereauId" UUID NOT NULL,
    "fileKey" TEXT NOT NULL,
    "workerCount" INTEGER NOT NULL,
    "gross" DECIMAL(14,2) NOT NULL,
    "isi" DECIMAL(14,2) NOT NULL,
    "net" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BordereauInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BordereauInvoice_bordereauId_key" ON "BordereauInvoice"("bordereauId");

ALTER TABLE "BordereauInvoice" ADD CONSTRAINT "BordereauInvoice_bordereauId_fkey" FOREIGN KEY ("bordereauId") REFERENCES "Bordereau"("id") ON DELETE CASCADE ON UPDATE CASCADE;
