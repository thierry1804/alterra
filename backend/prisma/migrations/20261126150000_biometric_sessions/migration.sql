CREATE TYPE "BiometricSessionStatus" AS ENUM ('PENDING', 'STARTED', 'COMPLETED');

CREATE TABLE "BiometricSession" (
    "id" UUID NOT NULL,
    "referenceHash" TEXT NOT NULL,
    "workerId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "context" "BioContext" NOT NULL,
    "referenceDate" DATE,
    "status" "BiometricSessionStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "deviceId" TEXT,
    "engineVersion" TEXT,
    "outcome" TEXT,
    "score" INTEGER,
    "liveness" INTEGER,
    "distanceCm" INTEGER,
    "errorCode" TEXT,
    "bioCheckId" UUID,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BiometricSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BiometricSession_referenceHash_key" ON "BiometricSession"("referenceHash");
CREATE INDEX "BiometricSession_workerId_createdAt_idx" ON "BiometricSession"("workerId", "createdAt");
CREATE INDEX "BiometricSession_expiresAt_idx" ON "BiometricSession"("expiresAt");

ALTER TABLE "BiometricSession" ADD CONSTRAINT "BiometricSession_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
