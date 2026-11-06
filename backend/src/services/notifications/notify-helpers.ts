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
  request: {
    id: string;
    requestedById: string;
    status: string;
    firstName: string;
    lastName: string;
  },
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

async function groupPointageIdsByTeam(ids: string[]): Promise<Map<string, string[]>> {
  const rows = await prisma.pointage.findMany({
    where: { id: { in: ids } },
    select: { id: true, worker: { select: { teamId: true } } },
  });
  const byTeam = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.worker.teamId) continue;
    const idsForTeam = byTeam.get(row.worker.teamId);
    if (idsForTeam) idsForTeam.push(row.id);
    else byTeam.set(row.worker.teamId, [row.id]);
  }
  return byTeam;
}

export async function notifyPointagesRejected(
  pointageIds: string[],
  reason: string,
  ctx: AuditCtx,
): Promise<void> {
  if (pointageIds.length === 0) return;
  const byTeam = await groupPointageIdsByTeam(pointageIds);

  for (const [teamId, idsForTeam] of byTeam) {
    const title =
      idsForTeam.length === 1 ? "Pointage rejeté" : `${idsForTeam.length} pointages rejetés`;
    const body =
      idsForTeam.length === 1
        ? reason.slice(0, 160)
        : `${idsForTeam.length} pointages rejetés — ${reason.slice(0, 100)}`;

    const cdeIds = await findChefEquipeIdsByTeam(teamId);
    await createAndDispatchMany(
      cdeIds.map((userId) => ({
        userId,
        type: NotificationType.POINTAGE_REJECTED,
        title,
        body,
        entityType: "Pointage",
        entityId: idsForTeam.length === 1 ? idsForTeam[0] : null,
        payload: { href: "/my-pointages", pointageIds: idsForTeam },
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
  const byTeam = await groupPointageIdsByTeam(pointageIds);

  for (const [teamId, idsForTeam] of byTeam) {
    const title =
      idsForTeam.length === 1 ? "Pointage validé" : `${idsForTeam.length} pointages validés`;
    const body =
      idsForTeam.length === 1
        ? "Votre pointage a été validé."
        : `${idsForTeam.length} pointages ont été validés.`;

    const cdeIds = await findChefEquipeIdsByTeam(teamId);
    await createAndDispatchMany(
      cdeIds.map((userId) => ({
        userId,
        type: NotificationType.POINTAGE_VALIDATED,
        title,
        body,
        entityType: "Pointage",
        entityId: idsForTeam.length === 1 ? idsForTeam[0] : null,
        payload: { href: "/my-pointages", pointageIds: idsForTeam },
        ...base(ctx),
      })),
    );
  }
}
