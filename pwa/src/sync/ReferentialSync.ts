import { api } from "../lib/api";
import { db, setSetting, type ActivityRecord, type BadgeRecord, type WorkerRecord } from "../db/db";
import { SETTING_REFERENTIALS_SYNCED_AT } from "../lib/day-session";
import { normalizeTagId } from "../lib/nfc";

interface ApiWorker {
  id: string;
  firstName: string;
  lastName: string;
  matricule: string;
  siteId: string;
  teamId: string | null;
  status: string;
}

interface ApiActivity {
  id: string;
  label: string;
  unit: string;
  unitRate: string | number;
  siteId: string | null;
  active: boolean;
}

export interface ReferentialSyncResult {
  workers: number;
  activities: number;
  badges: number;
}

export async function syncReferentials(options: {
  siteId?: string | null;
  teamId?: string | null;
}): Promise<ReferentialSyncResult> {
  if (!navigator.onLine) {
    return {
      workers: await db.workers.count(),
      activities: await db.activities.count(),
      badges: await db.badges.count(),
    };
  }

  const workerParams: Record<string, string | number> = {
    status: "ACTIVE",
    take: 100,
  };
  if (options.siteId) workerParams.siteId = options.siteId;
  if (options.teamId) workerParams.teamId = options.teamId;

  const workers: WorkerRecord[] = [];
  let cursor: string | undefined;

  do {
    const response = await api.get<{
      data: ApiWorker[];
      nextCursor: string | null;
      hasMore: boolean;
    }>("/workers", {
      params: cursor ? { ...workerParams, cursor } : workerParams,
    });

    workers.push(
      ...response.data.data.map((worker) => ({
        id: worker.id,
        firstName: worker.firstName,
        lastName: worker.lastName,
        matricule: worker.matricule,
        teamId: worker.teamId,
        siteId: worker.siteId,
      })),
    );

    cursor = response.data.hasMore ? (response.data.nextCursor ?? undefined) : undefined;
  } while (cursor);

  const activityParams: Record<string, string> = { active: "true" };
  if (options.siteId) activityParams.siteId = options.siteId;

  const activitiesResponse = await api.get<{ data: ApiActivity[] }>("/activities", {
    params: activityParams,
  });

  const activities: ActivityRecord[] = activitiesResponse.data.data.map((activity) => ({
    id: activity.id,
    label: activity.label,
    unit: activity.unit,
    unitRate: Number(activity.unitRate),
    siteId: activity.siteId,
    active: activity.active,
  }));

  const badgeParams: Record<string, string> = { active: "true" };
  if (options.teamId) badgeParams.teamId = options.teamId;

  const badgesResponse = await api.get<{
    data: Array<{ nfcTagId: string; workerId: string }>;
  }>("/badges", { params: badgeParams });

  const badges: BadgeRecord[] = badgesResponse.data.data.map((badge) => ({
    nfcTagId: normalizeTagId(badge.nfcTagId),
    workerId: badge.workerId,
  }));

  await db.transaction("rw", db.workers, db.activities, db.badges, async () => {
    await db.workers.clear();
    await db.activities.clear();
    await db.badges.clear();
    if (workers.length > 0) await db.workers.bulkPut(workers);
    if (activities.length > 0) await db.activities.bulkPut(activities);
    if (badges.length > 0) await db.badges.bulkPut(badges);
  });

  await setSetting(SETTING_REFERENTIALS_SYNCED_AT, new Date().toISOString());

  return { workers: workers.length, activities: activities.length, badges: badges.length };
}
