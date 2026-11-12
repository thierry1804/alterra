import { Prisma } from "@prisma/client";
import { Role } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { DAY_RULE_DB_ERROR, dayConflictMessage, findDayConflict } from "./day-rule.js";

export interface SyncPointageItem {
  clientUuid: string;
  workerId: string;
  subActivityId: string;
  quantity: number;
  date: Date;
  parcelleId?: string;
  geoLat?: number;
  geoLng?: number;
  notes?: string;
  createdByClientAt: Date;
  photoKey?: string;
}

export type SyncPointageResultStatus = "created" | "already_exists" | "rejected" | "retry";

/** Codes Prisma transitoires (pool saturé, DB injoignable un instant) — jamais un rejet métier
 * définitif : la PWA doit garder l'item en file et retenter, pas l'abandonner. */
const TRANSIENT_PRISMA_CODES = new Set([
  "P1001", // Can't reach database server
  "P1002", // Database server timed out
  "P1008", // Operations timed out
  "P1017", // Server has closed the connection
  "P2024", // Timed out fetching a new connection from the pool
  "P2028", // Transaction API error
]);

/** Rattrapage max : jour de saisie + 3 jours précédents (même règle que la PWA). */
const MAX_BACKDATE_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(d: Date): number {
  return Math.floor(d.getTime() / DAY_MS);
}

/**
 * Valide la date d'un pointage par rapport au moment de saisie sur l'appareil (createdByClientAt),
 * pas à l'heure serveur : un lot saisi hors ligne puis synchronisé des jours plus tard reste valide.
 * Retourne le motif de rejet, ou null si la date est acceptable. La date ne peut pas non plus
 * dépasser demain côté serveur (tolérance fuseau), ce qui bloque un horodatage client falsifié.
 */
export function pointageDateRejection(
  date: Date,
  createdByClientAt: Date,
  now: Date = new Date(),
): string | null {
  const day = utcDay(date);
  const entryDay = utcDay(createdByClientAt);
  if (day > entryDay + 1 || day > utcDay(now) + 1) {
    return "La date du pointage ne peut pas être dans le futur";
  }
  if (day < entryDay - MAX_BACKDATE_DAYS) {
    return `La date du pointage ne peut pas remonter à plus de ${MAX_BACKDATE_DAYS} jours`;
  }
  return null;
}

function isTransientError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientInitializationError) return true;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return TRANSIENT_PRISMA_CODES.has(err.code);
  }
  return false;
}

export interface SyncPointageResult {
  clientUuid: string;
  status: SyncPointageResultStatus;
  id?: string;
  reason?: string;
}

/** Acteur de la synchronisation, pour contrôler que les travailleurs pointés sont dans son périmètre. */
export interface SyncActor {
  id: string;
  role: Role;
  teamId?: string | null;
  siteId?: string | null;
}

export async function syncPointageBatch(
  batch: SyncPointageItem[],
  actor: SyncActor,
): Promise<SyncPointageResult[]> {
  const enteredById = actor.id;
  const results: SyncPointageResult[] = [];

  for (const item of batch) {
    try {
      const dateRejection = pointageDateRejection(item.date, item.createdByClientAt);
      if (dateRejection) {
        results.push({ clientUuid: item.clientUuid, status: "rejected", reason: dateRejection });
        continue;
      }

      // Périmètre : un chef d'équipe ne pointe que sa propre équipe, un chef de service que son site.
      const worker = await prisma.worker.findUnique({
        where: { id: item.workerId },
        select: { teamId: true, siteId: true },
      });
      if (!worker) {
        results.push({
          clientUuid: item.clientUuid,
          status: "rejected",
          reason: "Travailleur introuvable",
        });
        continue;
      }
      if (
        (actor.role === Role.CHEF_EQUIPE && worker.teamId !== actor.teamId) ||
        (actor.role === Role.CHEF_SERVICE && worker.siteId !== actor.siteId)
      ) {
        results.push({
          clientUuid: item.clientUuid,
          status: "rejected",
          reason:
            actor.role === Role.CHEF_EQUIPE
              ? "Ce travailleur n'appartient pas à votre équipe"
              : "Ce travailleur n'appartient pas à votre site",
        });
        continue;
      }

      // Un seul pointage actif par travailleur et par jour (donc une seule équipe et une seule
      // activité) — sinon double comptage au paiement. Un REJECTED ne compte pas (sa réparation
      // passe par /resubmit).
      const conflict = await findDayConflict(prisma, {
        workerId: item.workerId,
        date: item.date,
        excludeClientUuid: item.clientUuid,
      });
      if (conflict) {
        results.push({
          clientUuid: item.clientUuid,
          status: "rejected",
          reason: dayConflictMessage(conflict, item.subActivityId),
        });
        continue;
      }

      const subActivity = await prisma.activitySubActivity.findUniqueOrThrow({
        where: { id: item.subActivityId },
      });
      const amount = item.quantity * Number(subActivity.unitRate);

      const created = await prisma.pointage.create({
        data: {
          clientUuid: item.clientUuid,
          workerId: item.workerId,
          subActivityId: item.subActivityId,
          quantity: item.quantity,
          unitRateSnapshot: subActivity.unitRate,
          amount,
          date: item.date,
          parcelleId: item.parcelleId,
          geoLat: item.geoLat,
          geoLng: item.geoLng,
          notes: item.notes,
          enteredById,
          createdByClientAt: item.createdByClientAt,
          // Préfixe vérifié pour empêcher qu'un client pointe vers une clé MinIO arbitraire.
          photoKey: item.photoKey?.startsWith("pointages/") ? item.photoKey : undefined,
        },
      });
      results.push({ clientUuid: item.clientUuid, status: "created", id: created.id });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = err.meta?.target;
        if (Array.isArray(target) && target.includes("clientUuid")) {
          const existing = await prisma.pointage.findUnique({
            where: { clientUuid: item.clientUuid },
          });
          results.push({
            clientUuid: item.clientUuid,
            status: "already_exists",
            id: existing?.id,
          });
        } else {
          // Course gagnée par une autre requête concurrente sur le même (travailleur, jour) : le
          // contrôle ci-dessus les avait tous les deux laissés passer, l'index partiel tranche.
          results.push({
            clientUuid: item.clientUuid,
            status: "rejected",
            reason: DAY_RULE_DB_ERROR,
          });
        }
      } else if (isTransientError(err)) {
        results.push({
          clientUuid: item.clientUuid,
          status: "retry",
          reason: err instanceof Error ? err.message : "unknown_error",
        });
      } else {
        results.push({
          clientUuid: item.clientUuid,
          status: "rejected",
          reason: err instanceof Error ? err.message : "unknown_error",
        });
      }
    }
  }

  return results;
}
