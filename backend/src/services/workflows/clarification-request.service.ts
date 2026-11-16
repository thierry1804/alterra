import { ClarificationStatus, PointageStatus, Prisma } from "@prisma/client";
import { can } from "../../middleware/rbac.js";
import type { AuthUser } from "../access/auth-user.js";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../middleware/error-handler.js";
import { createOnce } from "./idempotency.js";
import {
  assertClarificationAnswerAllowed,
  assertClarificationCloseAllowed,
} from "./workflow-state.js";

export interface ListClarificationRequestsInput {
  status?: ClarificationStatus;
  cursor?: string;
  take?: number;
}

export interface CreateClarificationRequestInput {
  pointageId: string;
  question: string;
  requestedPhoto?: boolean;
  clientUuid?: string;
}

export interface AnswerClarificationInput {
  answerText: string;
  answerPhotoKey?: string;
}

function listScopeWhere(user: AuthUser): Prisma.ClarificationRequestWhereInput {
  if (user.scope === "TOUS") return {};

  if (user.scope === "SITE" && user.siteId) {
    return {
      OR: [{ requestedById: user.sub }, { pointage: { worker: { siteId: user.siteId } } }],
    };
  }

  if (user.scope === "EQUIPE" && user.teamId) {
    return {
      pointage: {
        worker: { teamId: user.teamId },
      },
    };
  }

  return { id: "00000000-0000-0000-0000-000000000000" };
}

async function assertPointageAccessible(
  user: AuthUser,
  pointageId: string,
): Promise<{ id: string; workerId: string }> {
  const pointage = await prisma.pointage.findUnique({
    where: { id: pointageId },
    include: { worker: { select: { siteId: true, teamId: true } } },
  });
  if (!pointage) throw new ApiError(404, "NOT_FOUND", "Pointage introuvable");

  if (user.scope === "SITE" && user.siteId !== pointage.worker.siteId) {
    throw new ApiError(403, "FORBIDDEN", "Pointage hors périmètre site");
  }
  if (user.scope === "EQUIPE" && user.teamId !== pointage.worker.teamId) {
    throw new ApiError(403, "FORBIDDEN", "Pointage hors périmètre équipe");
  }

  return { id: pointage.id, workerId: pointage.workerId };
}

export async function listClarificationRequests(
  user: AuthUser,
  input: ListClarificationRequestsInput,
) {
  const pageSize = input.take ?? 50;
  const where: Prisma.ClarificationRequestWhereInput = {
    ...listScopeWhere(user),
    ...(input.status ? { status: input.status } : {}),
  };

  const rows = await prisma.clarificationRequest.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: pageSize + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > pageSize;
  const data = hasMore ? rows.slice(0, pageSize) : rows;
  return { data, nextCursor: hasMore ? data[data.length - 1]?.id : null, hasMore };
}

export async function getClarificationRequest(user: AuthUser, id: string) {
  const request = await prisma.clarificationRequest.findFirst({
    where: { id, ...listScopeWhere(user) },
  });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Demande de précisions introuvable");
  return request;
}

export async function createClarificationRequest(
  user: AuthUser,
  input: CreateClarificationRequestInput,
) {
  if (!can(user, "precision:creer")) {
    throw new ApiError(403, "FORBIDDEN", "Seul le chef de service peut demander des précisions");
  }

  await assertPointageAccessible(user, input.pointageId);

  return createOnce(
    input.clientUuid,
    user.sub,
    (clientUuid) => prisma.clarificationRequest.findUnique({ where: { clientUuid } }),
    () => createClarification(user, input),
  );
}

function createClarification(user: AuthUser, input: CreateClarificationRequestInput) {
  return prisma.$transaction(async (tx) => {
    const created = await tx.clarificationRequest.create({
      data: {
        clientUuid: input.clientUuid,
        pointageId: input.pointageId,
        question: input.question.trim(),
        requestedPhoto: input.requestedPhoto ?? false,
        requestedById: user.sub,
        status: ClarificationStatus.OPEN,
      },
    });

    await tx.pointage.update({
      where: { id: input.pointageId },
      data: { status: PointageStatus.NEEDS_CLARIFICATION },
    });

    return created;
  });
}

export async function answerClarificationRequest(
  user: AuthUser,
  id: string,
  input: AnswerClarificationInput,
) {
  if (!can(user, "precision:repondre")) {
    throw new ApiError(403, "FORBIDDEN", "Seul le chef d'équipe peut répondre");
  }

  const request = await prisma.clarificationRequest.findUnique({
    where: { id },
    include: { pointage: { include: { worker: true } } },
  });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Demande de précisions introuvable");
  // Renvoi hors ligne d'une réponse déjà enregistrée (réponse HTTP perdue) : idempotent.
  if (
    request.status === ClarificationStatus.ANSWERED &&
    request.answeredById === user.sub &&
    request.answerText === input.answerText.trim()
  ) {
    return request;
  }
  assertClarificationAnswerAllowed(request.status);

  if (user.scope === "EQUIPE" && user.teamId !== request.pointage.worker.teamId) {
    throw new ApiError(403, "FORBIDDEN", "Demande hors périmètre équipe");
  }

  if (request.requestedPhoto && !input.answerPhotoKey) {
    throw new ApiError(422, "PHOTO_REQUIRED", "Photo requise pour cette demande");
  }

  return prisma.clarificationRequest.update({
    where: { id },
    data: {
      answerText: input.answerText.trim(),
      answerPhotoKey: input.answerPhotoKey,
      status: ClarificationStatus.ANSWERED,
      answeredById: user.sub,
      answeredAt: new Date(),
    },
  });
}

export async function closeClarificationRequest(user: AuthUser, id: string) {
  if (!can(user, "precision:cloturer")) {
    throw new ApiError(403, "FORBIDDEN", "Seul le chef de service peut clôturer");
  }

  const request = await prisma.clarificationRequest.findUnique({
    where: { id },
    include: { pointage: { include: { worker: true } } },
  });
  if (!request) throw new ApiError(404, "NOT_FOUND", "Demande de précisions introuvable");
  assertClarificationCloseAllowed(request.status);

  if (user.scope === "SITE" && user.siteId !== request.pointage.worker.siteId) {
    throw new ApiError(403, "FORBIDDEN", "Demande hors périmètre site");
  }

  return prisma.$transaction(async (tx) => {
    const closed = await tx.clarificationRequest.update({
      where: { id },
      data: {
        status: ClarificationStatus.CLOSED,
        resolvedAt: new Date(),
      },
    });

    // Conditionné au statut encore NEEDS_CLARIFICATION : si le pointage a déjà été validé/rejeté
    // entre-temps (le CDS a traité la réponse avant de clôturer), la clôture ne doit pas écraser
    // ce traitement plus avancé en le faisant reculer silencieusement en PENDING.
    await tx.pointage.updateMany({
      where: { id: request.pointageId, status: PointageStatus.NEEDS_CLARIFICATION },
      data: { status: PointageStatus.PENDING },
    });

    return closed;
  });
}
