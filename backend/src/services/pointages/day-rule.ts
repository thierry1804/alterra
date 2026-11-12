import { prisma } from "../../lib/prisma.js";

/**
 * Règle de pointage : un travailleur n'a qu'un seul pointage actif (non REJECTED) par jour, donc une
 * seule équipe et une seule activité ce jour-là. L'activité peut en revanche changer d'un jour à
 * l'autre. Un pointage REJECTED ne compte pas (sa réparation passe par /resubmit).
 */
export const DAY_RULE_DB_ERROR =
  "Ce travailleur est déjà pointé ce jour-là (une seule équipe et une seule activité par jour)";

/** Client Prisma ou client de transaction (`prisma.$transaction(async (tx) => …)`). */
export type Db = typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export interface DayConflict {
  id: string;
  subActivityId: string;
  subActivityLabel: string;
}

export async function findDayConflict(
  db: Db,
  params: { workerId: string; date: Date; excludeId?: string; excludeClientUuid?: string },
): Promise<DayConflict | null> {
  const found = await db.pointage.findFirst({
    where: {
      workerId: params.workerId,
      date: params.date,
      status: { not: "REJECTED" },
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
      ...(params.excludeClientUuid ? { clientUuid: { not: params.excludeClientUuid } } : {}),
    },
    select: {
      id: true,
      subActivityId: true,
      subActivity: { select: { label: true } },
    },
  });
  if (!found) return null;
  return {
    id: found.id,
    subActivityId: found.subActivityId,
    subActivityLabel: found.subActivity?.label ?? "",
  };
}

/** Message de refus : distingue le doublon exact (même activité) du changement d'activité en cours de jour. */
export function dayConflictMessage(conflict: DayConflict, subActivityId: string): string {
  if (conflict.subActivityId === subActivityId) {
    return "Ce travailleur a déjà un pointage pour cette activité ce jour-là";
  }
  const label = conflict.subActivityLabel ? ` « ${conflict.subActivityLabel} »` : "";
  return `Ce travailleur est déjà pointé sur l'activité${label} ce jour-là : une seule activité par jour`;
}
