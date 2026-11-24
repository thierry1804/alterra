-- Historique des factures de bordereau : une ligne par génération ou régénération du PDF.
CREATE TABLE "BordereauInvoiceRevision" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "fileKey" TEXT NOT NULL,
    "workerCount" INTEGER NOT NULL,
    "gross" DECIMAL(14,2) NOT NULL,
    "isi" DECIMAL(14,2) NOT NULL,
    "net" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BordereauInvoiceRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BordereauInvoiceRevision_invoiceId_revision_key" ON "BordereauInvoiceRevision"("invoiceId", "revision");

ALTER TABLE "BordereauInvoiceRevision" ADD CONSTRAINT "BordereauInvoiceRevision_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "BordereauInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Les factures existantes deviennent la révision 1 (leur PDF actuel) : rien n'est perdu ni laissé sans historique.
INSERT INTO "BordereauInvoiceRevision" ("id", "invoiceId", "revision", "fileKey", "workerCount", "gross", "isi", "net", "reason", "createdAt")
SELECT gen_random_uuid(), "id", 1, "fileKey", "workerCount", "gross", "isi", "net", 'Génération initiale', "updatedAt"
FROM "BordereauInvoice";
