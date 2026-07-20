-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CHEF_SERVICE', 'CHEF_EQUIPE');

-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PointageStatus" AS ENUM ('PENDING', 'VALIDATED', 'REJECTED', 'NEEDS_CLARIFICATION');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'EXPORTED', 'PAID', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentCycle" AS ENUM ('WEEKLY', 'DAILY');

-- CreateEnum
CREATE TYPE "BioContext" AS ENUM ('POINTAGE_TASK', 'WEEKLY_VALIDATION');

-- CreateEnum
CREATE TYPE "BioResult" AS ENUM ('OK', 'DOUBT', 'KO', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "BioProvider" AS ENUM ('AXIAN', 'MANUAL', 'MOCK', 'LOCAL_OFFLINE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ClarificationStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PresenceSource" AS ENUM ('NFC', 'MANUAL');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "mfaSecret" TEXT,
    "siteId" UUID,
    "teamId" UUID,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "location" TEXT,
    "geoLat" DOUBLE PRECISION,
    "geoLng" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "geoPolygon" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parcelle" (
    "id" UUID NOT NULL,
    "zoneId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "geoPolygon" JSONB,
    "surfaceHa" DECIMAL(10,2),

    CONSTRAINT "Parcelle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" UUID NOT NULL,
    "siteId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "chefId" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitRate" DECIMAL(12,2) NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "siteId" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" UUID NOT NULL,
    "matricule" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" DATE,
    "maritalStatus" TEXT,
    "childrenCount" INTEGER,
    "mvolaNumber" TEXT NOT NULL,
    "cinNumber" TEXT,
    "photoKey" TEXT,
    "siteId" UUID NOT NULL,
    "teamId" UUID,
    "status" "WorkerStatus" NOT NULL DEFAULT 'ACTIVE',
    "hiredAt" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pointage" (
    "id" UUID NOT NULL,
    "clientUuid" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "activityId" UUID NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitRateSnapshot" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "date" DATE NOT NULL,
    "parcelleId" UUID,
    "geoLat" DOUBLE PRECISION,
    "geoLng" DOUBLE PRECISION,
    "photoKey" TEXT,
    "notes" TEXT,
    "status" "PointageStatus" NOT NULL DEFAULT 'PENDING',
    "enteredById" UUID NOT NULL,
    "validatedById" UUID,
    "validatedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "bioCheckId" UUID,
    "createdByClientAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pointage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresenceRecord" (
    "id" UUID NOT NULL,
    "clientUuid" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "arrivalTime" TIMESTAMP(3) NOT NULL,
    "badgeNfcTagId" TEXT NOT NULL,
    "scannedById" UUID NOT NULL,
    "source" "PresenceSource" NOT NULL,
    "parcelleId" UUID,
    "createdByClientAt" TIMESTAMP(3) NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PresenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Badge" (
    "id" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "nfcTagId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Badge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricCheck" (
    "id" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "context" "BioContext" NOT NULL,
    "result" "BioResult" NOT NULL,
    "score" DOUBLE PRECISION,
    "provider" "BioProvider" NOT NULL,
    "performedById" UUID NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weekIso" TEXT,
    "rawResponse" JSONB,

    CONSTRAINT "BiometricCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiometricTemplate" (
    "id" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "templateData" BYTEA NOT NULL,
    "source" "BioProvider" NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiometricTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" UUID NOT NULL,
    "workerId" UUID NOT NULL,
    "periodIso" TEXT NOT NULL,
    "cycle" "PaymentCycle" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "bioValid" BOOLEAN NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "exportedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "correctionReason" TEXT,
    "originalAmount" DECIMAL(12,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityRequest" (
    "id" UUID NOT NULL,
    "proposedLabel" TEXT NOT NULL,
    "proposedUnit" TEXT NOT NULL,
    "proposedRate" DECIMAL(12,2) NOT NULL,
    "justification" TEXT NOT NULL,
    "requestedById" UUID NOT NULL,
    "siteId" UUID,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "decisionById" UUID,
    "decisionAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdActivityId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerRequest" (
    "id" UUID NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "cinNumber" TEXT,
    "mvolaNumber" TEXT NOT NULL,
    "proposedPhotoKey" TEXT,
    "targetTeamId" UUID,
    "justification" TEXT NOT NULL,
    "requestedById" UUID NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "decisionById" UUID,
    "decisionAt" TIMESTAMP(3),
    "decisionReason" TEXT,
    "createdWorkerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClarificationRequest" (
    "id" UUID NOT NULL,
    "pointageId" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "requestedPhoto" BOOLEAN NOT NULL DEFAULT false,
    "status" "ClarificationStatus" NOT NULL DEFAULT 'OPEN',
    "answerText" TEXT,
    "answerPhotoKey" TEXT,
    "requestedById" UUID NOT NULL,
    "answeredById" UUID,
    "answeredAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClarificationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_siteId_idx" ON "User"("role", "siteId");

-- CreateIndex
CREATE UNIQUE INDEX "Site_shortCode_key" ON "Site"("shortCode");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_siteId_name_key" ON "Zone"("siteId", "name");

-- CreateIndex
CREATE INDEX "Parcelle_zoneId_idx" ON "Parcelle"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "Parcelle_zoneId_name_key" ON "Parcelle"("zoneId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Team_siteId_name_key" ON "Team"("siteId", "name");

-- CreateIndex
CREATE INDEX "Activity_siteId_active_idx" ON "Activity"("siteId", "active");

-- CreateIndex
CREATE INDEX "Activity_validFrom_validTo_idx" ON "Activity"("validFrom", "validTo");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_matricule_key" ON "Worker"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_mvolaNumber_key" ON "Worker"("mvolaNumber");

-- CreateIndex
CREATE INDEX "Worker_siteId_teamId_status_idx" ON "Worker"("siteId", "teamId", "status");

-- CreateIndex
CREATE INDEX "Worker_firstName_lastName_idx" ON "Worker"("firstName", "lastName");

-- CreateIndex
CREATE INDEX "Worker_mvolaNumber_idx" ON "Worker"("mvolaNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Pointage_clientUuid_key" ON "Pointage"("clientUuid");

-- CreateIndex
CREATE INDEX "Pointage_workerId_date_idx" ON "Pointage"("workerId", "date");

-- CreateIndex
CREATE INDEX "Pointage_status_date_idx" ON "Pointage"("status", "date");

-- CreateIndex
CREATE INDEX "Pointage_parcelleId_date_idx" ON "Pointage"("parcelleId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PresenceRecord_clientUuid_key" ON "PresenceRecord"("clientUuid");

-- CreateIndex
CREATE INDEX "PresenceRecord_workerId_date_idx" ON "PresenceRecord"("workerId", "date");

-- CreateIndex
CREATE INDEX "PresenceRecord_date_parcelleId_idx" ON "PresenceRecord"("date", "parcelleId");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_workerId_key" ON "Badge"("workerId");

-- CreateIndex
CREATE UNIQUE INDEX "Badge_nfcTagId_key" ON "Badge"("nfcTagId");

-- CreateIndex
CREATE INDEX "BiometricCheck_workerId_weekIso_idx" ON "BiometricCheck"("workerId", "weekIso");

-- CreateIndex
CREATE INDEX "BiometricCheck_performedAt_idx" ON "BiometricCheck"("performedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BiometricTemplate_workerId_key" ON "BiometricTemplate"("workerId");

-- CreateIndex
CREATE INDEX "Payment_workerId_periodIso_idx" ON "Payment"("workerId", "periodIso");

-- CreateIndex
CREATE INDEX "Payment_status_periodIso_idx" ON "Payment"("status", "periodIso");

-- CreateIndex
CREATE INDEX "ActivityRequest_status_createdAt_idx" ON "ActivityRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkerRequest_status_createdAt_idx" ON "WorkerRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ClarificationRequest_pointageId_idx" ON "ClarificationRequest"("pointageId");

-- CreateIndex
CREATE INDEX "ClarificationRequest_status_createdAt_idx" ON "ClarificationRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Parcelle" ADD CONSTRAINT "Parcelle_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pointage" ADD CONSTRAINT "Pointage_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pointage" ADD CONSTRAINT "Pointage_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pointage" ADD CONSTRAINT "Pointage_parcelleId_fkey" FOREIGN KEY ("parcelleId") REFERENCES "Parcelle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceRecord" ADD CONSTRAINT "PresenceRecord_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiometricCheck" ADD CONSTRAINT "BiometricCheck_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
