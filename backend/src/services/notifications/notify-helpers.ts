import { NotificationType } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import {
  createAndDispatch,
  createAndDispatchMany,
  findChefEquipeIdsByTeam,
  type CreateNotificationInput,
} from "./notification.service.js";

type AuditCtx = {
  actorUserId: string;
  ip?: string | null;
  userAgent?: string | null;
};

function base(ctx: AuditCtx): Pick<CreateNotificationInput, "actorUserId" | "ip" | "userAgent"> {
  return {
    actorUserId: ctx.actorUserId,
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  };
}

export async function notifyClarificationOpen(
  clarification: { id: string; pointageId: string; question: string },
  ctx: AuditCtx,
): Promise<void> {
  const pointage = await prisma.pointage.findUnique({
    where: { id: clarification.pointageId },
    select: { worker: { select: { teamId: true } } },
  });
  const teamId = pointage?.worker.teamId;
  if (!teamId) return;

  const cdeIds = await findChefEquipeIdsByTeam(teamId);
  await createAndDispatchMany(
    cdeIds.map((userId) => ({
      userId,
      type: NotificationType.CLARIFICATION_OPEN,
      title: "Demande de précisions",
      body: clarification.question.slice(0, 160),
      entityType: "ClarificationRequest",
      entityId: clarification.id,
      payload: { href: "/clarifications" },
      ...base(ctx),
    })),
  );
}

export async function notifyClarificationAnswered(
  clarification: {
    id: string;
    requestedById: string;
    answerText: string | null;
  },
  ctx: AuditCtx,
): Promise<void> {
  await createAndDispatch({
    userId: clarification.requestedById,
    type: NotificationType.CLARIFICATION_ANSWERED,
    title: "Réponse du chef d'équipe",
    body: (clarification.answerText ?? "Le CDE a répondu à votre demande.").slice(0, 160),
    entityType: "ClarificationRequest",
    entityId: clarification.id,
    payload: { href: "/clarifications" },
    ...base(ctx),
  });
}

export async function notifyClarificationClosed(
  clarification: { id: string; answeredById: string | null },
  ctx: AuditCtx,
): Promise<void> {
  if (!clarification.answeredById) return;
  await createAndDispatch({
    userId: clarification.answeredById,
    type: NotificationType.CLARIFICATION_CLOSED,
    title: "Précisions clôturées",
    body: "Le chef de service a clôturé la demande de précisions.",
    entityType: "ClarificationRequest",
    entityId: clarification.id,
    payload: { href: "/clarifications" },
    ...base(ctx),
  });
}

export async function notifyActivityRequestDecided(
  request: { id: string; requestedById: string; status: string; proposedLabel: string },
  ctx: AuditCtx,
): Promise<void> {
  await createAndDispatch({
    userId: request.requestedById,
    type: NotificationType.ACTIVITY_REQUEST_DECIDED,
    title: "Décision — demande d'activité",
    body: `${request.proposedLabel} : ${request.status}`,
    entityType: "ActivityRequest",
    entityId: request.id,
    payload: { href: "/activity-requests", status: request.status },
    ...base(ctx),
  });
}

export async function notifyWorkerRequestDecided(
  request: { id: string; requestedById: string; status: string; firstName: string; lastName: string },
  ctx: AuditCtx,
): Promise<void> {
  await createAndDispatch({
    userId: request.requestedById,
    type: NotificationType.WORKER_REQUEST_DECIDED,
    title: "Décision — demande MOC",
    body: `${request.firstName} ${request.lastName} : ${request.status}`,
    entityType: "WorkerRequest",
    entityId: request.id,
    payload: { href: "/worker-requests", status: request.status },
    ...base(ctx),
  });
}

async function teamIdsForPointages(ids: string[]): Promise<string[]> {
  const rows = await prisma.pointage.findMany({
    where: { id: { in: ids } },
    select: { worker: { select: { teamId: true } } },
  });
  return [...new Set(rows.map((r) => r.worker.teamId).filter(Boolean))] as string[];
}

export async function notifyPointagesRejected(
  pointageIds: string[],
  reason: string,
  ctx: AuditCtx,
): Promise<void> {
  if (pointageIds.length === 0) return;
  const teamIds = await teamIdsForPointages(pointageIds);
  const title =
    pointageIds.length === 1 ? "Pointage rejeté" : `${pointageIds.length} pointages rejetés`;
  const body =
    pointageIds.length === 1
      ? reason.slice(0, 160)
      : `${pointageIds.length} pointages rejetés — ${reason.slice(0, 100)}`;

  for (const teamId of teamIds) {
    const cdeIds = await findChefEquipeIdsByTeam(teamId);
    await createAndDispatchMany(
      cdeIds.map((userId) => ({
        userId,
        type: NotificationType.POINTAGE_REJECTED,
        title,
        body,
        entityType: "Pointage",
        entityId: pointageIds.length === 1 ? pointageIds[0] : null,
        payload: { href: "/my-pointages", pointageIds },
        ...base(ctx),
      })),
    );
  }
}

export async function notifyPointagesValidated(
  pointageIds: string[],
  ctx: AuditCtx,
): Promise<void> {
  if (pointageIds.length === 0) return;
  const teamIds = await teamIdsForPointages(pointageIds);
  const title =
    pointageIds.length === 1 ? "Pointage validé" : `${pointageIds.length} pointages validés`;
  const body =
    pointageIds.length === 1
      ? "Votre pointage a été validé."
      : `${pointageIds.length} pointages ont été validés.`;

  for (const teamId of teamIds) {
    const cdeIds = await findChefEquipeIdsByTeam(teamId);
    await createAndDispatchMany(
      cdeIds.map((userId) => ({
        userId,
        type: NotificationType.POINTAGE_VALIDATED,
        title,
        body,
        entityType: "Pointage",
        entityId: pointageIds.length === 1 ? pointageIds[0] : null,
        payload: { href: "/my-pointages", pointageIds },
        ...base(ctx),
      })),
    );
  }
}
