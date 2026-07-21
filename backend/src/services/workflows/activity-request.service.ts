import { Prisma, RequestStatus, Role } from "@prisma/client";
import type { AccessTokenPayload } from "../../lib/jwt.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../middleware/error-handler.js";
import { startOfUtcDay } from "../activities/activity-version.service.js";
import {
  assertActivityCancelAllowed,
  assertActivityDecisionAllowed,
} from "./workflow-state.js";

export interface ListActivityRequestsInput {
  status?: RequestStatus;
  cursor?: string;
  take?: number;
}

export interface CreateActivityRequestInput {
  proposedLabel: string;
  proposedUnit: string;
  proposedRate: number;
  justification: string;
}

export interface ActivityDecisionInput {
  decision: "APPROVED" | "REJECTED";
  decisionReason?: string;
}

export interface ComplementInput {
  comment: string;
}

function listScopeWhere(user: AccessTokenPayload): Prisma.ActivityRequestWhereInput {
  if (user.role === Role.ADMIN) return {};
  if (user.role === Role.CHEF_SERVICE) {
    return { requestedById: user.sub };
  }
  return { id: "00000000-0000-0000-0000-000000000000" };
}

export async function listActivityRequests(
  user: AccessTokenPayload,
  input: ListActivityRequestsInput,
) {
  const pageSize = input.take ?? 50;
  const where: Prisma.ActivityRequestWhereInput = {
    ...listScopeWhere(user),
    ...(input.status ? { status: input.status } : {}),
  };

  const rows = await prisma.activityRequest.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > pageSize;
  const data = hasMore ? rows.slice(0, pageSize) : rows;
  return { data, nextCursor: hasMore ? data[data.length - 1]?.id : null, hasMore };
}

export async function getActivityRequest(user: AccessTokenPayload, id: string) {
  const request = await prisma.activityRequest.findFirst({
    where: { id, ...listScopeWhere(user) },
  });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Demande activité introuvable");
  return request;
}

export async function createActivityRequest(
  user: AccessTokenPayload,
  input: CreateActivityRequestInput,
) {
  if (user.role !== Role.CHEF_SERVICE && user.role !== Role.ADMIN) {
    throw new ApiError(403, "FORBIDDEN", "Seul le chef de service peut créer cette demande");
  }

  return prisma.activityRequest.create({
    data: {
      proposedLabel: input.proposedLabel.trim(),
      proposedUnit: input.proposedUnit.trim(),
      proposedRate: input.proposedRate,
      justification: input.justification.trim(),
      requestedById: user.sub,
      siteId: user.siteId,
      status: RequestStatus.PENDING,
    },
  });
}

export async function decideActivityRequest(
  user: AccessTokenPayload,
  id: string,
  input: ActivityDecisionInput,
) {
  if (user.role !== Role.ADMIN) {
    throw new ApiError(403, "FORBIDDEN", "Seul l'administrateur peut décider");
  }

  const request = await prisma.activityRequest.findUnique({ where: { id } });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Demande activité introuvable");
  assertActivityDecisionAllowed(request.status);

  if (input.decision === "REJECTED" && !input.decisionReason?.trim()) {
    throw new ApiError(422, "REASON_REQUIRED", "Motif obligatoire pour un refus");
  }

  if (input.decision === "REJECTED") {
    return prisma.activityRequest.update({
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
    const activity = await tx.activity.create({
      data: {
        label: request.proposedLabel,
        unit: request.proposedUnit,
        unitRate: request.proposedRate,
        validFrom: startOfUtcDay(),
        siteId: request.siteId,
        active: true,
      },
    });

    return tx.activityRequest.update({
      where: { id },
      data: {
        status: RequestStatus.APPROVED,
        decisionById: user.sub,
        decisionAt: new Date(),
        decisionReason: input.decisionReason?.trim(),
        createdActivityId: activity.id,
      },
    });
  });
}

export async function complementActivityRequest(
  user: AccessTokenPayload,
  id: string,
  input: ComplementInput,
) {
  if (user.role !== Role.ADMIN) {
    throw new ApiError(403, "FORBIDDEN", "Seul l'administrateur peut demander un complément");
  }

  const request = await prisma.activityRequest.findUnique({ where: { id } });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Demande activité introuvable");
  assertActivityDecisionAllowed(request.status);

  return prisma.activityRequest.update({
    where: { id },
    data: { decisionReason: input.comment.trim() },
  });
}

export async function cancelActivityRequest(user: AccessTokenPayload, id: string) {
  const request = await prisma.activityRequest.findFirst({
    where: { id, ...listScopeWhere(user) },
  });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Demande activité introuvable");
  assertActivityCancelAllowed(request.status);

  if (user.role !== Role.ADMIN && request.requestedById !== user.sub) {
    throw new ApiError(403, "FORBIDDEN", "Annulation non autorisée");
  }

  return prisma.activityRequest.update({
    where: { id },
    data: {
      status: RequestStatus.REJECTED,
      decisionById: user.sub,
      decisionAt: new Date(),
      decisionReason: "Annulée par le demandeur",
    },
  });
}
