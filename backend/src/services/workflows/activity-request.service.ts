import { randomUUID } from "node:crypto";
import { Prisma, RequestStatus } from "@prisma/client";
import { can } from "../../middleware/rbac.js";
import type { AuthUser } from "../access/auth-user.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../middleware/error-handler.js";
import { createOnce } from "./idempotency.js";
import { startOfUtcDay } from "../activities/activity-version.service.js";
import { assertActivityCancelAllowed, assertActivityDecisionAllowed } from "./workflow-state.js";

export interface ListActivityRequestsInput {
  status?: RequestStatus;
  cursor?: string;
  take?: number;
}

export interface CreateActivityRequestInput {
  categoryId: string;
  proposedLabel: string;
  unitId: string;
  proposedRate: number;
  justification: string;
  clientUuid?: string;
}

export interface ActivityDecisionInput {
  decision: "APPROVED" | "REJECTED";
  decisionReason?: string;
}

export interface ComplementInput {
  comment: string;
}

function listScopeWhere(user: AuthUser): Prisma.ActivityRequestWhereInput {
  if (can(user, "demande:decider")) {
    if (user.scope === "TOUS") return {};
    return { OR: [{ requestedById: user.sub }, ...(user.siteId ? [{ siteId: user.siteId }] : [])] };
  }
  if (can(user, "demande:creer")) {
    return { requestedById: user.sub };
  }
  return { id: "00000000-0000-0000-0000-000000000000" };
}

export async function listActivityRequests(user: AuthUser, input: ListActivityRequestsInput) {
  const pageSize = input.take ?? 50;
  const where: Prisma.ActivityRequestWhereInput = {
    ...listScopeWhere(user),
    ...(input.status ? { status: input.status } : {}),
  };

  const rows = await prisma.activityRequest.findMany({
    where,
    include: { category: true, unit: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > pageSize;
  const data = hasMore ? rows.slice(0, pageSize) : rows;
  return { data, nextCursor: hasMore ? data[data.length - 1]?.id : null, hasMore };
}

export async function getActivityRequest(user: AuthUser, id: string) {
  const request = await prisma.activityRequest.findFirst({
    where: { id, ...listScopeWhere(user) },
    include: { category: true, unit: true },
  });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Demande activité introuvable");
  return request;
}

export async function createActivityRequest(user: AuthUser, input: CreateActivityRequestInput) {
  if (!can(user, "demande:creer")) {
    throw new ApiError(403, "FORBIDDEN", "Seul le chef de service peut créer cette demande");
  }

  return createOnce(
    input.clientUuid,
    user.sub,
    (clientUuid) => prisma.activityRequest.findUnique({ where: { clientUuid } }),
    () =>
      prisma.activityRequest.create({
        data: {
          clientUuid: input.clientUuid,
          categoryId: input.categoryId,
          proposedLabel: input.proposedLabel.trim(),
          unitId: input.unitId,
          proposedRate: input.proposedRate,
          justification: input.justification.trim(),
          requestedById: user.sub,
          siteId: user.siteId,
          status: RequestStatus.PENDING,
        },
      }),
  );
}

export async function decideActivityRequest(
  user: AuthUser,
  id: string,
  input: ActivityDecisionInput,
) {
  if (!can(user, "demande:decider")) {
    throw new ApiError(403, "FORBIDDEN", "Seul l'administrateur peut décider");
  }

  const request = await prisma.activityRequest.findFirst({
    where: { id, ...listScopeWhere(user) },
  });
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
    const subActivity = await tx.activitySubActivity.create({
      data: {
        categoryId: request.categoryId,
        label: request.proposedLabel,
        shortLabel: request.proposedLabel.toLowerCase(),
        unitId: request.unitId,
        unitRate: request.proposedRate,
        validFrom: startOfUtcDay(),
        siteId: request.siteId,
        groupKey: randomUUID(),
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
        createdSubActivityId: subActivity.id,
      },
    });
  });
}

export async function complementActivityRequest(
  user: AuthUser,
  id: string,
  input: ComplementInput,
) {
  if (!can(user, "demande:decider")) {
    throw new ApiError(403, "FORBIDDEN", "Seul l'administrateur peut demander un complément");
  }

  const request = await prisma.activityRequest.findFirst({
    where: { id, ...listScopeWhere(user) },
  });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Demande activité introuvable");
  assertActivityDecisionAllowed(request.status);

  return prisma.activityRequest.update({
    where: { id },
    data: { decisionReason: input.comment.trim() },
  });
}

export async function cancelActivityRequest(user: AuthUser, id: string) {
  const request = await prisma.activityRequest.findFirst({
    where: { id, ...listScopeWhere(user) },
  });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Demande activité introuvable");
  assertActivityCancelAllowed(request.status);

  if (!can(user, "demande:decider") && request.requestedById !== user.sub) {
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
