-- AlterTable
ALTER TABLE "ActivityRequest" ADD COLUMN "clientUuid" UUID;
ALTER TABLE "WorkerRequest" ADD COLUMN "clientUuid" UUID;
ALTER TABLE "ClarificationRequest" ADD COLUMN "clientUuid" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "ActivityRequest_clientUuid_key" ON "ActivityRequest"("clientUuid");
CREATE UNIQUE INDEX "WorkerRequest_clientUuid_key" ON "WorkerRequest"("clientUuid");
CREATE UNIQUE INDEX "ClarificationRequest_clientUuid_key" ON "ClarificationRequest"("clientUuid");
