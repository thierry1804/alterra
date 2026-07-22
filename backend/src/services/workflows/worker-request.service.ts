import { Prisma, RequestStatus, Role, WorkerStatus } from "@prisma/client";
import type { AccessTokenPayload } from "../../lib/jwt.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../middleware/error-handler.js";
import {
  assertActivityCancelAllowed,
  assertActivityDecisionAllowed,
} from "./workflow-state.js";

export interface ListWorkerRequestsInput {
  status?: RequestStatus;
  cursor?: string;
  take?: number;
}

export interface CreateWorkerRequestInput {
  firstName: string;
  lastName: string;
  mvolaNumber: string;
  cinNumber?: string;
  proposedPhotoKey?: string;
  targetTeamId?: string;
  justification: string;
}

export interface WorkerDecisionInput {
  decision: "APPROVED" | "REJECTED";
  decisionReason?: string;
}

export interface ComplementInput {
  comment: string;
}

function listScopeWhere(user: AccessTokenPayload): Prisma.WorkerRequestWhereInput {
  if (user.role === Role.ADMIN) return {};
  if (user.role === Role.CHEF_SERVICE) {
    return { requestedById: user.sub };
  }
  return { id: "00000000-0000-0000-0000-000000000000" };
}

async function resolveSiteIdForExistingRequest(
  request: Pick<CreateWorkerRequestInput, "targetTeamId"> & { requestedById: string },
): Promise<string> {
  if (request.targetTeamId) {
    const team = await prisma.team.findUnique({ where: { id: request.targetTeamId } });
    if (!team) throw new ApiError(404, "NOT_FOUND", "Équipe cible introuvable");
    return team.siteId;
  }

  const requester = await prisma.user.findUnique({ where: { id: request.requestedById } });
  if (!requester?.siteId) {
    throw new ApiError(422, "SITE_REQUIRED", "Site requis pour créer un MOC");
  }
  return requester.siteId;
}

export async function listWorkerRequests(user: AccessTokenPayload, input: ListWorkerRequestsInput) {
  const pageSize = input.take ?? 50;
  const where: Prisma.WorkerRequestWhereInput = {
    ...listScopeWhere(user),
    ...(input.status ? { status: input.status } : {}),
  };

  const rows = await prisma.workerRequest.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > pageSize;
  const data = hasMore ? rows.slice(0, pageSize) : rows;
  return { data, nextCursor: hasMore ? data[data.length - 1]?.id : null, hasMore };
}

export async function getWorkerRequest(user: AccessTokenPayload, id: string) {
  const request = await prisma.workerRequest.findFirst({
    where: { id, ...listScopeWhere(user) },
  });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Demande MOC introuvable");
  return request;
}

export async function createWorkerRequest(
  user: AccessTokenPayload,
  input: CreateWorkerRequestInput,
) {
  if (user.role !== Role.CHEF_SERVICE && user.role !== Role.ADMIN) {
    throw new ApiError(403, "FORBIDDEN", "Seul le chef de service peut créer cette demande");
  }

  const siteId = await resolveSiteIdForExistingRequest({
    targetTeamId: input.targetTeamId,
    requestedById: user.sub,
  });
  if (user.role === Role.CHEF_SERVICE && user.siteId !== siteId) {
    throw new ApiError(403, "FORBIDDEN", "Équipe hors périmètre site");
  }

  return prisma.workerRequest.create({
    data: {
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      mvolaNumber: input.mvolaNumber.trim(),
      cinNumber: input.cinNumber?.trim(),
      proposedPhotoKey: input.proposedPhotoKey,
      targetTeamId: input.targetTeamId,
      justification: input.justification.trim(),
      requestedById: user.sub,
      status: RequestStatus.PENDING,
    },
  });
}

export async function decideWorkerRequest(
  user: AccessTokenPayload,
  id: string,
  input: WorkerDecisionInput,
) {
  if (user.role !== Role.ADMIN) {
    throw new ApiError(403, "FORBIDDEN", "Seul l'administrateur peut décider");
  }

  const request = await prisma.workerRequest.findUnique({ where: { id } });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Demande MOC introuvable");
  assertActivityDecisionAllowed(request.status);

  if (input.decision === "REJECTED" && !input.decisionReason?.trim()) {
    throw new ApiError(422, "REASON_REQUIRED", "Motif obligatoire pour un refus");
  }

  if (input.decision === "REJECTED") {
    return prisma.workerRequest.update({
      where: { id },
      data: {
        status: RequestStatus.REJECTED,
        decisionById: user.sub,
        decisionAt: new Date(),
        decisionReason: input.decisionReason?.trim(),
      },
    });
  }

  return prisma.$transaction(async (tx) => {
    const siteId = await resolveSiteIdForExistingRequest({
      targetTeamId: request.targetTeamId ?? undefined,
      requestedById: request.requestedById,
    });
    const site = await tx.site.findUniqueOrThrow({ where: { id: siteId } });
    const workerCount = await tx.worker.count({ where: { siteId: site.id, deletedAt: null } });
    const matricule = `MOC-${site.shortCode}-R${String(workerCount + 1).padStart(3, "0")}`;

    const worker = await tx.worker.create({
      data: {
        matricule,
        firstName: request.firstName,
        lastName: request.lastName,
        mvolaNumber: request.mvolaNumber,
        cinNumber: request.cinNumber,
        photoKey: request.proposedPhotoKey,
        siteId: site.id,
        teamId: request.targetTeamId,
        status: WorkerStatus.ACTIVE,
        hiredAt: new Date(),
      },
    });

    return tx.workerRequest.update({
      where: { id },
      data: {
        status: RequestStatus.APPROVED,
        decisionById: user.sub,
        decisionAt: new Date(),
        decisionReason: input.decisionReason?.trim(),
        createdWorkerId: worker.id,
      },
    });
  });
}

export async function complementWorkerRequest(
  user: AccessTokenPayload,
  id: string,
  input: ComplementInput,
) {
  if (user.role !== Role.ADMIN) {
    throw new ApiError(403, "FORBIDDEN", "Seul l'administrateur peut demander un complément");
  }

  const request = await prisma.workerRequest.findUnique({ where: { id } });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Demande MOC introuvable");
  assertActivityDecisionAllowed(request.status);

  return prisma.workerRequest.update({
    where: { id },
    data: { decisionReason: input.comment.trim() },
  });
}

export async function cancelWorkerRequest(user: AccessTokenPayload, id: string) {
  const request = await prisma.workerRequest.findFirst({
    where: { id, ...listScopeWhere(user) },
  });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Demande MOC introuvable");
  assertActivityCancelAllowed(request.status);

  if (user.role !== Role.ADMIN && request.requestedById !== user.sub) {
    throw new ApiError(403, "FORBIDDEN", "Annulation non autorisée");
  }

  return prisma.workerRequest.update({
    where: { id },
    data: {
      status: RequestStatus.REJECTED,
      decisionById: user.sub,
      decisionAt: new Date(),
      decisionReason: "Annulée par le demandeur",
    },
  });
}
