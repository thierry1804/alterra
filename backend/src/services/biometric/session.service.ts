import { createHash, randomBytes } from "node:crypto";
import { BioContext, BioProvider, BioResult, type BiometricSession } from "@prisma/client";
import { basePrisma } from "../../lib/prisma-base.js";
import { prisma } from "../../lib/prisma.js";
import { getIsoWeekString } from "../../lib/week-iso.js";
import { ApiError } from "../../middleware/error-handler.js";
import { writeAuditLog } from "../audit/audit.service.js";
import type { BridgeLicenseProvider, BridgeTicket } from "./bridge-license.provider.js";

export const SESSION_TTL_MS = 5 * 60 * 1000;
export const RESULT_GRACE_MS = 12 * 60 * 60 * 1000;

export const BRIDGE_OUTCOMES = [
  "MATCH",
  "NO_MATCH",
  "FACE_NOT_DETECTED",
  "LIVENESS_FAILED",
  "CANCELLED",
  "UPDATE_REQUIRED",
  "LICENSE_PROBLEM",
  "FAILURE",
] as const;

export type BridgeOutcome = (typeof BRIDGE_OUTCOMES)[number];

export type SessionState = "PENDING" | "STARTED" | "COMPLETED" | "EXPIRED";

export interface SessionView {
  id: string;
  status: SessionState;
  outcome: BridgeOutcome | null;
  bioResult: BioResult | null;
  expiresAt: string;
}

export interface BridgeReport {
  deviceId: string;
  engineVersion: string;
  outcome: BridgeOutcome;
  score?: number | null;
  liveness?: number | null;
  distanceCm?: number | null;
  errorCode?: string | null;
}

export function hashReference(reference: string): string {
  return createHash("sha256").update(reference).digest("hex");
}

export function bioResultFor(outcome: BridgeOutcome): BioResult | null {
  if (outcome === "MATCH") return BioResult.OK;
  if (outcome === "NO_MATCH" || outcome === "LIVENESS_FAILED") return BioResult.KO;
  return null;
}

function toView(session: BiometricSession, now: Date): SessionView {
  const expired = session.status !== "COMPLETED" && now.getTime() > session.expiresAt.getTime();
  const outcome = (session.outcome as BridgeOutcome | null) ?? null;
  return {
    id: session.id,
    status: expired ? "EXPIRED" : session.status,
    outcome,
    bioResult: outcome ? bioResultFor(outcome) : null,
    expiresAt: session.expiresAt.toISOString(),
  };
}

async function findByReference(reference: string): Promise<BiometricSession> {
  const session = await basePrisma.biometricSession.findUnique({
    where: { referenceHash: hashReference(reference) },
  });
  if (!session) throw new ApiError(404, "SESSION_NOT_FOUND", "Vérification introuvable");
  return session;
}

export interface CreateSessionInput {
  workerId: string;
  createdById: string;
  context?: BioContext;
  referenceDate?: Date;
  ip?: string;
}

export async function createSession(
  input: CreateSessionInput,
  now: Date = new Date(),
): Promise<{ id: string; reference: string; expiresAt: string }> {
  const worker = await prisma.worker.findUnique({ where: { id: input.workerId } });
  if (!worker) throw new ApiError(404, "WORKER_NOT_FOUND", "Travailleur introuvable");

  const reference = randomBytes(24).toString("base64url");
  const session = await basePrisma.biometricSession.create({
    data: {
      referenceHash: hashReference(reference),
      workerId: worker.id,
      createdById: input.createdById,
      context: input.context ?? BioContext.POINTAGE_TASK,
      referenceDate: input.referenceDate,
      expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    },
  });

  await writeAuditLog({
    userId: input.createdById,
    action: "BIOMETRIC_SESSION_CREATE",
    entityType: "BiometricSession",
    entityId: session.id,
    after: { workerId: worker.id, context: session.context },
    ip: input.ip,
  });

  return { id: session.id, reference, expiresAt: session.expiresAt.toISOString() };
}

export async function getSessionView(
  id: string,
  requesterId: string,
  now: Date = new Date(),
): Promise<SessionView> {
  const session = await basePrisma.biometricSession.findUnique({ where: { id } });
  if (!session || session.createdById !== requesterId) {
    throw new ApiError(404, "SESSION_NOT_FOUND", "Vérification introuvable");
  }
  return toView(session, now);
}

export async function startSession(
  reference: string,
  device: { deviceId: string; engineVersion: string },
  provider: BridgeLicenseProvider,
  now: Date = new Date(),
): Promise<BridgeTicket> {
  const session = await findByReference(reference);
  if (session.status === "COMPLETED") {
    throw new ApiError(409, "SESSION_COMPLETED", "Cette vérification est déjà terminée");
  }
  if (now.getTime() > session.expiresAt.getTime()) {
    throw new ApiError(410, "SESSION_EXPIRED", "Cette vérification a expiré");
  }

  const worker = await basePrisma.worker.findUnique({ where: { id: session.workerId } });
  if (!worker) throw new ApiError(404, "WORKER_NOT_FOUND", "Travailleur introuvable");

  const ticket = await provider.issue({
    deviceId: device.deviceId,
    engineVersion: device.engineVersion,
    worker: { id: worker.id, mvolaNumber: worker.mvolaNumber },
  });

  await basePrisma.biometricSession.update({
    where: { id: session.id },
    data: {
      status: "STARTED",
      deviceId: device.deviceId,
      engineVersion: device.engineVersion,
      startedAt: now,
    },
  });
  return ticket;
}

export async function completeSession(
  reference: string,
  report: BridgeReport,
  ip?: string,
  now: Date = new Date(),
): Promise<SessionView> {
  const session = await findByReference(reference);
  if (session.status === "COMPLETED") return toView(session, now);
  if (session.status !== "STARTED") {
    throw new ApiError(409, "SESSION_NOT_STARTED", "La vérification n'a pas été démarrée");
  }
  if (now.getTime() > session.expiresAt.getTime() + RESULT_GRACE_MS) {
    throw new ApiError(410, "SESSION_EXPIRED", "Cette vérification a expiré");
  }
  if (report.deviceId !== session.deviceId) {
    throw new ApiError(
      403,
      "DEVICE_MISMATCH",
      "Ce résultat ne vient pas du téléphone de la vérification",
    );
  }

  const verdict = bioResultFor(report.outcome);
  let bioCheckId: string | null = null;
  if (verdict) {
    const check = await prisma.biometricCheck.create({
      data: {
        workerId: session.workerId,
        context: session.context,
        result: verdict,
        score: null,
        provider: BioProvider.AXIAN,
        performedById: session.createdById,
        weekIso: getIsoWeekString(session.referenceDate ?? now),
        rawResponse: {
          source: "bridge",
          outcome: report.outcome,
          score: report.score ?? null,
          liveness: report.liveness ?? null,
          distanceCm: report.distanceCm ?? null,
          engineVersion: report.engineVersion,
          deviceId: report.deviceId,
        },
      },
    });
    bioCheckId = check.id;
  }

  const completed = await basePrisma.biometricSession.update({
    where: { id: session.id },
    data: {
      status: "COMPLETED",
      outcome: report.outcome,
      score: report.score ?? null,
      liveness: report.liveness ?? null,
      distanceCm: report.distanceCm ?? null,
      errorCode: report.errorCode ?? null,
      engineVersion: report.engineVersion,
      bioCheckId,
      completedAt: now,
    },
  });

  await writeAuditLog({
    userId: session.createdById,
    action: "BIOMETRIC_SESSION_RESULT",
    entityType: "BiometricSession",
    entityId: session.id,
    after: { outcome: report.outcome, bioResult: verdict },
    ip,
  });

  return toView(completed, now);
}
